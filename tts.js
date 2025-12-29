let ttsTimeout;
export function debouncedTTS(callback, delay = 300) {
  if (ttsTimeout) clearTimeout(ttsTimeout);
  ttsTimeout = setTimeout(callback, delay);
}

// Function to inject the visual indicator
export async function showPlayingIndicator(tabId) {
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

// Add this new function for the loading indicator
export async function showLoadingIndicator(tabId) {
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