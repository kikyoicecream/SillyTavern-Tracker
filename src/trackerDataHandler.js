import { chat, saveChatDebounced } from "../../../../../script.js";
import { debug } from "../lib/utils.js";

import { jsonToYAML, yamlToJSON } from "../lib/ymlParser.js";
import { TrackerPreviewManager } from "./ui/trackerPreviewManager.js";

export const FIELD_INCLUDE_OPTIONS = {
	DYNAMIC: "dynamic",
	STATIC: "static",
	ALL: "all",
};

export const OUTPUT_FORMATS = {
	JSON: "json",
	YAML: "yaml",
};

// Handlers for different field types
const FIELD_TYPES_HANDLERS = {
	STRING: handleString,
	ARRAY: handleArray,
	OBJECT: handleObject,
	FOR_EACH_OBJECT: handleForEachObject,
	ARRAY_OBJECT: handleObject, // Treat ARRAY_OBJECT as OBJECT
};

/**
 * Saves the updated tracker data to the chat object.
 *
 * @param {Object} tracker - The new tracker data to be saved.
 * @param {Object} backendObj - The backend object used for retrieving and updating the tracker.
 * @param {string} mesId - The message ID used to locate the original tracker in the chat object.
 */
export function saveTracker(tracker, backendObj, mesId, useUpdatedExtraFieldsAsSource = false) {
	const originalTracker = getTracker(chat[mesId].tracker, backendObj, FIELD_INCLUDE_OPTIONS.ALL, true, OUTPUT_FORMATS.JSON);
	const updatedTracker = updateTracker(originalTracker, tracker, backendObj, true, OUTPUT_FORMATS.JSON, useUpdatedExtraFieldsAsSource);
	chat[mesId].tracker = updatedTracker;

	saveChatDebounced();
	TrackerPreviewManager.updatePreview(mesId);

	return updatedTracker;
}

/**
 * Generates example trackers using the example values from the backendObject.
 * @param {Object} backendObject - The backend object defining the tracker structure.
 * @param {string} includeFields - Which fields to include ('dynamic', 'static', 'all').
 * @param {string} outputFormat - The desired output format ('json' or 'yaml').
 * @returns {Array} - An array of example trackers in the specified format.
 */
export function getExampleTrackers(backendObject, includeFields = FIELD_INCLUDE_OPTIONS.DYNAMIC, outputFormat = OUTPUT_FORMATS.JSON) {
	const trackers = [];
	const numExamples = getMaxExampleCount(backendObject);

	for (let i = 0; i < numExamples; i++) {
		const tracker = {};
		processFieldExamples(backendObject, tracker, includeFields, i);
		trackers.push(formatOutput(tracker, outputFormat));
	}

	return trackers;
}

/**
 * Generates a default tracker using default values from the backendObject.
 * @param {Object} backendObject - The backend object defining the tracker structure.
 * @param {string} includeFields - Which fields to include ('dynamic', 'static', 'all').
 * @param {string} outputFormat - The desired output format ('json' or 'yaml').
 * @returns {Object|string} - The default tracker in the specified format.
 */
export function getDefaultTracker(backendObject, includeFields = FIELD_INCLUDE_OPTIONS.DYNAMIC, outputFormat = OUTPUT_FORMATS.JSON) {
	const tracker = {};
	processFieldDefaults(backendObject, tracker, includeFields);
	return formatOutput(tracker, outputFormat);
}

/**
 * Converts a tracker to match the backendObject structure, filling missing fields with defaults.
 * @param {Object|string} trackerInput - The tracker object or YAML string.
 * @param {Object} backendObject - The backend object defining the tracker structure.
 * @param {string} includeFields - Which fields to include ('dynamic', 'static', 'all').
 * @param {boolean} includeUnmatchedFields - Whether to include unmatched fields in '_extraFields'.
 * @param {string} outputFormat - The desired output format ('json' or 'yaml').
 * @returns {Object|string} - The reconciled tracker in the specified format.
 */
export function getTracker(trackerInput, backendObject, includeFields = FIELD_INCLUDE_OPTIONS.DYNAMIC, includeUnmatchedFields = true, outputFormat = OUTPUT_FORMATS.JSON) {
	debug("Getting tracker:", { trackerInput, backendObject, includeFields, includeUnmatchedFields, outputFormat });
	let tracker = typeof trackerInput === "string" ? yamlToJSON(trackerInput) : trackerInput;
	const reconciledTracker = {};
	let extraFields = {};

	reconcileTracker(tracker, backendObject, reconciledTracker, extraFields, includeFields);

	if (includeUnmatchedFields) {
		extraFields = cleanEmptyObjects(extraFields);
		if ((typeof extraFields === "object" && Object.keys(extraFields).length > 0) || typeof extraFields === "string") {
			reconciledTracker._extraFields = extraFields;
		}
	}

	return formatOutput(reconciledTracker, outputFormat);
}

/**
 * Generates a tracker prompt string from the backendObject.
 * @param {Object} backendObject - The backend object defining the tracker structure.
 * @param {string} includeFields - Which fields to include ('dynamic', 'static', 'all').
 * @returns {string} - The tracker prompt string.
 */
export function getTrackerPrompt(backendObject, includeFields = FIELD_INCLUDE_OPTIONS.DYNAMIC) {
	const lines = [];
	buildPrompt(backendObject, includeFields, 0, lines);
	return lines.join("\n").trim();
}

/**
 * Updates an existing tracker with a new one, reconciling nested fields and '_extraFields'.
 * @param {Object|string} tracker - The existing tracker object or YAML string.
 * @param {Object|string} updatedTrackerInput - The updated tracker object or YAML string.
 * @param {Object} backendObject - The backend object defining the tracker structure.
 * @param {boolean} includeUnmatchedFields - Whether to include unmatched fields in '_extraFields'.
 * @param {string} outputFormat - The desired output format ('json' or 'yaml').
 * @returns {Object|string} - The updated tracker in the specified format.
 */
export function updateTracker(tracker, updatedTrackerInput, backendObject, includeUnmatchedFields = true, outputFormat = OUTPUT_FORMATS.JSON, useUpdatedExtraFieldsAsSource = false) {
	debug("Updating tracker:", { tracker, updatedTrackerInput, backendObject, includeUnmatchedFields, outputFormat });
	tracker = typeof tracker === "string" ? yamlToJSON(tracker) : tracker;
	const updatedTracker = typeof updatedTrackerInput === "string" ? yamlToJSON(updatedTrackerInput) : updatedTrackerInput;

	const finalTracker = {};
	let extraFields = {};

	reconcileUpdatedTracker(tracker, updatedTracker, backendObject, finalTracker, extraFields, "", includeUnmatchedFields, useUpdatedExtraFieldsAsSource);

	if (includeUnmatchedFields && !useUpdatedExtraFieldsAsSource) {
		extraFields = cleanEmptyObjects(extraFields);
		if ((typeof extraFields === "object" && Object.keys(extraFields).length > 0) || typeof extraFields === "string") {
			finalTracker._extraFields = extraFields;
		}
	} else if (useUpdatedExtraFieldsAsSource && updatedTracker._extraFields) {
		finalTracker._extraFields = updatedTracker._extraFields; // Directly use `_extraFields` from updatedTracker
	}

	return formatOutput(finalTracker, outputFormat);
}

/* Helper Functions */

function getMaxExampleCount(backendObject) {
	let maxCount = 0;
	function traverse(obj) {
		Object.values(obj).forEach((field) => {
			if (field.exampleValues) {
				maxCount = Math.max(maxCount, field.exampleValues.length);
			}
			if (field.nestedFields) {
				traverse(field.nestedFields);
			}
		});
	}
	traverse(backendObject);
	return maxCount;
}

function processFieldExamples(backendObj, trackerObj, includeFields, exampleIndex) {
	for (const field of Object.values(backendObj)) {
		if (!shouldIncludeField(field, includeFields)) continue;

		const handler = FIELD_TYPES_HANDLERS[field.type] || handleString;
		trackerObj[field.name] = handler(field, includeFields, exampleIndex);
	}
}

function processFieldDefaults(backendObj, trackerObj, includeFields) {
	for (const field of Object.values(backendObj)) {
		if (!shouldIncludeField(field, includeFields)) continue;

		const handler = FIELD_TYPES_HANDLERS[field.type] || handleString;
		trackerObj[field.name] = handler(field, includeFields);
	}
}

function reconcileTracker(trackerInput, backendObj, reconciledObj, extraFields, includeFields) {
	for (const field of Object.values(backendObj)) {
		if (!shouldIncludeField(field, includeFields)) continue;

		const fieldName = field.name;
		const trackerValue = trackerInput[fieldName];
		const handler = FIELD_TYPES_HANDLERS[field.type] || handleString;
		reconciledObj[fieldName] = handler(field, includeFields, null, trackerValue, extraFields);
	}

	// Handle extra fields
	for (const key in trackerInput) {
		if (!Object.prototype.hasOwnProperty.call(reconciledObj, key) && key !== "_extraFields") {
			extraFields[key] = trackerInput[key]; // Preserve original structure and data type
		}
	}

	// Reconcile _extraFields
	if (trackerInput._extraFields !== undefined) {
		extraFields = mergeExtraFields(extraFields, trackerInput._extraFields);
	}
}

function reconcileUpdatedTracker(tracker, updatedTracker, backendObj, finalTracker, extraFields, fieldPath = "", includeUnmatchedFields, useUpdatedExtraFieldsAsSource = false) {
	for (const field of Object.values(backendObj)) {
		const fieldName = field.name;
		const handler = FIELD_TYPES_HANDLERS[field.type] || handleString;
		const trackerValue = tracker[fieldName];
		const updatedValue = updatedTracker[fieldName];

		debug("Reconciling field:", { fieldName, fieldPath, trackerValue, updatedValue });
		finalTracker[fieldName] = handler(field, FIELD_INCLUDE_OPTIONS.ALL, null, updatedValue !== undefined ? updatedValue : trackerValue, extraFields);
	}

	if (includeUnmatchedFields) {
		for (const key in updatedTracker) {
			if (!Object.prototype.hasOwnProperty.call(finalTracker, key) && key !== "_extraFields") {
				extraFields[key] = updatedTracker[key]; // Preserve original structure and data type
			}
		}

		if (!useUpdatedExtraFieldsAsSource) {
			// Handle extra fields from the original tracker
			for (const key in tracker) {
				if (!Object.prototype.hasOwnProperty.call(finalTracker, key) && !Object.prototype.hasOwnProperty.call(extraFields, key) && key !== "_extraFields") {
					extraFields[key] = tracker[key]; // Preserve original structure and data type
				}
			}
		}
	}

	if (useUpdatedExtraFieldsAsSource && updatedTracker._extraFields) {
		extraFields = updatedTracker._extraFields; // Override with updatedTracker's `_extraFields`
	} else if (!useUpdatedExtraFieldsAsSource) {
		extraFields = mergeExtraFields(extraFields, tracker._extraFields);
		extraFields = mergeExtraFields(extraFields, updatedTracker._extraFields);
	}
}

function shouldIncludeField(field, includeFields) {
	if (includeFields === FIELD_INCLUDE_OPTIONS.ALL) return true;
	return (includeFields === FIELD_INCLUDE_OPTIONS.DYNAMIC && field.isDynamic) || (includeFields === FIELD_INCLUDE_OPTIONS.STATIC && !field.isDynamic);
}

function handleString(field, includeFields, index = null, trackerValue = null, extraFields = null, charIndex = null) {
	if (trackerValue !== null && typeof trackerValue === "string") {
		return trackerValue;
	} else if (trackerValue !== null) {
		// Type mismatch
		if (extraFields && typeof extraFields === "object") {
			extraFields[field.name] = trackerValue; 
		}
	}

	// If we have exampleValues and index, try parsing
	if (index !== null && field.exampleValues && field.exampleValues[index]) {
		const val = field.exampleValues[index];
		try {
			const arr = JSON.parse(val);
			if (Array.isArray(arr)) {
				if (charIndex !== null && charIndex < arr.length) {
					return arr[charIndex];
				}
				return arr[0];
			}
			return val;
		} catch {
			return val;
		}
	}

	return field.defaultValue || "Updated if Changed";
}

function handleArray(field, includeFields, index = null, trackerValue = null, extraFields = null, charIndex = null) {
	if (trackerValue !== null && Array.isArray(trackerValue)) {
		return trackerValue;
	} else if (trackerValue !== null) {
		// Type mismatch detected
		if (extraFields && typeof extraFields === "object") {
			extraFields[field.name] = trackerValue;
		}
	}

	let value;
	if (index !== null && field.exampleValues && field.exampleValues[index]) {
		try {
			const arr = JSON.parse(field.exampleValues[index]);
			if (Array.isArray(arr)) {
				if (charIndex !== null && charIndex < arr.length) {
					return arr[charIndex];
				}
				// If no charIndex or out of range, return the whole array or first element
				return arr;
			} else {
				value = arr; 
			}
		} catch {
			value = field.exampleValues[index];
		}
	} else {
		value = field.defaultValue || [];
	}
	return value;
}

function handleObject(field, includeFields, index = null, trackerValue = null, extraFields = null, charIndex = null) {
	const obj = {};
	const nestedFields = field.nestedFields || {};

	if (trackerValue !== null && typeof trackerValue === "object" && !Array.isArray(trackerValue)) {
		// Process nested fields
		for (const nestedField of Object.values(nestedFields)) {
			if (!shouldIncludeField(nestedField, includeFields)) continue;
			const handler = FIELD_TYPES_HANDLERS[nestedField.type] || handleString;
			const nestedValue = trackerValue[nestedField.name];
			obj[nestedField.name] = handler(nestedField, includeFields, null, nestedValue, extraFields && typeof extraFields === "object" ? extraFields : null, charIndex);
		}

		// Handle extra fields in the nested object
		for (const key in trackerValue) {
			if (!Object.prototype.hasOwnProperty.call(obj, key)) {
				if (extraFields && typeof extraFields === "object") {
					extraFields[field.name] = extraFields[field.name] || {};
					extraFields[field.name][key] = trackerValue[key]; 
				}
			}
		}
	} else {
		if (trackerValue !== null && typeof extraFields === "object") {
			extraFields[field.name] = trackerValue; 
		}
		// Use default values
		for (const nestedField of Object.values(nestedFields)) {
			if (!shouldIncludeField(nestedField, includeFields)) continue;
			const handler = FIELD_TYPES_HANDLERS[nestedField.type] || handleString;
			obj[nestedField.name] = handler(nestedField, includeFields, index, null, extraFields, charIndex);
		}
	}

	return obj;
}

function handleForEachObject(field, includeFields, index = null, trackerValue = null, extraFields = null, charIndex = null) {
	const nestedFields = field.nestedFields || {};
	let keys = [];

	// Parse the main field's example values into keys
	if (index !== null && field.exampleValues && field.exampleValues[index]) {
		try {
			keys = JSON.parse(field.exampleValues[index]);
		} catch {
			keys = [field.defaultValue || "default"];
		}
	} else {
		keys = [field.defaultValue || "default"];
	}

	// If trackerValue is correct structure, reconcile it. Otherwise, build defaults.
	if (trackerValue !== null && typeof trackerValue === "object" && !Array.isArray(trackerValue)) {
		// Process existing trackerValue
		const result = {};
		for (const [key, value] of Object.entries(trackerValue)) {
			const obj = {};
			let extraNestedFields = null;

			for (const nestedField of Object.values(nestedFields)) {
				if (!shouldIncludeField(nestedField, includeFields)) continue;
				const handler = FIELD_TYPES_HANDLERS[nestedField.type] || handleString;
				const nestedValue = value[nestedField.name];
				obj[nestedField.name] = handler(nestedField, includeFields, null, nestedValue, extraNestedFields, null);
			}

			// Handle extra fields in the nested object
			for (const nestedKey in value) {
				if (!Object.prototype.hasOwnProperty.call(obj, nestedKey)) {
					if (extraFields && typeof extraFields === "object") {
						extraNestedFields = extraNestedFields || {};
						extraNestedFields[nestedKey] = value[nestedKey]; 
					}
				}
			}

			if (extraFields && extraNestedFields) {
				extraFields[field.name] = extraFields[field.name] || {};
				extraFields[field.name][key] = extraNestedFields;
			}

			result[key] = obj;
		}
		return result;
	} else {
		if (trackerValue !== null && typeof extraFields === "object" && typeof trackerValue !== "object") {
			// Type mismatch: place the original trackerValue into extraFields
			extraFields[field.name] = trackerValue;
		}

		const result = {};
		// For each key, build an object of nested fields
		for (let cIndex = 0; cIndex < keys.length; cIndex++) {
			const characterName = keys[cIndex];
			const obj = {};
			for (const nestedField of Object.values(nestedFields)) {
				if (!shouldIncludeField(nestedField, includeFields)) continue;
				const handler = FIELD_TYPES_HANDLERS[nestedField.type] || handleString;
				obj[nestedField.name] = handler(nestedField, includeFields, index, null, extraFields, cIndex);
			}
			result[characterName] = obj;
		}
		return result;
	}
}

function buildPrompt(backendObj, includeFields, indentLevel, lines) {
	const indent = "  ".repeat(indentLevel);
	for (const field of Object.values(backendObj)) {
		if (!shouldIncludeField(field, includeFields)) continue;
		if (!field.prompt && !field.nestedFields) continue;

		if (field.type === "FOR_EACH_OBJECT" || field.nestedFields) {
			lines.push(`${indent}- **${field.name}:**${field.prompt ? " " + field.prompt : ""}`);
			buildPrompt(field.nestedFields, includeFields, indentLevel + 1, lines);
		} else {
			lines.push(`${indent}- **${field.name}:** ${field.prompt}`);
		}
	}
}

function formatOutput(tracker, outputFormat) {
	if (outputFormat === OUTPUT_FORMATS.YAML) {
		return jsonToYAML(tracker);
	}
	return tracker;
}

// Utility function to merge objects deeply or concatenate strings
function mergeExtraFields(extraFields, existingExtra) {
	if (existingExtra === undefined || existingExtra === null) {
		return extraFields;
	}

	if (typeof existingExtra === "object") {
		if (typeof extraFields === "object") {
			mergeDeep(extraFields, existingExtra);
			return extraFields;
		} else if (typeof extraFields === "string") {
			return extraFields + JSON.stringify(existingExtra);
		} else {
			return existingExtra;
		}
	} else if (typeof existingExtra === "string") {
		if (typeof extraFields === "object") {
			return JSON.stringify(extraFields) + existingExtra;
		} else if (typeof extraFields === "string") {
			return extraFields + existingExtra;
		} else {
			return existingExtra;
		}
	} else {
		return extraFields;
	}
}

// Utility function to merge objects deeply
function mergeDeep(target, source) {
	for (const key in source) {
		if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
			if (!target[key] || typeof target[key] !== "object") {
				target[key] = {};
			}
			mergeDeep(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	}
}

// Utility function to remove empty objects from extraFields
function cleanEmptyObjects(obj) {
	if (typeof obj !== "object" || obj === null) return obj;

	for (const key in obj) {
		if (typeof obj[key] === "object") {
			obj[key] = cleanEmptyObjects(obj[key]);
			if (obj[key] !== null && typeof obj[key] === "object" && Object.keys(obj[key]).length === 0) {
				delete obj[key];
			}
		}
	}

	return obj;
}
