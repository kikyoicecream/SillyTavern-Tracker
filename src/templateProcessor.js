// #region Template Rendering Function

/**
 * Renders a message tracker template with the provided data.
 * @param {string} template - The template string containing placeholders.
 * @param {object} data - The data object used for variable replacement.
 * @returns {string} - The rendered template string.
 */
export function renderMessageTrackerTemplate(template, data) {
	// Tokenize the template and process the tokens.
	const tokens = tokenize(template);
	return processTokens(tokens, data);
}

// #endregion

// #region Helper Functions

/**
 * Tokenizes the template string into an array of tokens.
 * @param {string} template - The template string.
 * @returns {Array} - The array of tokens.
 */
function tokenize(template) {
	const tokens = [];
	const regex = /{{\s*(\/?)\s*(#?)\s*([\w.]+)(?:\s+([^}]*?))?\s*}}/g;
	let cursor = 0;
	let match;

	// Iterate over the template string and extract tokens.
	while ((match = regex.exec(template)) !== null) {
		const index = match.index;

		// Add text tokens between placeholders.
		if (index > cursor) {
			tokens.push({
				type: "text",
				value: template.slice(cursor, index),
			});
		}

		const [fullMatch, closingSlash, hash, tag, params] = match;

		if (closingSlash) {
			// End tag token (e.g., {{/if}})
			tokens.push({
				type: "end",
				tag: tag.trim(),
			});
		} else if (hash) {
			// Start tag token (e.g., {{#if condition}})
			tokens.push({
				type: "start",
				tag: tag.trim(),
				params: params || "",
			});
		} else {
			// Variable token (e.g., {{variable}})
			tokens.push({
				type: "variable",
				value: tag.trim(),
			});
		}

		cursor = index + fullMatch.length;
	}

	// Add any remaining text after the last placeholder.
	if (cursor < template.length) {
		tokens.push({
			type: "text",
			value: template.slice(cursor),
		});
	}

	return tokens;
}

/**
 * Processes the tokens recursively to generate the final string.
 * @param {Array} tokens - The array of tokens.
 * @param {Object} data - The data object for variable replacement.
 * @param {Object} [context={}] - The context object for scope management.
 * @returns {string} - The processed string.
 */
function processTokens(tokens, data, context = {}) {
	let result = "";

	while (tokens.length > 0) {
		const token = tokens.shift();

		if (token.type === "text") {
			// Append plain text to the result.
			result += token.value;
		} else if (token.type === "variable") {
			// Replace variable placeholders with actual data.
			const value = getValue(token.value, data, context);
			result += value !== undefined ? value : "";
		} else if (token.type === "start") {
			// Handle control structures (e.g., if, foreach, join).
			if (token.tag === "if") {
				// Handle conditional blocks.
				const condition = token.params.trim();
				const [innerTokens, remainingTokens] = extractInnerTokens(tokens, "if");
				const value = getValue(condition, data, context);

				if (value) {
					result += processTokens(innerTokens, data, context);
				}
				tokens = remainingTokens;
			} else if (token.tag === "foreach") {
				// Handle loop blocks.
				const params = token.params.trim().split(/\s+/);
				const collectionName = params[0];
				const itemName = params[1];

				const collection = getValue(collectionName, data, context);

				if (collection && typeof collection === "object") {
					const [innerTokens, remainingTokens] = extractInnerTokens(tokens, "foreach");

					if (Array.isArray(collection)) {
						// Loop over arrays.
						collection.forEach((item, index) => {
							const newContext = {
								...context,
								[itemName]: item,
								[`${itemName}Index`]: index,
								_currentItemName: itemName, // Add this line
							};
							result += processTokens([...innerTokens], data, newContext);
						});
					} else {
						// Loop over objects.
						Object.keys(collection).forEach((key) => {
							const newContext = {
								...context,
								[itemName]: collection[key],
								[`${itemName}Key`]: key,
								_currentItemName: itemName, // Add this line
							};
							result += processTokens([...innerTokens], data, newContext);
						});
					}
					tokens = remainingTokens;
				} else {
					// Skip the foreach block if the collection is empty or not an object.
					const [, remainingTokens] = extractInnerTokens(tokens, "foreach");
					tokens = remainingTokens;
				}
			} else if (token.tag === "join") {
				// Handle join operations.
				const paramsTrimmed = token.params.trim();
				let separator = "";
				let arrayName = "";

				// Parse separator and array name.
				const match = paramsTrimmed.match(/^(['"])(.*?)\1\s+(.+)$/);
				if (match) {
					separator = match[2];
					arrayName = match[3];
				} else {
					const paramsArray = paramsTrimmed.split(/\s+/);
					separator = paramsArray.shift();
					arrayName = paramsArray.join(" ");
				}

				const array = getValue(arrayName, data, context);

				if (Array.isArray(array)) {
					result += array.join(separator);
				}

				// 'join' does not require an end tag, so continue processing.
			}
		} else if (token.type === "end") {
			// End tokens are handled during the extraction of inner tokens.
			continue;
		}
	}

	return result;
}

/**
 * Extracts inner tokens until the matching end tag is found.
 * @param {Array} tokens - The array of tokens.
 * @param {string} tagName - The tag name to match.
 * @returns {Array} - An array containing inner tokens and remaining tokens.
 * @throws {Error} - Throws an error if the end tag is not found.
 */
function extractInnerTokens(tokens, tagName) {
	let nested = 1;
	const innerTokens = [];

	// Extract tokens until the corresponding end tag is found.
	while (tokens.length > 0) {
		const token = tokens.shift();

		if (token.type === "start" && token.tag === tagName) {
			nested++;
		} else if (token.type === "end" && token.tag === tagName) {
			nested--;
			if (nested === 0) {
				return [innerTokens, tokens];
			}
		}
		innerTokens.push(token);
	}

	// If the end tag is not found, throw an error.
	throw new Error(`Unmatched {{#${tagName}}}`);
}

/**
 * Retrieves the value of a variable from data or context.
 * @param {string} variable - The variable name (can be nested using dot notation).
 * @param {Object} data - The data object.
 * @param {Object} context - The context object.
 * @returns {*} - The value of the variable or undefined if not found.
 */
function getValue(variable, data, context) {
	const parts = variable.split(".");
	let value = Object.prototype.hasOwnProperty.call(context, parts[0]) ? context[parts[0]] : data[parts[0]];

	// Check if the variable is the current item in a foreach loop and is an object or array.
	if (parts.length === 1 && variable === context._currentItemName && value && typeof value === "object") {
		// Return the key or index instead of the object or array.
		const key = context[`${variable}Key`] !== undefined ? context[`${variable}Key`] : context[`${variable}Index`];
		return key !== undefined ? key : "";
	}

	// Traverse nested properties if necessary.
	for (let i = 1; i < parts.length; i++) {
		if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, parts[i])) {
			value = value[parts[i]];
		} else {
			return undefined;
		}
	}

	return value;
}

// #endregion
