import { callChatAPI } from './api.js';

export async function showAIOverlay(tabId, text, isLoading = false) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (responseText, isLoading) => {
      let overlay = document.querySelector('#ai-overlay');
      let container, closeButton, contentDiv;

      if (overlay) {
        container = overlay.querySelector('div');
        closeButton = container.querySelector('button');
      } else {
        // Create overlay
        overlay = document.createElement('div');
        overlay.id = 'ai-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '2147483647';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';

        // Content container
        container = document.createElement('div');
        container.style.backgroundColor = '#333';
        container.style.color = '#fff';
        container.style.padding = '20px';
        container.style.borderRadius = '8px';
        container.style.width = '600px';
        container.style.height = '400px';
        container.style.maxWidth = '90%';
        container.style.maxHeight = '90%';
        container.style.overflow = 'auto';
        container.style.position = 'relative';
        container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
        container.style.minHeight = '100px'; // Ensure some height

        // Close button
        closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = '#fff';
        closeButton.style.fontSize = '24px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => {
          if (overlay.escapeHandler) {
            document.removeEventListener('keydown', overlay.escapeHandler);
            delete overlay.escapeHandler;
          }
          overlay.remove();
        });

         overlay.append(container);
         document.body.append(overlay);
         overlay.tabIndex = -1;
         overlay.focus();

        // Close on overlay click
          overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
              if (overlay.escapeHandler) {
                document.removeEventListener('keydown', overlay.escapeHandler);
                delete overlay.escapeHandler;
              }
              overlay.remove();
            }
          });
       }

       overlay.focus();
       if (!overlay.escapeHandler) {
         overlay.escapeHandler = (event) => {
           if (event.key === 'Escape') {
             if (overlay.escapeHandler) {
               document.removeEventListener('keydown', overlay.escapeHandler);
               delete overlay.escapeHandler;
             }
             overlay.remove();
           }
         };
         document.addEventListener('keydown', overlay.escapeHandler);
       }

       // Clear existing content except close button
            for (let child = container.firstChild; child; ) {
        if (child === closeButton) {
          break;
        } else {
          const next = child.nextSibling;
          child.remove();
          child = next;
        }
      }

      // Add content
      contentDiv = document.createElement('div');
      if (isLoading) {
        contentDiv.innerHTML = `
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div style="margin-top: 10px; color: #fff;">Loading...</div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
      } else {
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.textContent = responseText;
      }

      container.append(contentDiv);
    },
    args: [text, isLoading]
  });
}

export async function handleFixGrammar(tabId, selectionText) {
  try {
    const settings = await chrome.storage.sync.get([
      'sidepanelProvider',
      'openaiApiKey',
      'sidepanelModel',
      'sidepanelOpenrouterApiKey',
      'sidepanelOpenrouterModel'
    ]);

    console.log('Fix Grammar settings:', settings);
    console.log('Selected text length:', selectionText.length);

    const { sidepanelProvider } = settings;
    let correctedText;

    // Limit selected text to prevent token limit issues
    const limitedText = selectionText.slice(0, 1000);
    if (selectionText.length > 1000) {
      console.log('Selected text truncated to 1000 characters');
    }

    const prompt = `Fix the grammar and syntax of the following text so it is proper, respectful, and understandable by a third party. Keep it in the original language and formatting. Just return the corrected text and nothing else : ${limitedText}`;

    if (sidepanelProvider === 'openai') {
      const { openaiApiKey, sidepanelModel } = settings;
      if (!openaiApiKey || !sidepanelModel) {
        console.log('Missing OpenAI settings, opening options page');
        chrome.runtime.openOptionsPage();
        return;
      }
      // Show loading overlay
      showAIOverlay(tabId, '', true);
      correctedText = await callChatAPI('openai', openaiApiKey, sidepanelModel, prompt);
    } else {
      const { sidepanelOpenrouterApiKey, sidepanelOpenrouterModel } = settings;
      if (!sidepanelOpenrouterApiKey || !sidepanelOpenrouterModel) {
        console.log('Missing OpenRouter settings, opening options page');
        chrome.runtime.openOptionsPage();
        return;
      }
      // Show loading overlay
      showAIOverlay(tabId, '', true);
      correctedText = await callChatAPI('openrouter', sidepanelOpenrouterApiKey, sidepanelOpenrouterModel, prompt);
    }

    // Inject script to detect editable or read-only and replace or update overlay
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (corrected) => {
        const selection = globalThis.getSelection();
        let editableElement;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const commonAncestor = range.commonAncestorContainer;

          if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
            if (commonAncestor && (commonAncestor.isContentEditable || (commonAncestor.tagName === 'INPUT' || commonAncestor.tagName === 'TEXTAREA') && !commonAncestor.readOnly && !commonAncestor.disabled)) {
              editableElement = commonAncestor;
            }
          } else if (commonAncestor.nodeType === Node.TEXT_NODE && commonAncestor.parentElement && (commonAncestor.parentElement.isContentEditable || (commonAncestor.parentElement.tagName === 'INPUT' || commonAncestor.parentElement.tagName === 'TEXTAREA') && !commonAncestor.parentElement.readOnly && !commonAncestor.parentElement.disabled)) {
            editableElement = commonAncestor.parentElement;
          }
        }

        if (editableElement) {
          // Remove loading overlay and replace selected text
          const overlay = document.querySelector('#ai-overlay');
          if (overlay) overlay.remove();
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
           // Update overlay with corrected text
           const overlay = document.querySelector('#ai-overlay');
           if (overlay) {
             overlay.focus();
             const container = overlay.querySelector('div');
             const closeButton = container.querySelector('button');
            // Clear existing content except close button
            for (let child = container.firstChild; child; ) {
              if (child === closeButton) {
                break;
              } else {
                const next = child.nextSibling;
                child.remove();
                child = next;
              }
            }
            // Add response content
            const contentDiv = document.createElement('div');
            contentDiv.style.whiteSpace = 'pre-wrap';
            contentDiv.textContent = corrected;
             container.append(contentDiv);
          }
        }
      },
      args: [correctedText]
    });
  } catch (error) {
    console.error('Error fixing grammar:', error);
    chrome.runtime.openOptionsPage();
  }
}