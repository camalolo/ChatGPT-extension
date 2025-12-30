# AI Buddy Chrome Extension

**Version:** 1.1.0

This Chrome extension enhances your browsing experience by integrating powerful AI capabilities directly into your context menu. With this extension, you can easily explain selected text, fact-check information, translate content, fix grammar, and even have text read aloud using advanced text-to-speech.

## Features

*   **AI Explanations:** Select any text on a webpage and get an explanation using AI.
*   **Fact Checking:** Verify the truthfulness of selected text with AI-powered fact-checking.
*   **AI Search:** Search for selected text using AI and get summarized information.
*   **Translations:** Translate selected text to French or English.
*   **Spell Check:** Perform a spellcheck on selected text.
*   **WeiWu Translator:** Translate text into a unique "Wei Wu" style.
 *   **Grammar Correction:** Fix grammar and syntax of selected text using OpenAI, OpenRouter, or custom API endpoints.
 *   **Text-to-Speech (TTS):** Have any selected text read aloud using the browser's built-in speech synthesis.
 *   **Customizable TTS Voice:** Select from available browser voices for text-to-speech.
 *   **API Key Management:** Securely store API keys for various providers within the extension's options.

## Supported AI Services

*   **AI**
*   **OpenAI (for Grammar Fix and Sidepanel)**
*   **OpenRouter (for Grammar Fix and Sidepanel)**
*   **Custom API Endpoints (for Grammar Fix)**
*   **Browser Text-to-Speech (no API required)**

## Installation

1.  **Download the Extension:**
    *   Clone this repository or download the ZIP file and extract it.
2.  **Open Chrome Extensions Page:**
    *   Open Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:**
    *   Toggle on "Developer mode" in the top right corner.
4.  **Load Unpacked:**
    *   Click on "Load unpacked" and select the directory where you extracted the extension files.
5.  **Pin the Extension (Optional):**
    *   Click the puzzle piece icon in the Chrome toolbar, then click the pin icon next to "AI Buddy" to make it easily accessible.

## Configuration

1.  **Access Options Page:**
    *   Right-click on the extension icon in your Chrome toolbar and select "Options", or go to `chrome://extensions`, find "AI Buddy", and click "Details" then "Extension options".
2.  **Configure Providers:**
    *   Enter API keys for the providers you want to use (OpenAI, OpenRouter).
    *   Select models for sidepanel chat.
3.  **Grammar Fix Provider:**
    *   Choose between OpenAI, OpenRouter, or a custom API endpoint for grammar correction.
4.  **Text-to-Speech Voice:**
    *   Select from available browser voices for text-to-speech (no API key required).
5.  **Save Settings:**
    *   Click "Save Settings" to apply your changes.

## Usage

1.  **Select Text:**
    *   Highlight any text on a webpage.
2.  **Right-Click:**
    *   Right-click on the selected text to open the context menu.
3.  **Choose an Action:**
    *   **AI Services:** Select "Explain with AI", "Fact Check with AI", "Search for this with AI", "Translate to French with AI", "Translate to English with AI", "Spellcheck with AI", "WeiWu Translator", or "Fix Grammar with AI" to perform the respective action. This will display the AI response in an overlay on the current page (except for "Fix Grammar" which attempts to replace the text in place).
    *   **Read Text Aloud:** Select "Read Text Aloud" to hear the selected text spoken using your browser's text-to-speech.

## Side Panel

The extension includes a side panel for direct AI chat conversations:

*   **Opening the Side Panel:** Press `Ctrl+Shift+S` (or use the browser's side panel toggle if available) to open the AI chat interface.
*   **Chat Interface:** Type messages in the input field and press Enter or click "Send" to chat with the AI. The conversation history is maintained during the session.
*   **Clear Chat:** Click the "Clear" button to reset the conversation.
*   **Configuration:** The side panel uses the same AI provider and model configured in the extension options.

## Development

### Project Structure

*   [`background.js`](background.js): The service worker script that handles extension initialization and messaging.
*   [`manifest.json`](manifest.json): The manifest file defining the extension's properties, permissions, and background script.
*   [`options.html`](options.html): The HTML page for the extension's settings.
*   [`options.js`](options.js): The JavaScript for handling saving and restoring settings on the options page.
*   [`sidepanel.html`](sidepanel.html): The HTML for the AI chat side panel interface.
*   [`sidepanel.js`](sidepanel.js): The JavaScript for the side panel chat functionality.
*   [`context-menus.js`](context-menus.js): Handles creation and click events for context menu items.
*   [`api.js`](api.js): Manages API calls to AI providers (OpenAI, OpenRouter).
*   [`messaging.js`](messaging.js): Handles communication between extension components.
*   [`tts.js`](tts.js): Implements text-to-speech functionality.
*   [`tools.js`](tools.js): Utility tools for the extension.
*   [`utilities.js`](utilities.js): General utility functions.
*   [`icon.png`](icon.png): The extension icon.

### Permissions

The extension requires the following permissions:

*   `contextMenus`: To add items to the browser's context menu.
*   `tabs`: To open new tabs for AI service queries.
*   `storage`: To store user settings (like API keys and voice preferences).
*   `scripting`: To inject CSS and JavaScript into web pages for indicators and grammar correction.
*   `activeTab`: To access the currently active tab for scripting.
*   `sidePanel`: To display the AI chat interface in a side panel.
*   `host_permissions`: To make API calls to `https://api.openai.com/*`, `https://openrouter.ai/*`, and custom endpoints.

## Contributing

Repository: [https://github.com/camalolo/AiBuddy](https://github.com/camalolo/AiBuddy)

Feel free to fork the repository, make improvements, and submit pull requests.

## Icon Attribution

<a href="https://www.flaticon.com/free-icons/artificial-intelligence" title="artificial-intelligence icons">Artificial-intelligence icons created by juicy_fish - Flaticon</a>