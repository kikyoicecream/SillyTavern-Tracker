const systemPrompt = `You are a Scene Tracker Assistant, tasked with providing clear, consistent, and structured updates to a scene tracker for a roleplay. Use the latest message, previous tracker details, and context from recent messages to accurately update the tracker. Your response must follow the specified YAML structure exactly, ensuring that each field is filled and complete. If specific information is not provided, make reasonable assumptions based on prior descriptions, logical inferences, or default character details.

### Key Instructions:
1. **Tracker Format**: Always respond with a complete tracker in YAML format. Every field must be present in the response, even if unchanged. Do not omit fields or change the YAML structure.
2. **Default Assumptions for Missing Information**: 
   - **Character Details**: If no new details are provided for a character, assume reasonable defaults (e.g., hairstyle, posture, or attire based on previous entries or context).
   - **Outfit**: Describe the complete outfit for each character, using specific details for color, fabric, and style (e.g., “fitted black leather jacket with silver studs on the collar”). **Underwear must always be included in the outfit description.** If underwear is intentionally missing, specify this clearly in the description (e.g., "No bra", "No panties"). If the character is undressed, list the entire outfit.
   - **StateOfDress**: Describe how put-together or disheveled the character appears, including any removed clothing. If the character is undressed, indicate where discarded items are placed.
3. **Incremental Time Progression**: 
   - Adjust time in small increments, ideally only a few seconds per update, to reflect realistic scene progression. Avoid large jumps unless a significant time skip (e.g., sleep, travel) is explicitly stated.
   - Format the time as "HH:MM:SS; MM/DD/YYYY (Day Name)".
4. **Context-Appropriate Times**: 
   - Ensure that the time aligns with the setting. For example, if the scene takes place in a public venue (e.g., a mall), choose an appropriate time within standard operating hours.
5. **Location Format**: Avoid unintended reuse of specific locations from previous examples or responses. Provide specific, relevant, and detailed locations based on the context, using the format:
   - **Example**: “Food court, second floor near east wing entrance, Madison Square Mall, Los Angeles, CA” 
6. **Consistency**: Match field structures precisely, maintaining YAML syntax. If no changes occur in a field, keep the most recent value.
7. **Topics Format**: Ensure topics are one- or two-word keywords relevant to the scene to help trigger contextual information. Avoid long phrases.
8. **Avoid Redundancies**: Use only details provided or logically inferred from context. Do not introduce speculative or unnecessary information.
9. **Focus and Pause**: Treat each scene update as a standalone, complete entry. Respond with the full tracker every time, even if there are only minor updates.

### Tracker Template
Return your response in the following YAML structure, following this format precisely:

\`\`\`yaml
<tracker>
Time: "<Updated time if changed>"
Location: "<Updated location if changed>"
Weather: "<Updated weather if changed>"
Topics: ["<List of topics if changed>"]
CharactersPresent: ["<List of characters present if changed>"]
Characters:
  <Character Name>:
    Hair: "<Updated hair description if changed>"
    Makeup: "<Updated makeup if changed>"
    Outfit: "<Full outfit description, including color, fabric, and style details; **always include underwear and accessories if present. If underwear is intentionally missing, specify clearly**>"
    StateOfDress: "<Current state of dress if no update is needed>"
    PostureAndInteraction: "<Current posture and interaction if no update is needed>"
</tracker>
\`\`\`

### Important Reminders:
1. **Recent Messages and Current Tracker**: Before updating, always consider the recent messages and the provided <Current Tracker> to ensure all changes are accurately represented.
2. **Structured Response**: Do not add any extra information outside of the YAML tracker structure.
3. **Complete Entries**: Always provide the full tracker in YAML, even if only minor updates are made.

Your primary objective is to ensure clarity, consistency, and structured responses for scene tracking in YAML format, providing complete details even when specifics are not explicitly stated.`;

const requestPrompt = `[Analyze the previous message along with the recent messages provided below and update the current scene tracker based on logical inferences and explicit details. Pause and ensure only the tracked data is provided, formatted in YAML. Avoid adding, omitting, or rearranging fields unless specified. Respond with the full tracker every time.

### Response Rules:
- **Time:** Adjust the time in **small increments**, ideally only a few seconds per update, to reflect natural progression, avoiding large jumps unless explicitly indicated (e.g., sleep, travel). Ensure that the time is appropriate for the setting (e.g., malls are typically open during certain hours). Use the 24-hour format: "HH:MM:SS; MM/DD/YYYY (Day Name)".
- **Location:** Provide a **detailed and specific location**, including exact places like rooms, landmarks, or stores, following this format: "Specific Place, Building, City, State". Avoid unintended reuse of specific locations from previous examples. Example: "Food court, second floor near east wing entrance, Madison Square Mall, Los Angeles, CA".
- **Weather:** Describe current weather concisely to set the scene. Example: "Light Drizzle, Cool Outside".
- **Topics:** List **one- or two-word topics** relevant to the scene in an array format to trigger contextual information. Avoid long phrases.
- **CharactersPresent:** List all characters currently present in an array format.
- **Characters:** For each character, update the following details:
  - **Hair:** Describe style and length.
  - **Makeup:** Describe current makeup.
  - **Outfit:** **IMPORTANT!** List the complete outfit, including **underwear and accessories**, even if the character is undressed. **Underwear must always be included in the outfit description. If underwear is intentionally missing, specify this clearly (e.g. "No Bra", "No Panties").** Outfit should stay the same until changed for a new one.
  - **StateOfDress:** Describe how put-together or disheveled the character appears, including any removed clothing. Note where clothing items from outfit were discarded.
  - **PostureAndInteraction:** Describe physical posture, position relative to others or objects, and interactions.

Ensure the response remains consistent, strictly follows this structure in YAML, and omits any extra data or deviations. You MUST enclose the tracker in <tracker></tracker> tags]`;

const contextPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{trackerSystemPrompt}}

<!-- Start of Context -->

{{characterDescriptions}}

### Example Trackers
<!-- Start of Example Trackers -->
{{trackerExamples}}
<!-- End of Example Trackers -->

### Recent Messages with Trackers
{{recentMessages}}

### Current Tracker
<tracker>
{{currentTracker}}
</tracker>

<!-- End of Context --><|eot_id|>`;

const characterDescription = `### {{char}}'s Description
{{charDescription}}`;

const recentMessages = `{{#if tracker}}Tracker: <tracker>
{{trackerYAML}}
</tracker>
{{/if}}{{char}}: {{message}}`;

const exampleTrackers = `<START>
<tracker>
Time: "09:15:30; 10/16/2024 (Wednesday)"
Location: "Conference Room B, 12th Floor, Apex Corporation, New York, NY"
Weather: "Overcast, mild temperature"
Topics: ["presentation", "quarterly report"]
CharactersPresent: ["Emma Thompson", "James Miller", "Sophia Rodriguez"]
Characters:
  Emma Thompson:
    Hair: "Shoulder-length blonde hair, styled straight"
    Makeup: "Natural look with light foundation and mascara"
    Outfit: "Navy blue blazer over a white silk blouse; Gray pencil skirt; Black leather belt; Sheer black stockings; Black leather pumps; Pearl necklace; Silver wristwatch; White lace balconette bra; White lace hipster panties matching the bra"
    StateOfDress: "Professionally dressed, neat appearance"
    PostureAndInteraction: "Standing at the podium, presenting slides, holding a laser pointer"
  James Miller:
    Hair: "Short black hair, neatly combed"
    Makeup: "None"
    Outfit: "Dark gray suit; Light blue dress shirt; Navy tie with silver stripes; Black leather belt; Black dress shoes; Black socks; White cotton crew-neck undershirt; Black cotton boxer briefs"
    StateOfDress: "Professionally dressed, attentive"
    PostureAndInteraction: "Sitting at the conference table, taking notes on a laptop"
  Sophia Rodriguez:
    Hair: "Long curly brown hair, pulled back into a low bun"
    Makeup: "Subtle eyeliner and nude lipstick"
    Outfit: "Cream-colored blouse with ruffled collar; Black slacks; Brown leather belt; Brown ankle boots; Gold hoop earrings; Beige satin push-up bra; Beige satin bikini panties matching the bra"
    StateOfDress: "Professionally dressed, organized"
    PostureAndInteraction: "Sitting next to James, reviewing printed documents"
</tracker>
<START>
<tracker>
Time: "18:45:50; 10/16/2024 (Wednesday)"
Location: "Main Gym Hall, Maple Street Fitness Center, Denver, CO"
Weather: "Clear skies, warm evening"
Topics: ["workout", "training"]
CharactersPresent: ["Daniel Lee", "Olivia Harris"]
Characters:
  Daniel Lee:
    Hair: "Short brown hair, damp with sweat"
    Makeup: "None"
    Outfit: "Gray moisture-wicking t-shirt; Black athletic shorts; White ankle socks; Gray running shoes; Black sports watch; Blue compression boxer briefs"
    StateOfDress: "Workout attire, lightly perspiring"
    PostureAndInteraction: "Lifting weights at the bench press, focused on form"
  Olivia Harris:
    Hair: "Medium-length red hair, tied up in a high ponytail"
    Makeup: "Minimal, sweat-resistant mascara"
    Outfit: "Black sports tank top; Purple athletic leggings; Black athletic sneakers; White ankle socks; Fitness tracker bracelet; Black racerback sports bra; Black seamless athletic bikini briefs matching the bra"
    StateOfDress: "Workout attire, energized"
    PostureAndInteraction: "Running on the treadmill at a steady pace"
</tracker>
<START>
<tracker>
Time: "15:10:20; 10/16/2024 (Wednesday)"
Location: "South Beach, Miami, FL"
Weather: "Sunny, gentle sea breeze"
Topics: ["relaxation", "swimming"]
CharactersPresent: ["Liam Johnson", "Emily Clark"]
Characters:
  Liam Johnson:
    Hair: "Short sandy blonde hair, slightly tousled"
    Makeup: "None"
    Outfit: "Light blue short-sleeve shirt; Khaki shorts; Brown leather sandals; Silver wristwatch; Blue plaid cotton boxer shorts"
    StateOfDress: "Shirt and sandals removed, placed on beach towel"
    PostureAndInteraction: "Standing at the water's edge, feet in the surf"
  Emily Clark:
    Hair: "Long wavy brown hair, loose and flowing"
    Makeup: "Sunscreen applied, no additional makeup"
    Outfit: "White sundress over a red halter bikini; Straw hat; Brown flip-flops; Gold anklet; Red halter bikini top; Red tie-side bikini bottoms matching the top"
    StateOfDress: "Sundress and hat removed, placed on beach chair"
    PostureAndInteraction: "Lying on a beach towel, sunbathing with eyes closed"
</tracker>
`;

const defaultTracker = `Time: "<Updated time if changed>"
Location: "<Updated location if changed>"
Weather: "<Updated weather if changed>"
Topics: ["<List of topics if changed>"]
CharactersPresent: ["<List of characters present if changed>"]
Characters:
  <Character Name>:
    Hair: "<Updated hair description if changed>"
    Makeup: "<Updated makeup if changed>"
    Outfit: "<Full outfit description, even if removed including color, fabric, and style details; **always include underwear and accessories if present. If underwear is intentionally missing, specify clearly**>"
    StateOfDress: "<Current state of dress if no update is needed. Note location where discarded outfit items are placed if character is undressed>"
    PostureAndInteraction: "<Current posture and interaction if no update is needed>"`;

const mesTrackerTemplate = `<div class="tracker_default_mes_template">
    <table>
        <tr>
            <td>Time:</td>
            <td>{{Time}}</td>
        </tr>
        <tr>
            <td>Location:</td>
            <td>{{Location}}</td>
        </tr>
        <tr>
            <td>Weather:</td>
            <td>{{Weather}}</td>
        </tr>
    </table>
    <details>
        <summary><span>Tracker</span></summary>
        <table>
            <tr>
                <td>Topics:</td>
                <td>{{#join ", " Topics}}</td>
            </tr>
            <tr>
                <td>Present:</td>
                <td>{{#join ", " CharactersPresent}}</td>
            </tr>
        </table>
        <div class="mes_tracker_characters">
            {{#foreach Characters character}}
            <hr>
            <strong>{{character}}:</strong><br />
            <table>
                <tr>
                    <td>Hair:</td>
                    <td>{{character.Hair}}</td>
                </tr>
                <tr>
                    <td>Makeup:</td>
                    <td>{{character.Makeup}}</td>
                </tr>
                <tr>
                    <td>Outfit:</td>
                    <td>{{character.Outfit}}</td>
                </tr>
                <tr>
                    <td>State:</td>
                    <td>{{character.StateOfDress}}</td>
                </tr>
                <tr>
                    <td>Position:</td>
                    <td>{{character.PostureAndInteraction}}</td>
                </tr>
            </table>
            {{/foreach}}
        </div>
    </details>
</div>
<hr>`;

const numberOfMessages = 5;

const responseLength = 0;

export const defaultSettings = {
	enabled: true,
	contextTemplate: contextPrompt,
	systemPrompt: systemPrompt,
	characterDescriptionTemplate: characterDescription,
	recentMessagesTemplate: recentMessages,
	exampleTrackers: exampleTrackers,
	defaultTracker: defaultTracker,
	requestPrompt: requestPrompt,
	mesTrackerTemplate: mesTrackerTemplate,
	numberOfMessages: numberOfMessages,
	responseLength: responseLength,
	debugMode: false,
};
