import { eventSource, event_types } from "../../../../script.js";
import { extension_settings } from "../../../../../../scripts/extensions.js";

import { textgenerationwebui_settings as textgen_settings, textgen_types } from "../../../../scripts/textgen-settings.js";
import { oai_settings } from "../../../../scripts/openai.js";
import { nai_settings } from "../../../../scripts/nai-settings.js";
import { horde_settings } from "../../../../scripts/horde.js";
import { kai_settings } from "../../../../scripts/kai-settings.js";

import { initSettings } from "./src/settings/settings.js";
import { initTrackerUI } from "./src/trackerUI.js";
import { eventHandlers } from "./src/events.js";

import { registerGenerationMutexListeners } from './lib/interconnection.js';

export const extensionName = "Tracker";
const extensionNameLong = `SillyTavern-${extensionName}`;
export const extensionFolderPath = `scripts/extensions/third-party/${extensionNameLong}`;

if (!extension_settings[extensionName.toLowerCase()]) extension_settings[extensionName.toLowerCase()] = {};
export const extensionSettings = extension_settings[extensionName.toLowerCase()];

jQuery(async () => {
	await initSettings();
	await initTrackerUI();
});

registerGenerationMutexListeners();

eventSource.on(event_types.CHAT_CHANGED, eventHandlers.onChatChanged);
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, eventHandlers.onCharacterMessageRendered);
eventSource.on(event_types.USER_MESSAGE_RENDERED, eventHandlers.onUserMessageRendered);
eventSource.on(event_types.GENERATION_AFTER_COMMANDS, eventHandlers.onGenerateAfterCommands);
//eventSource.on(event_types.MESSAGE_RECEIVED, eventHandlers.onMessageReceived);
//eventSource.on(event_types.MESSAGE_SENT, eventHandlers.onMessageSent);
