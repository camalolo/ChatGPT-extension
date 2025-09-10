# AI Explain and Read Chrome Extension

This Chrome extension enhances your browsing experience by integrating powerful AI capabilities directly into your context menu. With this extension, you can easily explain selected text, fact-check information, translate content, fix grammar, and even have text read aloud using advanced text-to-speech.

## Features

*   **AI Explanations:** Select any text on a webpage and get an explanation using various AI services (ChatGPT, Perplexity, Claude).
*   **Fact Checking:** Verify the truthfulness of selected text with AI-powered fact-checking.
*   **Translations:** Translate selected text to French or English.
*   **Spell Check:** Perform a spellcheck on selected text.
*   **WeiWu Translator:** Translate text into a unique "Wei Wu" style.
*   **Grammar Correction:** Fix grammar and syntax of selected text using OpenAI's API.
*   **Text-to-Speech (TTS):** Have any selected text read aloud in a natural voice using OpenAI's TTS API.
*   **Configurable AI Services:** Choose your preferred AI service for explanations and fact-checking.
*   **Customizable TTS Voice:** Select from several OpenAI voices for text-to-speech.
*   **API Key Management:** Securely store your OpenAI API key within the extension's options.

## Supported AI Services

*   **ChatGPT**
*   **Perplexity AI**
*   **Claude AI**
*   **OpenAI (for Grammar Fix and Text-to-Speech)**

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
    *   Click the puzzle piece icon in the Chrome toolbar, then click the pin icon next to "AI Explain and Read" to make it easily accessible.

## Configuration

1.  **Access Options Page:**
    *   Right-click on the extension icon in your Chrome toolbar and select "Options", or go to `chrome://extensions`, find "AI Explain and Read", and click "Details" then "Extension options".
2.  **Enter OpenAI API Key:**
    *   In the options page, enter your OpenAI API key. This is required for the "Fix Grammar" and "Read Text Aloud" features.
3.  **Select TTS Voice:**
    *   Choose your preferred voice for the text-to-speech feature.
4.  **Save Settings:**
    *   Click "Save Settings" to apply your changes.

## Usage

1.  **Select Text:**
    *   Highlight any text on a webpage.
2.  **Right-Click:**
    *   Right-click on the selected text to open the context menu.
3.  **Choose an Action:**
    *   **AI Services:** Select "Explain with [Service]", "Fact Check with [Service]", "Translate to French with [Service]", "Translate to English with [Service]", "Spellcheck with [Service]", "WeiWu Translator", or "Fix Grammar with [Service]" to perform the respective action. This will open a new tab with the AI service pre-populated with your query (except for "Fix Grammar" which attempts to replace the text in place or show a popup).
    *   **Read Text Aloud:** Select "Read Text Aloud" to hear the selected text spoken.

## Development

### Project Structure

*   [`background.js`](background.js): The service worker script that handles context menu creation, API calls to OpenAI, and text-to-speech functionality.
*   [`manifest.json`](manifest.json): The manifest file defining the extension's properties, permissions, and background script.
*   [`options.html`](options.html): The HTML page for the extension's settings.
*   [`options.js`](options.js): The JavaScript for handling saving and restoring settings on the options page.
*   [`icon.png`](icon.png): The extension icon.

### Permissions

The extension requires the following permissions:

*   `contextMenus`: To add items to the browser's context menu.
*   `tabs`: To open new tabs for AI service queries.
*   `storage`: To store user settings (like API keys and voice preferences).
*   `scripting`: To inject CSS and JavaScript into web pages for indicators and grammar correction.
*   `activeTab`: To access the currently active tab for scripting.
*   `host_permissions`: To make API calls to `https://api.openai.com/*`.

## Contributing

Feel free to fork the repository, make improvements, and submit pull requests.