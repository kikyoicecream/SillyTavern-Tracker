import { debug } from "../index.js";

// #region Utility Functions

/**
 * Creates a button element with the specified text, class, and click action.
 * @param {string} text - The text content of the button.
 * @param {string} className - The CSS class(es) to apply to the button.
 * @param {function} onClickAction - The function to execute on button click.
 * @returns {HTMLButtonElement} The created button element.
 */
function createButton(text, className, onClickAction) {
	const button = document.createElement("button");
	button.textContent = text;
	button.className = className + " menu_button menu_button_icon interactable";
	button.onclick = onClickAction;
	return button;
}

/**
 * Clones the structure of a given item recursively.
 * @param {*} item - The item to clone the structure from.
 * @returns {*} The cloned structure.
 */
function cloneStructure(item) {
	if (Array.isArray(item)) {
		return item.map(() => cloneStructure(item[0]));
	}
	if (typeof item === "object" && item !== null) {
		return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, cloneStructure(v)]));
	}
	return "";
}

/**
 * Resizes a textarea to fit its content.
 * @param {HTMLTextAreaElement} textarea - The textarea element to resize.
 */
export function resizeTextarea(textarea) {
	textarea.style.height = "auto";
	textarea.style.height = textarea.scrollHeight + 5 + "px";
}

// #endregion

// #region Modal Functions

/**
 * Creates and displays a modal for adding a new field.
 * @param {function} onSubmit - Callback function when the modal is submitted.
 * @param {Array|null} siblings - Array of sibling items, used for cloning structure.
 * @param {boolean} isAddingToArray - Indicates if adding to an array.
 */
function createAddFieldModal(onSubmit, siblings = null, isAddingToArray = false) {
	debug("Opening Add Field Modal");

	const modal = document.createElement("dialog");
	modal.className = "tracker-new-field-modal popup popup--animation-fast";

	const modalContent = document.createElement("div");
	modalContent.className = "tracker-modal-content";

	modalContent.innerHTML = `<h3 class="tracker-modal-title">Add New Field</h3>`;

	let keyInput;
	if (!isAddingToArray) {
		modalContent.innerHTML += `<label class="tracker-modal-key-label">Field Key:</label>`;
		keyInput = document.createElement("input");
		keyInput.type = "text";
		keyInput.placeholder = "Enter key name";
		keyInput.className = "tracker-modal-key-input text_pole";
		modalContent.appendChild(keyInput);
	}

	modalContent.innerHTML += `<label class="tracker-modal-type-label">Select Type:</label>`;
	const typeSelect = document.createElement("select");
	typeSelect.className = "tracker-modal-type-select";

	["String", "Array", "Object", ...(siblings ? ["Clone Sibling Structure"] : [])].forEach((option) => {
		const optionElement = document.createElement("option");
		optionElement.value = option.toLowerCase().replace(/ /g, "_");
		optionElement.textContent = option;
		typeSelect.appendChild(optionElement);
	});
	modalContent.appendChild(typeSelect);

	// Add Field button
	modalContent.appendChild(
		createButton("Add Field", "tracker-modal-submit-button", () => {
			const type = typeSelect.value;
			const key = keyInput ? keyInput.value.trim() : null;

			if (keyInput && !key) {
				alert("Please enter a key name");
				return;
			}

			debug(`Adding new field: key='${key}', type='${type}'`);

			let newItem;
			newItem = type === "object" ? {} : type === "array" ? [] : type === "clone_sibling_structure" && siblings ? cloneStructure(siblings[0]) : "";

			onSubmit(key, newItem);
			document.body.removeChild(modal);
		})
	);

	// Cancel button
	modalContent.appendChild(
		createButton("Cancel", "tracker-modal-cancel-button", () => {
			debug("Add Field Modal cancelled");
			document.body.removeChild(modal);
		})
	);

	modal.appendChild(modalContent);
	document.body.appendChild(modal);
	modal.showModal();
}

// #endregion

// #region Tracker Element Functions

/**
 * Creates an editable tracker element in the specified container.
 * @param {object} tracker - The tracker object to edit.
 * @param {HTMLElement} container - The container to render the tracker in.
 * @param {function} onUpdateCallback - Callback function when the tracker is updated.
 */
export function createEditTrackerElement(tracker, container, onUpdateCallback) {
	container.innerHTML = "";

	/**
	 * Recursively creates fields for the tracker object.
	 * @param {string|number} key - The key of the field.
	 * @param {*} value - The value of the field.
	 * @param {object|Array} parent - The parent object or array.
	 * @param {Array} path - The path to the current field.
	 * @returns {HTMLElement} The created field element.
	 */
	function createField(key, value, parent, path) {
		const wrapper = document.createElement("div");
		let className = "tracker-field-wrapper";
		if (Array.isArray(value)) {
			className += " tracker-array-wrapper";
		} else if (typeof value === "object" && value !== null) {
			className += " tracker-object-wrapper";
		}
		wrapper.className = className;

		// Create label for non-array parents
		if (!Array.isArray(parent)) {
			const label = document.createElement("label");
			label.textContent = key;
			let className = "tracker-field-label";
			if (Array.isArray(value)) {
				className += " tracker-array-label";
			} else if (typeof value === "object" && value !== null) {
				className += " tracker-object-label";
			}
			label.className = className;
			wrapper.appendChild(label);
		}

		const currentPath = [...path, key];

		// Handle array values
		if (Array.isArray(value)) {
			const arrayContainer = document.createElement("div");
			arrayContainer.className = "tracker-array-container";

			value.forEach((item, index) => arrayContainer.appendChild(createField(index, item, value, currentPath)));

			// Add Item button
			arrayContainer.appendChild(
				createButton("+ Add Item", "tracker-add-item-button", () => {
					createAddFieldModal(
						(_, newItem) => {
							debug(`Adding item to array at path ${currentPath.join(".")}`);
							value.push(newItem);
							onUpdateCallback(currentPath, value);
							createEditTrackerElement(tracker, container, onUpdateCallback);
						},
						value,
						true
					);
				})
			);
			wrapper.appendChild(arrayContainer);

			// Handle object values
		} else if (typeof value === "object" && value !== null) {
			const objectContainer = document.createElement("div");
			objectContainer.className = "tracker-object-container";

			Object.entries(value).forEach(([subKey, subValue]) => objectContainer.appendChild(createField(subKey, subValue, value, currentPath)));

			// Add Field button
			objectContainer.appendChild(
				createButton("+ Add Field", "tracker-add-field-button", () => {
					createAddFieldModal(
						(newKey, newItem) => {
							debug(`Adding field '${newKey}' to object at path ${currentPath.join(".")}`);
							value[newKey] = newItem;
							onUpdateCallback(currentPath, value);
							createEditTrackerElement(tracker, container, onUpdateCallback);
						},
						Object.values(value),
						false
					);
				})
			);
			wrapper.appendChild(objectContainer);

			// Handle primitive values
		} else {
			const inputContainer = document.createElement("div");
			inputContainer.className = "tracker-input-container";
			const textarea = Object.assign(document.createElement("textarea"), {
				value,
				className: "tracker-field-textarea",
				rows: 1,
			});

			textarea.oninput = () => {
				resizeTextarea(textarea);
				parent[key] = textarea.value;
				debug(`Updated field at path ${currentPath.join(".")}:`, textarea.value);
				onUpdateCallback(currentPath, textarea.value);
			};
			inputContainer.appendChild(textarea);

			// Remove button
			inputContainer.appendChild(
				createButton("", "tracker-remove-button fa-solid fa-trash-can", () => {
					debug(`Removing field at path ${currentPath.join(".")}`);
					Array.isArray(parent) ? parent.splice(key, 1) : delete parent[key];
					onUpdateCallback(currentPath.slice(0, -1), parent);
					createEditTrackerElement(tracker, container, onUpdateCallback);
				})
			);
			wrapper.appendChild(inputContainer);
			setTimeout(() => resizeTextarea(textarea), 0);
		}
		return wrapper;
	}

	// Start creating fields from the tracker object
	Object.entries(tracker).forEach(([key, value]) => container.appendChild(createField(key, value, tracker, [])));
}

/**
 * Creates a read-only view of the tracker in the specified container.
 * @param {object} tracker - The tracker object to display.
 * @param {HTMLElement} container - The container to render the tracker in.
 */
export function createViewTrackerElement(tracker, container) {
	container.innerHTML = "";

	/**
	 * Recursively creates view fields for the tracker object.
	 * @param {string|number} key - The key of the field.
	 * @param {*} value - The value of the field.
	 * @returns {HTMLElement} The created field element.
	 */
	function createViewField(key, value) {
		const wrapper = document.createElement("div");
		let className = "tracker-view-field-wrapper";
		if (!Array.isArray(value) && typeof value === "object" && value !== null) {
			className += " tracker-view-object-wrapper";
		}
		wrapper.className = className;

		const label = document.createElement("label");
		label.textContent = key;
		label.className = "tracker-view-field-label";
		wrapper.appendChild(label);

		let displayValue;

		if (Array.isArray(value)) {
			displayValue = value.join("; ");
		} else if (typeof value === "object" && value !== null) {
			const objectContainer = document.createElement("div");
			objectContainer.className = "tracker-view-object-container";

			Object.entries(value).forEach(([subKey, subValue]) => {
				const subField = createViewField(subKey, subValue);
				objectContainer.appendChild(subField);
			});

			wrapper.appendChild(objectContainer);
			return wrapper;
		} else {
			displayValue = value;
		}

		const textDisplay = document.createElement("div");
		textDisplay.className = "tracker-view-text-display";
		textDisplay.textContent = displayValue;
		wrapper.appendChild(textDisplay);

		return wrapper;
	}

	// Start creating view fields from the tracker object
	Object.entries(tracker).forEach(([key, value]) => {
		const field = createViewField(key, value);
		container.appendChild(field);
	});
}

// #endregion
