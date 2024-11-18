import { saveChatConditional, generateRaw, chat, chat_metadata, characters, this_chid, getCharacterCardFields, name1, setExtensionPrompt, deactivateSendButtons, activateSendButtons, getBiasStrings, system_message_types, sendSystemMessage, sendMessageAsUser, removeMacros, stopGeneration } from "../../../../../script.js";
import { groups, selected_group } from "../../../../../scripts/group-chats.js";
import { hasPendingFileAttachment } from "../../../../../scripts/chats.js";
import { log, warn, debug, getLastNonSystemMessageIndex } from "../lib/utils.js";
import { yamlToJSON, jsonToYAML } from "../lib/ymlParser.js";
import { extensionSettings } from "../index.js";
import { updateTrackerPreview } from "./trackerUI.js";

// #region Constants and Utility Functions

/**
 * Retrieves the tracker object for a given message number.
 * @param {number} mesNum - The message number.
 * @returns {object} The tracker object.
 */
export function getTracker(mesNum) {
	let tracker = chat[mesNum]?.tracker;

	if (!tracker) {
		if (extensionSettings.defaultTracker) tracker = JSON.parse(yamlToJSON(extensionSettings.defaultTracker));
		else tracker = {};
	}

	return tracker;
}

// #endregion

// #region Tracker Generation Functions

/**
 * Generates a new tracker for a given message number.
 * @param {number} mesNum - The message number.
 * @returns {object|null} The new tracker object or null if failed.
 */
export async function generateTracker(mesNum) {
	if (mesNum != 0 && !mesNum) return null;

	// Build system and request prompts
	const systemPrompt = getSystemPrompt(mesNum);
	const requestPrompt = getRequestPrompt();

	let responseLength = extensionSettings.responseLength > 0 ? extensionSettings.responseLength : null;

	// Generate tracker using the AI model
	log("Generating tracker with prompts:", { systemPrompt, requestPrompt, responseLength, mesNum });
	var tracker = await generateRaw(requestPrompt, null, false, false, systemPrompt, responseLength);
	debug("Generated tracker:", { tracker });

	let newTracker;
	try {
		const trackerContent = tracker.match(/<tracker>([\s\S]*?)<\/tracker>/);
		const result = trackerContent ? trackerContent[1].trim() : null;
		newTracker = JSON.parse(yamlToJSON(result));
	} catch (error) {
		error("Failed to parse tracker:", tracker, error);
	}

	debug("Parsed tracker:", { newTracker });

	return newTracker;
}

export async function injectTracker(tracker) {
	let trackerYAML = jsonToYAML(tracker);
	await setExtensionPrompt("tracker", trackerYAML, 1, 0, true);
}

export async function prepareMessageGeneration(type, options, dryRun) {
	const manageStopButton = $("#mes_stop").css("display") == "none";
	if (manageStopButton) deactivateSendButtons();

	if (type !== "regenerate" && type !== "swipe" && type !== "quiet" && type !== "impersonate" && !dryRun) {
		let textareaText = String($("#send_textarea").val());
		$("#send_textarea")
			.val("")[0]
			.dispatchEvent(new Event("input", { bubbles: true }));
		let { messageBias } = getBiasStrings(textareaText, type);
		const noAttachTypes = ["regenerate", "swipe", "impersonate", "quiet", "continue", "ask_command"];
		if ((textareaText !== "" || (hasPendingFileAttachment() && !noAttachTypes.includes(type))) && !options.automatic_trigger) {
			if (messageBias && !removeMacros(textareaText)) {
				sendSystemMessage(system_message_types.GENERIC, " ", {
					bias: messageBias,
				});
			} else {
				await sendMessageAsUser(textareaText, messageBias);
			}
		}
	}

	chat_metadata.tracker = null;

	const mesId = getLastNonSystemMessageIndex();
	const lastMes = chat[mesId];

	// Use existing tracker if available
	if ("regenerate" == type) {
		if (!lastMes.tracker && Object.keys(lastMes.tracker).length == 0) {
			lastMes.tracker = await generateTracker(mesId);
		}

		chat_metadata.tracker = lastMes.tracker;
		await saveChatConditional();
		await injectTracker(lastMes.tracker);

		if (manageStopButton) activateSendButtons();

		return;
	} else if (["continue", "swipe"].includes(type)) {
		if (!lastMes.tracker && Object.keys(lastMes.tracker).length == 0) {
			lastMes.tracker = await generateTracker(mesId);
			await saveChatConditional();
		}

		await injectTracker(lastMes.tracker);

		if (manageStopButton) activateSendButtons();

		return;
	} else {
		const tracker = await generateTracker(mesId);
		if (tracker) {
			chat_metadata.tracker = tracker;
			await saveChatConditional();
			await injectTracker(tracker);
		} else {
			stopGeneration();
		}

		if (manageStopButton) activateSendButtons();
	}
}

export async function addTrackerToMessage(mesId) {
	if(chat[mesId].is_thoughts) return;
	const manageStopButton = $("#mes_stop").css("display") == "none";
	if (manageStopButton) deactivateSendButtons();

	let tracker = chat_metadata.tracker;
	debug("Adding tracker to message:", { mesId, tracker });
	if (!tracker || Object.keys(tracker).length === 0) {
		debug("Generating new tracker for message:", mesId);
		tracker = await generateTracker(mesId - 1);
	}
	debug("Generated tracker:", tracker);
	if (tracker && Object.keys(tracker).length !== 0) {
		debug("Adding tracker to message:", [chat[mesId], tracker]);
		chat[mesId].tracker = tracker;
		chat_metadata.tracker = null;
		await saveChatConditional();
		updateTrackerPreview();
	}

	if (manageStopButton) activateSendButtons();
}

// #endregion

// #region Tracker Prompt Functions

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
	const messages = chat.filter((c, index) => !c.is_system && index <= mesNum).slice(0 - extensionSettings.numberOfMessages);

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
	const message = chat[mesNum];
	const tracker = message.tracker;
	if (tracker && Object.keys(tracker).length !== 0) {
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
