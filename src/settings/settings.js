import { saveSettingsDebounced } from "../../../../../../script.js";

import { extensionFolderPath, extensionSettings } from "../../index.js";
import { debug } from "../../lib/utils.js";
import { defaultSettings } from "./defaultSettings.js";
import { updateTrackerPreview } from "../trackerUI.js";

/**
 * Checks if the extension is enabled.
 * @returns {boolean} True if enabled, false otherwise.
 */
export function isEnabled() {
	debug("Checking if extension is enabled:", extensionSettings.enabled);
	return extensionSettings.enabled;
}

// #endregion

// #region Settings Initialization

/**
 * Initializes the extension settings by merging default and existing settings.
 */
export async function initSettings() {
	const settings = JSON.parse(JSON.stringify(extensionSettings));
	Object.assign(extensionSettings, defaultSettings, settings);
	saveSettingsDebounced();

	await loadSettingsUI();
}

/**
 * Sets the initial values of the settings UI elements.
 */
async function loadSettingsUI() {
	const settingsHtml = await $.get(`${extensionFolderPath}/html/settings.html`);
	$("#extensions_settings2").append(settingsHtml);

	setSettingsInitialValues();
	registerSettingsListeners();
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
	$("#tracker_number_of_messages").on("input", onSettingNumberInput("numberOfMessages"));
	$("#tracker_response_length").on("input", onSettingNumberInput("responseLength"));
	$("#tracker_debug").on("input", onSettingCheckboxInput("debugMode"));
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
		debug("Setting checkbox input:", settingName);
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
		debug("Setting input area input:", settingName);
		const value = $(this).val();
		extensionSettings[settingName] = value;
		saveSettingsDebounced();
		if (settingName === "mesTrackerTemplate") {
			updateTrackerPreview(true, value);
		}
	};
}

/**
 * Handles input changes to numeric settings.
 * @param {string} settingName - The name of the setting.
 * @returns {function} The event handler function.
 */
function onSettingNumberInput(settingName) {
	return function () {
		debug("Setting number input:", settingName);
		let value = parseFloat($(this).val());

		// Handle invalid number input (e.g., empty or NaN)
		if (isNaN(value)) {
			debug("Invalid number input. Setting value to 0 by default.");
			value = 0;
		}

		extensionSettings[settingName] = value;
		saveSettingsDebounced();
	};
}

// #endregion
