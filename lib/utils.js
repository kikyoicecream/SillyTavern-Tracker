import { chat } from "../../../../../script.js";
import { extensionName, extensionSettings } from "../index.js";
import { generationTargets } from "../src/settings/settings.js";

// Logging functions
export function log(...msg) {
	console.log(`[${extensionName}]`, ...msg);
}

export function warn(...msg) {
	console.warn(`[${extensionName}] Warning`, ...msg);
}

export function error(...msg) {
	console.error(`[${extensionName}] Error`, ...msg);
}

export function debug(...msg) {
	if (extensionSettings.debugMode) {
		console.log(`[${extensionName} debug]`, ...msg);
	}
}

/**
 * Returns the index of the last non-system message in the chat.
 * @returns {number} Index of the last non-system message.
 */
export function getLastNonSystemMessageIndex() {
	const lastMessageIndex = chat
		.slice()
		.reverse()
		.findIndex((c) => !c.is_system && !c.owner_extension);
	if (lastMessageIndex === -1) return -1;
	return chat.length - 1 - lastMessageIndex;
}

export function isSystemMessage(mesId) {
	return chat[mesId]?.is_system && chat[mesId]?.owner_extension;
}

export function getNextNonSystemMessageIndex(mesId) {
	let nextMesId = -1;
	for (let i = mesId + 1; i < chat.length; i++) {
		if (!isSystemMessage(i)) {
			nextMesId = i;
			break;
		}
	}
	return nextMesId;
}

export function getPreviousNonSystemMessageIndex(mesId) {
	let prevMesId = -1;
	for (let i = mesId - 1; i >= 0; i--) {
		if (!isSystemMessage(i)) {
			prevMesId = i;
			break;
		}
	}
	return prevMesId;
}

export function shouldGenerateTracker(mesId, type) {
	debug("Checking if tracker should be generated for message", {mesId, type});
    const message = chat[mesId];
    const target = extensionSettings.generationTarget;

	const isUser = message?.is_user ?? false;

    if (target === generationTargets.NONE || mesId < extensionSettings.generateFromMessage) return false;

    let requiredTarget;

    if (type === "impersonate") {
        requiredTarget = [generationTargets.USER, generationTargets.BOTH];
    } else if (type === "continue" || type === "regenerate") {
        if (isUser) {
            requiredTarget = [generationTargets.USER, generationTargets.BOTH];
        } else {
            requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
        }
    } else if (type === "swipe") {
        if (isUser) return false;
        requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
    } else {
		if (isUser) requiredTarget = [generationTargets.USER, generationTargets.BOTH];
        else requiredTarget = [generationTargets.CHARACTER, generationTargets.BOTH];
    }

	debug("Required target", {mesId, type, requiredTarget, target});

    return requiredTarget.includes(target);
}


/**
 * Updates a nested property in an object using a path array.
 * @param {object} obj - The object to update.
 * @param {array} path - The path to the property.
 * @param {any} newValue - The new value to set.
 */
export function updatePath(obj, path, newValue) {
	const lastKey = path.pop();
	const target = path.reduce((acc, key) => acc[key], obj);
	target[lastKey] = newValue;
}
