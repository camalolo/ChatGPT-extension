import { debouncedTTS, showLoadingIndicator, showPlayingIndicator } from './tts.js';
import { handleFixGrammar, showAIOverlay } from './utilities.js';
import { getSettings, callChatAPI } from './api.js';

export function setupContextMenus() {
  // Create menu items in groups with separators
  const group1 = [{ action: 'explain', title: 'Explain with AI' }];
  const group2 = [{ action: 'factCheck', title: 'Fact Check with AI' },
    { action: 'searchFor', title: 'Search for this with AI' }
  ];
  const group3 = [
    { action: 'translateFr', title: 'Translate to French with AI' },
    { action: 'translateEn', title: 'Translate to English with AI' },
    { action: 'spellCheck', title: 'Spellcheck with AI' },
    { action: 'weiWuTranslate', title: 'WeiWu Translator' },
    { action: 'fixGrammar', title: 'Fix Grammar with AI' }
  ];

  function createMenuItemsForGroup(group, separatorId) {
    for (const { action, title } of group) {
      chrome.contextMenus.create({
        id: `${action}AI`,
        title: title,
        contexts: ["selection"]
      });
    }
    // Create separator after group
    chrome.contextMenus.create({
      id: separatorId,
      type: 'separator',
      contexts: ["selection"]
    });
  }

  createMenuItemsForGroup(group1, 'separator1');
  createMenuItemsForGroup(group2, 'separator2');
  createMenuItemsForGroup(group3, 'separator3');

  // Create Read Text Aloud option
  chrome.contextMenus.create({
    id: "readSelectedText",
    title: "Read Text Aloud",
    contexts: ["selection"]
  });
}

export async function handleMenuClick(info, tab) {
  if (info.menuItemId === "readSelectedText" && info.selectionText) {
    debouncedTTS(async () => {
      try {
        // Get the browser voice selection from storage
        const result = await chrome.storage.sync.get(['browserVoice']);
        const voiceIndex = result.browserVoice ?? '';

        // Show loading indicator and ensure playing indicator CSS is injected
        await showLoadingIndicator(tab.id);

        await showPlayingIndicator(tab.id);

        // Use browser's speech synthesis
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text, voiceIndex) => {
            // Remove loading indicator if exists
            document.querySelector('.tts-loading-indicator')?.remove();

            // Create playing indicator
            const indicator = document.createElement('div');
            indicator.className = 'tts-playing-indicator';
            indicator.textContent = 'Playing audio...';
            document.body.append(indicator);

            const utterance = new SpeechSynthesisUtterance(text);

            // Set voice if specified
            if (voiceIndex !== '' && voiceIndex !== undefined) {
              const voices = speechSynthesis.getVoices();
              const selectedVoice = voices[Number.parseInt(voiceIndex)];
              if (selectedVoice) {
                utterance.voice = selectedVoice;
              }
            }

            utterance.addEventListener('end', () => {
              indicator.remove();
            });

            utterance.addEventListener('error', () => {
              indicator.remove();
              console.error('Speech synthesis error');
            });

            speechSynthesis.speak(utterance);
          },
          args: [info.selectionText, voiceIndex]
        });

      } catch (error) {
        console.error('TTS: Error in text-to-speech process:', error);

        let errorMessage = 'An error occurred with text-to-speech';
        if (!navigator.onLine) {
          errorMessage = 'No internet connection';
        }

        // Show error to user
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (message) => {
            document.querySelector('.tts-loading-indicator')?.remove();
            // Show error notification
            const errorDiv = document.createElement('div');
            errorDiv.className = 'tts-error-indicator';
            errorDiv.textContent = message;
            document.body.append(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
          },
          args: [errorMessage]
        });
      }
    });
  }

  // Handle AI service actions
  if (info.selectionText && info.menuItemId.endsWith('AI')) {
    try {
      const settings = await getSettings();
      const { sidepanelProvider } = settings;
      if (!sidepanelProvider) {
        chrome.runtime.openOptionsPage();
        return;
      }

      let apiKey, model;
      if (sidepanelProvider === 'openai') {
        apiKey = settings.openaiApiKey;
        model = settings.sidepanelModel;
      } else if (sidepanelProvider === 'openrouter') {
        apiKey = settings.sidepanelOpenrouterApiKey;
        model = settings.sidepanelOpenrouterModel;
      }

      if (!apiKey || !model) {
        chrome.runtime.openOptionsPage();
        return;
      }

      // Extract action from menuItemId
      const isFactCheck = info.menuItemId.startsWith('factCheck');
      const isSearchFor = info.menuItemId.startsWith('searchFor');
      const isTranslateFr = info.menuItemId.startsWith('translateFr');
      const isTranslateEn = info.menuItemId.startsWith('translateEn');
      const isSpellCheck = info.menuItemId.startsWith('spellCheck');
      const isWeiWuTranslate = info.menuItemId.startsWith('weiWuTranslate');
      const isFixGrammar = info.menuItemId.startsWith('fixGrammar');

      if (isFixGrammar) {
        handleFixGrammar(tab.id, info.selectionText);
      } else {
        let prompt;
        if (isFactCheck) {
          prompt = `Fact check for truthfulness the following text: ${info.selectionText}`;
        } else if (isSearchFor) {
          prompt = `Search for the following term and summarize information you find : ${info.selectionText}`;
        } else if (isTranslateFr) {
          prompt = `Translate the following text to French: ${info.selectionText}`;
        } else if (isTranslateEn) {
          prompt = `Translate the following text to English: ${info.selectionText}`;
        } else if (isSpellCheck) {
          prompt = `Perform a spellcheck of the following text: ${info.selectionText}`;
        } else if (isWeiWuTranslate) {
          prompt = `Translate text into Wei Wu style: broken English, no a/an/the, wrong verbs (be victory, society be collapsing), mix tenses (soon destroy, I'm believe), short choppy sentences, awkward word choice (possession, give me number 1 most confusion), exaggeration, funny memes or mild stereotypes if fit. Keep main meaning. Translate this text : ${info.selectionText}`;
        } else {
          prompt = `Explain the meaning of the following text: ${info.selectionText}`;
        }

        // Show loading overlay
        showAIOverlay(tab.id, '', true);

        const response = await callChatAPI(sidepanelProvider, apiKey, model, prompt);
        showAIOverlay(tab.id, response, false);
      }
    } catch (error) {
      console.error('AI action error:', error);
      chrome.runtime.openOptionsPage();
    }
  }
}