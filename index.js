import { extension_settings } from "../../../extensions.js";
import { saveSettingsDebounced, saveChatDebounced, eventSource, event_types, generateRaw, chat, chat_metadata, characters, this_chid, getCharacterCardFields, name1, animation_duration, setExtensionPrompt } from "../../../../script.js";
import { groups, selected_group, is_group_generating } from "../../../../scripts/group-chats.js";
import { dragElement } from "../../../../scripts/RossAscends-mods.js";
import { loadMovingUIState } from "../../../../scripts/power-user.js";

import { yamlToJSON, jsonToYAML } from "./lib/ymlParser.js";
import { defaultSettings } from "./src/defaultSettings.js";
import { createEditTrackerElement, createViewTrackerElement, resizeTextarea } from "./src/trackerEditor.js";
import { renderMessageTrackerTemplate } from "./src/templateProcessor.js";

// #region Constants and Utility Functions

// Extension information
const extensionName = "Tracker";
const extensionNameLong = `SillyTavern-${extensionName}`;
const extensionFolderPath = `scripts/extensions/third-party/${extensionNameLong}`;

if (!extension_settings[extensionName.toLowerCase()]) {
	extension_settings[extensionName.toLowerCase()] = {};
}

const extensionSettings = extension_settings[extensionName.toLowerCase()];

// Logging functions
const log = (...msg) => console.log(`[${extensionName}]`, ...msg);
const warn = (...msg) => console.warn(`[${extensionName}] Warning`, ...msg);
const error = (msg) => {
	throw new Error(`[${extensionName}] ${msg}`);
};
const debug = (...msg) => {
	if (extensionSettings.debugMode) {
		console.log(`[${extensionName} debug]`, ...msg);
	}
};

/**
 * Returns the index of the last non-system message in the chat.
 * @returns {number} Index of the last non-system message.
 */
function getLastNonSystemMessageIndex() {
	return (
		chat.length -
		1 -
		chat
			.slice()
			.reverse()
			.findIndex((c) => !c.is_system)
	);
}

/**
 * Retrieves the tracker object for a given message number.
 * @param {number} mesNum - The message number.
 * @returns {object} The tracker object.
 */
function getTracker(mesNum) {
	let tracker = chat[mesNum]?.tracker;

	if (!tracker) {
		if (extensionSettings.defaultTracker) tracker = JSON.parse(yamlToJSON(extensionSettings.defaultTracker));
		else tracker = {};
	}

	return tracker;
}

/**
 * Updates a nested property in an object using a path array.
 * @param {object} obj - The object to update.
 * @param {array} path - The path to the property.
 * @param {any} newValue - The new value to set.
 */
function updatePath(obj, path, newValue) {
	const lastKey = path.pop();
	const target = path.reduce((acc, key) => acc[key], obj);
	target[lastKey] = newValue;
}

// #endregion

// #region Settings Functions

/**
 * Initializes the extension settings by merging default and existing settings.
 */
async function initSettings() {
	Object.assign(extensionSettings, defaultSettings);
	saveSettingsDebounced();
}

/**
 * Checks if the extension is enabled.
 * @returns {boolean} True if enabled, false otherwise.
 */
async function isEnabled() {
	return extensionSettings.enabled;
}

/**
 * Sets the initial values of the settings UI elements.
 */
function setSettingsInitialValues() {
	$("#tracker_enable").prop("checked", extensionSettings.enabled);
	$("#tracker_context_prompt").val(extensionSettings.contextTemplate);
	$("#tracker_system_prompt").val(extensionSettings.systemPrompt);
	$("#tracker_character_description").val(extensionSettings.characterDescriptionTemplate);
	$("#tracker_recent_messages").val(extensionSettings.recentMessagesTemplate);
	$("#tracker_example_trackers").val(extensionSettings.exampleTrackers);
	$("#tracker_default_tracker").val(extensionSettings.defaultTracker);
	$("#tracker_request_prompt").val(extensionSettings.requestPrompt);
	$("#tracker_mes_tracker_template").val(extensionSettings.mesTrackerTemplate);
	$("#tracker_number_of_messages").val(extensionSettings.numberOfMessages);
	$("#tracker_response_length").val(extensionSettings.responseLength);
	$("#tracker_debug").prop("checked", extensionSettings.debugMode);
}

/**
 * Registers event listeners for the settings UI elements.
 */
function registerSettingsListeners() {
	$("#tracker_enable").on("input", onSettingCheckboxInput("enabled"));
	$("#tracker_context_prompt").on("input", onSettingInputareaInput("contextTemplate"));
	$("#tracker_system_prompt").on("input", onSettingInputareaInput("systemPrompt"));
	$("#tracker_character_description").on("input", onSettingInputareaInput("characterDescriptionTemplate"));
	$("#tracker_recent_messages").on("input", onSettingInputareaInput("recentMessagesTemplate"));
	$("#tracker_example_trackers").on("input", onSettingInputareaInput("exampleTrackers"));
	$("#tracker_default_tracker").on("input", onSettingInputareaInput("defaultTracker"));
	$("#tracker_request_prompt").on("input", onSettingInputareaInput("requestPrompt"));
	$("#tracker_mes_tracker_template").on("input", onSettingInputareaInput("mesTrackerTemplate"));
	$("#tracker_number_of_messages").on("input", onSettingInputareaInput("numberOfMessages"));
	$("#tracker_response_length").on("input", onSettingInputareaInput("responseLength"));
	$("#tracker_debug").on("input", onSettingCheckboxInput("debugMode"));
}

// #endregion

// #region Tracker Generation Functions

/**
 * Generates a new tracker for a given message number.
 * @param {number} mesNum - The message number.
 * @returns {object|null} The new tracker object or null if failed.
 */
async function generateTracker(mesNum) {
	if (mesNum != 0 && !mesNum) return null;

	// Build system and request prompts
	const systemPrompt = getSystemPrompt(mesNum);
	const requestPrompt = getRequestPrompt();

	log("Generating tracker with prompts:", { systemPrompt, requestPrompt });

	let responseLength = extensionSettings.responseLength > 0 ? extensionSettings.responseLength : null;

	// Generate tracker using the AI model
	var tracker = await generateRaw(requestPrompt, null, false, false, systemPrompt, responseLength);

	let newTracker;
	try {
		const trackerContent = tracker.match(/<tracker>([\s\S]*?)<\/tracker>/);
		const result = trackerContent ? trackerContent[1].trim() : null;
		newTracker = JSON.parse(yamlToJSON(result));
	} catch (error) {
		warn("Failed to parse tracker:", error);
	}

	debug("Generated tracker:", { newTracker });

	return newTracker;
}

/**
 * Constructs the system prompt for the AI model.
 * @param {number} mesNum - The message number.
 * @returns {string} The system prompt.
 */
function getSystemPrompt(mesNum) {
	const contextTemplate = extensionSettings.contextTemplate;

	// Replace placeholders with actual data
	const trackerSystemPrompt = getTrackerSystemPrompt();
	const characterDescriptions = getCharacterDescriptions();
	const trackerExamples = extensionSettings.exampleTrackers;
	const recentMessages = getRecentMessages(mesNum);
	const currentTracker = getCurrentTracker(mesNum);

	const contextPrompt = contextTemplate.replace("{{trackerSystemPrompt}}", trackerSystemPrompt).replace("{{characterDescriptions}}", characterDescriptions).replace("{{trackerExamples}}", trackerExamples).replace("{{recentMessages}}", recentMessages).replace("{{currentTracker}}", currentTracker);

	return contextPrompt;
}

/**
 * Retrieves the tracker system prompt, including character names.
 * @returns {string} The tracker system prompt.
 */
function getTrackerSystemPrompt() {
	const systemPrompt = extensionSettings.systemPrompt;

	let charNames = [name1];

	// Add group members if in a group
	if (selected_group) {
		const group = groups.find((g) => g.id == selected_group);
		var active = group.members.filter((m) => !group.disabled_members.includes(m));
		active.forEach((m) => {
			var char = characters.find((c) => c.avatar == m);
			charNames.push(char.name);
		});
	} else if (this_chid) {
		var char = characters[this_chid];
		charNames.push(char.name);
	}

	// Join character names
	let namesJoined;
	if (charNames.length === 1) namesJoined = charNames[0];
	else if (charNames.length === 2) namesJoined = charNames.join(" and ");
	else namesJoined = charNames.slice(0, -1).join(", ") + ", and " + charNames.slice(-1);

	return systemPrompt.replace("{{charNames}}", namesJoined);
}

/**
 * Retrieves character descriptions.
 * @returns {string} The character descriptions formatted string.
 */
function getCharacterDescriptions() {
	const characterDescriptions = [];

	// Get main character's persona
	let { persona } = getCharacterCardFields();
	if (persona) {
		characterDescriptions.push({ name: name1, description: persona });
	}

	// Get group members' descriptions if in a group
	if (selected_group) {
		const group = groups.find((g) => g.id == selected_group);
		let active = group.members.filter((m) => !group.disabled_members.includes(m));
		active.forEach((m) => {
			const char = characters.find((c) => c.avatar == m);
			characterDescriptions.push({ name: char.name, description: char.description });
		});
	} else if (this_chid) {
		const char = characters[this_chid];
		characterDescriptions.push({ name: char.name, description: char.description });
	}

	// Format descriptions using the template
	const characterDescriptionTemplate = extensionSettings.characterDescriptionTemplate;
	let charDescriptionString = "";
	for (const char of characterDescriptions) {
		let charDesc = characterDescriptionTemplate.replace("{{char}}", char.name).replace("{{charDescription}}", char.description);
		charDescriptionString += `${charDesc}\n\n`;
	}

	return charDescriptionString.trim();
}

/**
 * Retrieves recent messages up to a certain number.
 * @param {number} mesNum - The message number.
 * @returns {string|null} The recent messages formatted string.
 */
function getRecentMessages(mesNum) {
	const messages = chat.filter((c, index) => !c.is_system && index < mesNum).slice(-extensionSettings.numberOfMessages);

	if (messages.length === 0) return null;

	// Format messages using the template
	const recentMessages = messages
		.map((c) => {
			const name = c.name;
			const message = c.mes.replace(/<tracker>[\s\S]*?<\/tracker>/g, "").trim();
			let tracker;
			if (c.tracker) {
				try {
					tracker = jsonToYAML(c.tracker).trim();
				} catch (e) {
					warn("Failed to convert tracker to YAML:", e);
				}
			}

			let returnMessage = extensionSettings.recentMessagesTemplate.replace("{{char}}", name).replace("{{message}}", message);

			if (tracker) {
				returnMessage = returnMessage.replace(/{{#if tracker}}([\s\S]*?){{\/if}}/g, "$1");
				returnMessage = returnMessage.replace("{{trackerYAML}}", tracker);
			} else {
				returnMessage = returnMessage.replace(/{{#if tracker}}([\s\S]*?){{\/if}}/g, "");
			}

			return returnMessage;
		})
		.join("\n");

	return recentMessages;
}

/**
 * Retrieves the current tracker for a message.
 * @param {number} mesNum - The message number.
 * @returns {string} The current tracker in YAML format.
 */
function getCurrentTracker(mesNum) {
	debug("Getting current tracker for message:", { mesNum });
	const message = chat[mesNum - 1];
	const tracker = message.tracker;
	if (tracker) {
		return jsonToYAML(tracker);
	} else {
		return extensionSettings.defaultTracker;
	}
}

/**
 * Retrieves the request prompt from settings.
 * @returns {string} The request prompt.
 */
function getRequestPrompt() {
	const requestPrompt = extensionSettings.requestPrompt;
	return requestPrompt;
}

// #endregion

// #region UI Functions

/**
 * Displays the Tracker UI for a specific message.
 * @param {number} [mesNum] - The message number.
 */
function showTrackerUI(mesNum) {
	// Create the Tracker UI if it doesn't exist
	if ($("#trackerUI").length === 0) {
		const template = $("#zoomed_avatar_template").html();
		const controlBarHtml = `<div class="panelControlBar flex-container">
	<div id="trackerUIheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
	<div id="trackerUIClose" class="fa-solid fa-circle-xmark hoverglow dragClose"></div>
</div>`;
		const editorHeader = `<div id="trackerUIHeader">Tracker</div>`;
		const editorContainer = `<div id="trackerUIContents" class="scrollY"></div>`;
		const editorFooter = `<div id="trackerUIFooter">
	<button id="trackerUIViewButton" class="menu_button menu_button_default interactable" tabindex="0">View</button>
	<button id="trackerUIEditButton" class="menu_button menu_button_default interactable" tabindex="0">Edit</button>
	<button id="trackerUIEditRawButton" class="menu_button menu_button_default interactable" tabindex="0">Edit Raw</button>
	<button id="trackerUIGoToCurrentButton" class="menu_button menu_button_default interactable" tabindex="0">Go To Current</button>
	<button id="trackerUIRegenerateTracker" class="menu_button menu_button_default interactable" tabindex="0">Regenerate</button>
</div>`;
		const newElement = $(template);
		newElement.attr("id", "trackerUI").removeClass("zoomed_avatar").addClass("draggable").empty();
		newElement.append(controlBarHtml).append(editorHeader).append(editorContainer).append(editorFooter);
		$("#movingDivs").append(newElement);

		// Load UI state and make draggable
		loadMovingUIState();
		newElement.css("display", "flex").fadeIn(animation_duration);
		dragElement(newElement);

		// Close button event
		$("#trackerUIClose")
			.off("click")
			.on("click", function () {
				$("#trackerUI").fadeOut(animation_duration, () => {
					$("#trackerUIContents").empty();
					$("#trackerUI").remove();
				});
			});
	}

	const lastMessageID = getLastNonSystemMessageIndex();

	if (typeof mesNum !== "number") mesNum = lastMessageID;

	let tracker = chat[mesNum]?.tracker;

	if (!tracker) {
		if (extensionSettings.defaultTracker) tracker = JSON.parse(yamlToJSON(extensionSettings.defaultTracker));
		else tracker = {};
	}

	// Button events
	$("#trackerUIViewButton")
		.off("click")
		.on("click", () => {
			updateTrackerUI(getTracker(mesNum), mesNum, mesNum === lastMessageID);
		});

	$("#trackerUIEditButton")
		.off("click")
		.on("click", () => {
			updateTrackerUI(getTracker(mesNum), mesNum, mesNum === lastMessageID, true);
		});

	$("#trackerUIEditRawButton")
		.off("click")
		.on("click", () => {
			updateTrackerUI(getTracker(mesNum), mesNum, mesNum === lastMessageID, false, true);
		});

	$("#trackerUIGoToCurrentButton")
		.off("click")
		.on("click", () => {
			showTrackerUI();
		});

	$("#trackerUIRegenerateTracker")
		.off("click")
		.on("click", async () => {
			$("#trackerUIContents").empty();
			$("#trackerUIContents").text("Regenerating tracker...");
			const newTracker = await generateTracker(Math.max(mesNum - 1, 0));
			if (newTracker) {
				chat[mesNum].tracker = newTracker;
				saveChatDebounced();
				updateTrackerUI(newTracker, mesNum, mesNum === lastMessageID);
			}
		});

	// Initial UI update
	updateTrackerUI(tracker, mesNum, mesNum === lastMessageID);
}

/**
 * Updates the Tracker UI with the given tracker data.
 * @param {object} tracker - The tracker data.
 * @param {number} mesNum - The message number.
 * @param {boolean} [isCurrent=false] - Whether it's the current tracker.
 * @param {boolean} [editMode=false] - Whether to enable edit mode.
 * @param {boolean} [rawEdit=false] - Whether to enable raw edit mode.
 */
function updateTrackerUI(tracker, mesNum, isCurrent = false, editMode = false, rawEdit = false) {
	debug("Updating tracker UI with tracker:", { tracker, isCurrent });

	// Update header
	if (isCurrent) {
		$("#trackerUIHeader").text("Current Tracker");
	} else {
		$("#trackerUIHeader").text(`Message ${mesNum} Tracker`);
	}

	const container = document.getElementById("trackerUIContents");
	$(container).empty();

	// Choose the appropriate editor/viewer
	if (editMode) {
		createEditTrackerElement(tracker, container, (path, value) => {
			updatePath(tracker, [...path], value);
			chat[mesNum].tracker = JSON.parse(JSON.stringify(tracker));
			saveChatDebounced();
		});
	} else if (rawEdit) {
		const textarea = document.createElement("textarea");
		textarea.value = JSON.stringify(tracker, null, 2).replace(/\\n/g, "\n").replace(/\\t/g, "  ").replace(/\\"/g, '"');
		textarea.className = "tracker-field-textarea";
		container.append(textarea);
		setTimeout(() => resizeTextarea(textarea), 0);
		textarea.addEventListener("input", (e) => {
			const newValue = e.target.value;
			try {
				const newTracker = JSON.parse(newValue);
				chat[mesNum].tracker = newTracker;
				saveChatDebounced();
			} catch (error) {
				warn("Failed to parse tracker JSON:", error);
			}
		});
	} else {
		createViewTrackerElement(tracker, container);
	}

	// Toggle buttons
	if (editMode || rawEdit) $("#trackerUIViewButton").show();
	else $("#trackerUIViewButton").hide();

	if (!editMode) $("#trackerUIEditButton").show();
	else $("#trackerUIEditButton").hide();

	if (!rawEdit) $("#trackerUIEditRawButton").show();
	else $("#trackerUIEditRawButton").hide();

	if (isCurrent) $("#trackerUIGoToCurrentButton").hide();
	else $("#trackerUIGoToCurrentButton").show();
}

/**
 * Adds tracker information to chat messages.
 * @param {boolean} [refresh=false] - Whether to refresh existing trackers.
 * @param {string|null} [template=null] - The template to use.
 */
function addtrackerToMessages(refresh = false, template = null) {
	if (refresh) {
		let trackers = $("#chat .mes_tracker");
		let messages = trackers.closest(".mes");
		trackers.remove();
		messages.removeAttr("has_tracker");
		$("#chat .mes .mes_block .mes_tracker").remove();
	}

	if (!template) template = extensionSettings.mesTrackerTemplate;

	// Iterate over messages and add trackers
	$("#chat .mes:not(.smallSysMes,[has_tracker=true])").each(async (index, element) => {
		const mesId = $(element).attr("mesid");
		const mes = chat[mesId];
		const mesTracker = mes.tracker;
		if (mesTracker) {
			element.setAttribute("has_tracker", true);
			const textBlock = $(element).find(".mes_block .mes_text");
			const trackerHtml = renderMessageTrackerTemplate(template, mesTracker);
			const trackerElement = $(`<div class="mes_tracker">${trackerHtml}</div>`);
			textBlock.before(trackerElement);
		}
	});
}

// #endregion

// #region Event Handlers

/**
 * Handles changes to checkbox settings.
 * @param {string} settingName - The name of the setting.
 * @returns {function} The event handler function.
 */
function onSettingCheckboxInput(settingName) {
	return function () {
		const value = Boolean($(this).prop("checked"));
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
	};
}

/**
 * Handles input changes to textarea settings.
 * @param {string} settingName - The name of the setting.
 * @returns {function} The event handler function.
 */
function onSettingInputareaInput(settingName) {
	return function () {
		const value = $(this).val();
		extension_settings[extensionName.toLowerCase()][settingName] = value;
		saveSettingsDebounced();
		if (settingName === "mesTrackerTemplate") {
			addtrackerToMessages(true, value);
		}
	};
}

/**
 * Event handler for when the chat changes.
 * @param {object} args - The event arguments.
 */
function onChatChanged(args) {
	$(document).off("mouseup touchend", "#show_more_messages", addtrackerToMessages);
	if (!isEnabled()) return;
	log("Chat changed:", args);
	if ($("#trackerUI").length > 0) {
		showTrackerUI();
	}
	addtrackerToMessages(true);
	$(document).on("mouseup touchend", "#show_more_messages", addtrackerToMessages);
}

/**
 * Event handler for after combining prompts during generation.
 * @param {...any} args - The event arguments.
 */
const onGenerateAfterCombinePrompts = async (...args) => {
	if (!(isEnabled() && extensionSettings.debugMode)) return;
	debug("After combining prompts:", args);
};

/**
 * Event handler for after generation commands.
 * @param {string} type - The type of generation.
 * @param {object} options - Generation options.
 * @param {boolean} dryRun - Whether it's a dry run.
 */
async function onGenerateAfterCommands(type, options, dryRun) {
	var messageTypes = ["continue", "swipe", "regenerate", "impersonate"];
	if (!isEnabled() || chat.length == 0 || is_group_generating || (typeof type != "undefined" && !messageTypes.includes(type))) return;
	log("After generation commands:", [type, options, dryRun]);

	let messageID = getLastNonSystemMessageIndex();
	const lastMessage = chat[messageID];

	// Use existing tracker if available
	if (["continue", "swipe", "regenerate"].includes(type)) {
		let trackerYAML = "";
		if (lastMessage.tracker) {
			trackerYAML = jsonToYAML(lastMessage.tracker);
			await setExtensionPrompt("tracker", trackerYAML, 1, 0, true);
			return;
		}
	}

	// Generate new tracker
	const newTracker = await generateTracker(Math.max(messageID, 0));
	if (newTracker) {
		chat_metadata.tracker = newTracker;
		saveChatDebounced();
		var trackerYAML = jsonToYAML(newTracker);
	}

	debug("Generated tracker:", { newTracker });

	await setExtensionPrompt("tracker", trackerYAML, 1, 0, true);
}

/**
 * Event handler for when a message is received.
 * @param {number} mesId - The message ID.
 */
async function onMessageReceived(mesId) {
	if (!isEnabled()) return;
	log("Message received:", mesId);
	await generateMessageTracker(mesId);
}

/**
 * Event handler for when a message is sent.
 * @param {number} mesId - The message ID.
 */
async function onMessageSent(mesId) {
	if (!isEnabled()) return;
	log("Message sent:", mesId);
	await generateMessageTracker(mesId);
}

/**
 * Event handler for when a character's message is rendered.
 */
function onCharacterMessageRendered() {
	if (!isEnabled()) return;
	log("Character message rendered");
	addtrackerToMessages();
}

/**
 * Event handler for when a user's message is rendered.
 */
function onUserMessageRendered() {
	if (!isEnabled()) return;
	log("User message rendered");
	addtrackerToMessages();
}

/**
 * Generates a tracker for a specific message.
 * @param {number} mesId - The message ID.
 */
async function generateMessageTracker(mesId) {
	const tempTracker = chat_metadata.tracker;
	if (tempTracker) {
		chat[mesId].tracker = tempTracker;
		saveChatDebounced();
	} else {
		const newTracker = await generateTracker(mesId);
		if (newTracker) {
			chat[mesId].tracker = newTracker;
			saveChatDebounced();
		}
	}
}

/**
 * Clears the temporary tracker from chat metadata.
 */
function clearTempTracker() {
	if (!isEnabled()) return;
	log("Clearing temporary tracker");
	chat_metadata.tracker = null;
	saveChatDebounced();
}

// #endregion

// #region Initialization Code

// Initialize the extension when the document is ready
jQuery(async () => {
	await initSettings();

	// Load settings UI
	const settingsHtml = await $.get(`${extensionFolderPath}/html/settings.html`);
	$("#extensions_settings2").append(settingsHtml);

	// Load Tracker UI button
	const trackerUIButton = await $.get(`${extensionFolderPath}/html/trackerUIButton.html`);
	$("#extensionsMenu").append(trackerUIButton);

	// Tracker UI button event
	$("#tracker-ui-item").on("click", showTrackerUI);

	// Add tracker button to message template
	const showMessageTrackerButton = $(`<div title="Show Message Tracker" class="mes_button mes_tracker_button fa-solid fa-code interactable" tabindex="0"></div>`);
	$("#message_template .mes_buttons .extraMesButtons").prepend(showMessageTrackerButton);

	// Message tracker button event
	$(document).on("click", ".mes_tracker_button", async function () {
		const messageBlock = $(this).closest(".mes");
		const messageId = Number(messageBlock.attr("mesid"));
		showTrackerUI(messageId);
	});

	// Initialize settings UI values and listeners
	await setSettingsInitialValues();
	registerSettingsListeners();
});

// #endregion

// #region Event Registration

// Register event handlers
eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
eventSource.on(event_types.USER_MESSAGE_RENDERED, onUserMessageRendered);
eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onGenerateAfterCommands);
eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
eventSource.on(event_types.MESSAGE_SENT, onMessageSent);

// Optionally register debug event
if (extensionSettings.enabled && extensionSettings.debugMode) eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, onGenerateAfterCombinePrompts);

// #endregion
