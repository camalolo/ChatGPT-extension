chrome.runtime.onInstalled.addListener(() => {

  // Define menu items configuration

  const services = [
    { id: 'ChatGPT', url: 'https://chat.openai.com/?model=gpt-4&q=' }
  ];

  // Create menu items in groups with separators
  const restrictedActions = new Set(['translateFr', 'translateEn', 'spellCheck', 'weiWuTranslate', 'fixGrammar']);
  const group1 = [{ action: 'explain', title: 'Explain with' }];
  const group2 = [{ action: 'factCheck', title: 'Fact Check with' },
    { action: 'searchFor', title: 'Search for this with' }
  ];
  const group3 = [
    { action: 'translateFr', title: 'Translate to French with' },
    { action: 'translateEn', title: 'Translate to English with' },
    { action: 'spellCheck', title: 'Spellcheck with' },
    { action: 'weiWuTranslate', title: 'WeiWu Translator' },
    { action: 'fixGrammar', title: 'Fix Grammar with' }
  ];

  function createMenuItemsForGroup(group, separatorId) {
    for (const { action, title } of group) {
      for (const { id } of services) {
        if (restrictedActions.has(action) && id === 'ChatGPT') {
          chrome.contextMenus.create({
            id: `${action}${id}`,
            title: `${title} ${id}`,
            contexts: ["selection"]
          });
        } else if (!restrictedActions.has(action)) {
          chrome.contextMenus.create({
            id: `${action}${id}`,
            title: `${title} ${id}`,
            contexts: ["selection"]
          });
        }
      }
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

  // Inject CSS for indicators once on install
  });

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.addEventListener('error', reject);
    reader.readAsDataURL(blob);
  });
}

let ttsTimeout;
function debouncedTTS(callback, delay = 300) {
  if (ttsTimeout) clearTimeout(ttsTimeout);
  ttsTimeout = setTimeout(callback, delay);
}

// Function to inject the visual indicator
async function showPlayingIndicator(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    css: `
      .tts-playing-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 20px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        animation: slideIn 0.3s ease-out;
      }
      @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .tts-playing-indicator::before {
        content: "";
        width: 8px;
        height: 8px;
        background: #4ade80;
        border-radius: 50%;
        animation: pulse 1s infinite;
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    `
  });
}

async function callOpenAIChatAPI(apiKey, model, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function isEditable(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return !element.readOnly && !element.disabled;
  }
  return false;
}

async function handleFixGrammar(tabId, selectionText) {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey', 'selectedModel']);
    const apiKey = result.openaiApiKey;
    const model = result.selectedModel;
    if (!apiKey || !model) {
      chrome.runtime.openOptionsPage();
      return;
    }
    const prompt = `Fix the grammar and syntax of the following text so it is proper, respectful, and understandable by a third party. Keep it in the original language and formatting. Just return the corrected text and nothing else : ${selectionText}`;
    const correctedText = await callOpenAIChatAPI(apiKey, model, prompt);

    // Inject script to detect editable or read-only and replace or show popup
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (corrected, isEditable) => {
        const selection = globalThis.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        let editableElement;

        if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
          if (isEditable(commonAncestor)) {
            editableElement = commonAncestor;
          }
        } else if (commonAncestor.nodeType === Node.TEXT_NODE && isEditable(commonAncestor.parentElement)) {
            editableElement = commonAncestor.parentElement;
          }

        if (editableElement) {
          // Replace selected text in editable element
          const start = editableElement.selectionStart;
          const end = editableElement.selectionEnd;
          if (typeof start === 'number' && typeof end === 'number') {
            const value = editableElement.value;
            editableElement.value = value.slice(0, start) + corrected + value.slice(end);
            // Set cursor after replaced text
            editableElement.selectionStart = editableElement.selectionEnd = start + corrected.length;
          } else {
            // Fallback: replace selection with document.execCommand
            document.execCommand('insertText', false, corrected);
          }
        } else {
          // Show popup with corrected text
          const popup = document.createElement('div');
          popup.style.position = 'fixed';
          popup.style.background = 'white';
          popup.style.border = '1px solid black';
          popup.style.padding = '8px';
          popup.style.zIndex = 2_147_483_647;
          popup.style.maxWidth = '300px';
          popup.style.whiteSpace = 'pre-wrap';
          popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
          popup.textContent = corrected;

          // Position popup near selection
          const rect = range.getBoundingClientRect();
          popup.style.top = `${rect.bottom + 5}px`;
          popup.style.left = `${rect.left}px`;

          document.body.append(popup);

          // Remove popup on click or after 10 seconds
          function removePopup() {
            popup.remove();
            document.removeEventListener('click', removePopup);
          }
          document.addEventListener('click', removePopup);
          setTimeout(removePopup, 10_000);
        }
      },
      args: [correctedText, isEditable]
    });
  } catch (error) {
    console.error('Error fixing grammar:', error);
    chrome.runtime.openOptionsPage();
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "readSelectedText" && info.selectionText) {
    debouncedTTS(async () => {
      try {

        // Get the API key and voice selection from storage
        const result = await chrome.storage.sync.get(['openaiApiKey', 'selectedVoice']);
        const apiKey = result.openaiApiKey;
        const voice = result.selectedVoice || 'alloy';

        if (!apiKey) {
          chrome.runtime.openOptionsPage();
          return;
        }

        // Show loading indicator and ensure playing indicator CSS is injected
        await showLoadingIndicator(tab.id);

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: info.selectionText,
            voice: voice
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Response not OK:', response.status, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        await showPlayingIndicator(tab.id);

        const audioBlob = await response.blob();
        const audioBase64 = await blobToBase64(audioBlob);

        // Update the script injection to use the pre-injected CSS
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (audioBase64) => {
            // Remove loading indicator if exists
            document.querySelector('.tts-loading-indicator')?.remove();

            // Create playing indicator
            const indicator = document.createElement('div');
            indicator.className = 'tts-playing-indicator';
            indicator.textContent = 'Playing audio...';
            document.body.append(indicator);

            const audio = new Audio(audioBase64);

            audio.addEventListener('ended', () => {
              indicator.remove();
            });

            audio.play();
          },
          args: [audioBase64]
        });

      } catch (error) {
        console.error('TTS: Error in text-to-speech process:', error);

        let errorMessage = 'An error occurred';
        if (error.message.includes('401')) {
          errorMessage = 'Invalid API key. Please check your settings.';
          chrome.runtime.openOptionsPage();
        } else if (error.message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (!navigator.onLine) {
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
  if (info.selectionText) {
    const services = {
      ChatGPT: 'https://chat.openai.com/?model=gpt-4&q='
    };

    // Extract action and service from menuItemId
    const isFactCheck = info.menuItemId.startsWith('factCheck');
    const isSearchFor = info.menuItemId.startsWith('searchFor');
    const isTranslateFr = info.menuItemId.startsWith('translateFr');
    const isTranslateEn = info.menuItemId.startsWith('translateEn');
    const isSpellCheck = info.menuItemId.startsWith('spellCheck');
    const isWeiWuTranslate = info.menuItemId.startsWith('weiWuTranslate');
    const isFixGrammar = info.menuItemId.startsWith('fixGrammar');
    const service = Object.keys(services).find(s => info.menuItemId.includes(s));

    if (service) {
      if (isFixGrammar) {
        await handleFixGrammar(tab.id, info.selectionText);
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
        
        const url = `${services.ChatGPT}${encodeURIComponent(prompt)}`;
        chrome.tabs.create({ url });
      }
    }
  }
});

// Add this new function for the loading indicator
async function showLoadingIndicator(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    css: `
      .tts-loading-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 20px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        animation: slideIn 0.3s ease-out;
      }
      .tts-loading-indicator::before {
        content: "";
        width: 8px;
        height: 8px;
        background: #ef4444;
        border-radius: 50%;
        animation: pulse 1s infinite;
      }
      @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    `
  });

  // Inject the loading indicator
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      let indicator = document.createElement('div');
      indicator.className = 'tts-loading-indicator';
      indicator.textContent = 'Getting audio...';
      document.body.append(indicator);
    }
  });
}
