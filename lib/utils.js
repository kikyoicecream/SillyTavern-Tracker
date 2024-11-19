import { chat } from "../../../../../script.js";
import { extensionName, extensionSettings } from "../index.js";

// Logging functions
export function log(...msg) {
	console.log(`[${extensionName}] `, ...msg);
}

export function warn(...msg) {
	console.warn(`[${extensionName}] Warning `, ...msg);
}

export function error(...msg) {
	console.error(`[${extensionName}] Error: `, ...msg);
}

export function debug(...msg) {
	if (extensionSettings.debugMode) {
		console.log(`[${extensionName} debug] `, ...msg);
	}
}

/**
 * Returns the index of the last non-system message in the chat.
 * @returns {number} Index of the last non-system message.
 */
export function getLastNonSystemMessageIndex() {
	return (
		chat.length -
		1 -
		chat
			.slice()
			.reverse()
			.findIndex((c) => !c.is_system && !c.is_thoughts)
	);
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
