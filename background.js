chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  chrome.contextMenus.create({
    id: "sendToChatGPT",
    title: "Send to ChatGPT",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "sendToPerplexityAi",
    title: "Send to Perplexity",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "sendToClaudeAi",
    title: "Send to Claude",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "readSelectedText",
    title: "Read Text Aloud",
    contexts: ["selection"]
  });
});

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "sendToChatGPT" && info.selectionText) {
    const prompt = `Explain what the following text means: ${info.selectionText}`;
    const chatGPTUrl = `https://chat.openai.com/?model=gpt-4&q=${encodeURIComponent(prompt)}`;
    chrome.tabs.create({ url: chatGPTUrl });
  }
  else if (info.menuItemId === "sendToPerplexityAi" && info.selectionText) {
    const prompt = `Explain what the following text means: ${info.selectionText}`;
    const chatGPTUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`;
    chrome.tabs.create({ url: chatGPTUrl });
  }
  else if (info.menuItemId === "sendToClaudeAi" && info.selectionText) {
    const prompt = `Explain what the following text means: ${info.selectionText}`;
    const chatGPTUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    chrome.tabs.create({ url: chatGPTUrl });
  }
  else if (info.menuItemId === "readSelectedText" && info.selectionText) {
    debouncedTTS(async () => {
      try {
        console.log('Read Text Aloud clicked');
        
        // Get the API key and voice selection from storage
        const result = await chrome.storage.sync.get(['openaiApiKey', 'selectedVoice']);
        const apiKey = result.openaiApiKey;
        const voice = result.selectedVoice || 'alloy';
        
        if (!apiKey) {
          console.log('No API key found, opening options page');
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
            document.body.appendChild(indicator);

            const audio = new Audio(audioBase64);
            
            audio.onended = () => {
              indicator.remove();
            };
            
            audio.play();
          },
          args: [audioBase64]
        });
        
      } catch (error) {
        console.error('Error in text-to-speech process:', error);
        
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
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 3000);
          },
          args: [errorMessage]
        });
      }
    });
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
    `
  });

  // Inject the loading indicator
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      let indicator = document.createElement('div');
      indicator.className = 'tts-loading-indicator';
      indicator.textContent = 'Getting audio...';
      document.body.appendChild(indicator);
    }
  });
}
