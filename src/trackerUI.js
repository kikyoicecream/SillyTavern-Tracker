import { saveChatDebounced, chat, animation_duration, deactivateSendButtons, activateSendButtons, scrollChatToBottom } from "../../../../../script.js";
import { dragElement } from "../../../../../scripts/RossAscends-mods.js";
import { loadMovingUIState } from "../../../../../scripts/power-user.js";
import { extensionFolderPath, extensionSettings } from "../index.js";
import { getTracker, generateTracker } from "./tracker.js";
import { warn, debug, getLastNonSystemMessageIndex, updatePath } from "../lib/utils.js";
import { yamlToJSON } from "../lib/ymlParser.js";
import { createEditTrackerElement, createViewTrackerElement, resizeTextarea } from "./trackerEditor.js";
import { renderMessageTrackerTemplate } from "./templateProcessor.js";

export async function initTrackerUI() {
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
}

/**
 * Displays the Tracker UI for a specific message.
 * @param {number} [mesNum] - The message number.
 */
export function showTrackerUI(mesNum) {
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

	if (!tracker || Object.keys(tracker).length === 0) {
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
			const manageStopButton = $("#mes_stop").css("display") == "none";
			if (manageStopButton) deactivateSendButtons();

			$("#trackerUIContents").empty();
			$("#trackerUIContents").text("Regenerating tracker...");

			let newTracker;
			try {
				newTracker = await generateTracker(Math.max(mesNum - 1, 0));
			} catch (error) {
				warn("Failed to generate tracker:", error);
			}
			if (newTracker && Object.keys(newTracker).length !== 0) {
				chat[mesNum].tracker = newTracker;
				saveChatDebounced();
				updateTrackerUI(newTracker, mesNum, mesNum === lastMessageID);
				updateTrackerPreview(false, extensionSettings.mesTrackerTemplate, mesNum);
			} else {
				updateTrackerUI(tracker, mesNum, mesNum === lastMessageID);
			}

			if (manageStopButton) activateSendButtons();
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
			updateTrackerPreview(false, extensionSettings.mesTrackerTemplate, mesNum);
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
				updateTrackerPreview(false, extensionSettings.mesTrackerTemplate, mesNum);
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
 * @param {number|null} [mesId=null] - The message ID to add a tracker to.
 */
export function updateTrackerPreview(refresh = false, template = null, mesId = null) {
	if (refresh) {
		let trackers = $("#chat .mes_tracker");
		let messages = trackers.closest(".mes");
		trackers.remove();
		messages.removeAttr("has_tracker");
	}

	let selector = "#chat .mes:not(.smallSysMes,[has_tracker=true])";

	if (mesId !== null) {
		selector = `#chat .mes[mesid="${mesId}"]`;
		$(`${selector} .mes_tracker`).remove();
	}

	if (!template) template = extensionSettings.mesTrackerTemplate;

	// Iterate over messages and add trackers
	$(selector).each(async (index, element) => {
		const mesId = $(element).attr("mesid");
		const mes = chat[mesId];
		const mesTracker = mes.tracker;
		debug("Adding tracker to message:", { mesId, mesTracker });
		if (mesTracker && Object.keys(mesTracker).length !== 0) {
			element.setAttribute("has_tracker", "true");
			const textBlock = $(element).find(".mes_block .mes_text");
			const trackerHtml = renderMessageTrackerTemplate(template, mesTracker);
			const trackerElement = $(`<div class="mes_tracker">${trackerHtml}</div>`);
			textBlock.before(trackerElement);
		}
	});

	if (mesId !== null && mesId == getLastNonSystemMessageIndex()) scrollChatToBottom();
}
