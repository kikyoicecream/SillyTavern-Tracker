# SillyTavern Tracker Extension

An extension for SillyTavern that provides a customizable tracking feature to monitor character interactions and story elements.

## Features

### Implemented

1. **Automatic Tracker Prompt Generation**: Automatically generates a tracking prompt based on the previous message's context.
2. **Data Storage**: Stores all tracking data within the message metadata, keeping it separate from the main content.
3. **Per-Message Tracker Editing**: Includes a user interface (UI) for editing tracking details on a per-message basis.
4. **In-Message Tracking Display**: Adds a customizable tracking UI element on each message, allowing you to view tracked data inline with messages.
5. **Comprehensive Settings Panel**: Access a settings panel to modify any part of the prompt template used for tracker generation.

### Planned

1. **Savable Presets**: Add the ability to create and save different prompt configurations for easy access to various tracking setups.

## Installation and Usage

### Installation

1. Open the `Extensions` menu in SillyTavern.
2. Click the `Install Extension` button.
3. Paste this repository URL to install the extension: `https://github.com/kaldigo/SillyTavern-Tracker`

### Usage

1. Install the extension following the steps above.
2. Start or continue a chat in SillyTavern, and the tracker element will automatically appear on each message that has generated tracking data. This tracker reflects the state of the previous message, so it won’t update with the current message until the next prompt is generated.
   
   ![image](https://github.com/user-attachments/assets/0710667e-8c9c-46cb-980f-421e5f9aa114)
   
   ![image](https://github.com/user-attachments/assets/1f1bc1cf-8c7c-4694-9245-2cc9e3ca4f0c)



4. To edit or generate tracking data for any message, click the tracker button on that message, or access it via the `Chat Extensions` menu. This opens a tracker interface with options to view, edit, or regenerate tracking information. You can use either a simple editor or edit the raw JSON directly if more customization is needed.
   
   ![image](https://github.com/user-attachments/assets/9722f0d5-8d0e-4998-87aa-7cd3423e5421)
   
   ![image](https://github.com/user-attachments/assets/139d2847-8502-4f86-a9ee-91ae51cac6f4)
   
   ![image](https://github.com/user-attachments/assets/968559a5-d8df-4945-9552-8124c29431fc)
   
   ![image](https://github.com/user-attachments/assets/d99e5353-9eb8-4f83-8381-dc5195fb8e9f)
   
   ![image](https://github.com/user-attachments/assets/279dfa4c-39fb-4df6-ad01-17df61cf0c36)



## Settings

Access the extension settings in the `Tracker` section under SillyTavern’s `Extensions` menu to customize tracking preferences.

### Customizable Options

- **Prompt Template**: The tracker generation prompt is divided into several parts, each with its own set of supported macros. A context template combines these parts for seamless integration.
- **Message Tracker Display**: Customize the appearance of the message tracker element with a template editor, allowing it to fit your display preferences.
- **Additional Settings**: Adjust the number of recent messages included in the tracking process and set a token length override for prompt generation.

![image](https://github.com/user-attachments/assets/1890d7e4-5863-493b-85b8-b85d5fdc6db8)

![image](https://github.com/user-attachments/assets/53b4a1dd-8692-4598-b8d8-8a5689862696)
