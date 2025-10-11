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
});

// Handle commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        // Store the tabId for the side panel
        chrome.storage.session.set({ sidePanelTabId: tabs[0].id });
      }
    });
  }
});

// Handle messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chat') {
    handleChat(request.messages, sender).then(reply => sendResponse({ reply })).catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open
  }
});

// Tool definitions for OpenAI
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_page_contents',
      description: 'Get structured page content including metadata, main visible text, headings, and actionable elements.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'click_element',
      description: 'Click an element on the page using a CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the element to click, e.g. "#myId", ".myClass", "[data-foo]"'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_text',
      description: 'Send text to an input element using a CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector of the input element to send text to'
          },
          text: {
            type: 'string',
            description: 'The text content to send to the element'
          }
        }
      }
    }
  }
];

async function executeTool(call, sender) {
  const { name, arguments: arguments_ } = call.function;
  let result;
  let tab;

  // Parse arguments - can be string or object depending on API
  let parsedArguments;
  if (typeof arguments_ === 'string') {
    try {
      parsedArguments = JSON.parse(arguments_);
    } catch {
      result = { error: `Failed to parse arguments string: ${arguments_}` };
      return { tool_call_id: call.id, content: JSON.stringify(result) };
    }
  } else if (typeof arguments_ === 'object' && arguments_ !== null) {
    parsedArguments = arguments_;
  } else {
    result = { error: 'Invalid arguments type' };
    return { tool_call_id: call.id, content: JSON.stringify(result) };
  }

  // Always try to find a suitable web tab
  let tabs = await chrome.tabs.query({ currentWindow: true });

  // Filter out extension pages and find the most appropriate tab
  const webTabs = tabs.filter(t => t.url && t.url.startsWith('http'));

  if (webTabs.length === 0) {
    result = { error: 'No web tabs found' };
  } else {
    // Use sender.tab if valid, otherwise use active web tab or first web tab
    tab = (sender && sender.tab && webTabs.some(t => t.id === sender.tab.id))
      ? sender.tab
      : webTabs.find(t => t.active) || webTabs[0];
  }

  if (!result) {
    // eslint-disable-next-line unicorn/no-negated-condition
    if (!tab.url.startsWith('http')) {
      result = { error: 'Tools only work on web pages (http/https). Current tab is not supported.' };
    } else {
      try {
        switch (name) {
          case 'get_page_contents': {
            const scriptResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                // Helper function to check if element is visible
                function isVisible(element) {
                  const style = globalThis.getComputedStyle(element);
                  return style.display !== 'none' &&
                         style.visibility !== 'hidden' &&
                         style.opacity !== '0' &&
                         element.offsetWidth > 0 &&
                         element.offsetHeight > 0;
                }

                // Get page metadata
                const title = document.title;
                const url = globalThis.location.href;
                const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

                // Extract headings
                const headings = [];
                for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
                  if (isVisible(h) && h.textContent.trim()) {
                    headings.push({
                      level: Number.parseInt(h.tagName.charAt(1)),
                      text: h.textContent.trim()
                    });
                  }
                }

                // Extract main content text (visible text from content areas, excluding scripts/styles)
                function extractMainContent() {
                  const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main-content'];
                  let mainElement = null;

                  // Try to find main content container
                  for (const selector of contentSelectors) {
                    const element = document.querySelector(selector);
                    if (element && isVisible(element)) {
                      mainElement = element;
                      break;
                    }
                  }

                  // Fallback to body if no main content found
                  if (!mainElement) mainElement = document.body;

                  // Extract visible text from paragraphs, divs, spans, etc.
                  const textElements = mainElement.querySelectorAll('p, div, span, li, td, th, blockquote');
                  let contentText = '';

                  for (const element of textElements) {
                    if (isVisible(element) &&
                        !element.closest('script') &&
                        !element.closest('style') &&
                        !element.closest('noscript') &&
                        element.textContent.trim().length > 10) { // Only substantial text
                      contentText += element.textContent.trim() + '\n';
                    }
                  }

                  // If still no content, try textContent of main element
                  if (contentText.length < 100) {
                    contentText = mainElement.textContent || '';
                  }

                  return contentText.slice(0, 3000); // Limit length
                }

                const mainContent = extractMainContent();

                // Extract visible interactive elements
                const elements = [];
                const inputs = document.querySelectorAll('input, textarea, select');
                for (const element of inputs) {
                  if (isVisible(element) && (element.id || element.name)) {
                    elements.push({
                      type: element.tagName.toLowerCase(),
                      id: element.id,
                      name: element.name,
                      value: element.value,
                      placeholder: element.placeholder,
                      class: element.className,
                      'aria-label': element.getAttribute('aria-label')
                    });
                  }
                }

                const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
                for (const element of buttons) {
                  if (isVisible(element) && (element.id || element.textContent.trim() || element.value)) {
                    elements.push({
                      type: 'button',
                      tagName: element.tagName.toLowerCase(),
                      id: element.id,
                      text: element.textContent.trim() || element.value,
                      class: element.className,
                      role: element.getAttribute('role'),
                      'aria-label': element.getAttribute('aria-label'),
                      'data-tooltip': element.dataset.tooltip
                    });
                  }
                }

                // Extract visible links
                const links = document.querySelectorAll('a[href]');
                for (const link of links) {
                  if (isVisible(link) && link.textContent.trim()) {
                    elements.push({
                      type: 'link',
                      text: link.textContent.trim(),
                      href: link.href,
                      class: link.className,
                      'aria-label': link.getAttribute('aria-label')
                    });
                  }
                }

                return {
                  metadata: { title, url, description: metaDesc },
                  mainContent,
                  headings,
                  elements
                };
              }
            });
            result = scriptResult[0].result;
            break;
          }
          case 'click_element': {
            const { selector } = parsedArguments;
            if (!selector) {
              result = { error: 'selector parameter is required for click_element tool' };
              break;
            }
            const scriptResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (selector) => {
                const element = document.querySelector(selector);
                if (element) {
                  element.click();
                  return { success: true };
                } else {
                  return { success: false, error: 'Element not found' };
                }
              },
              args: [selector]
            });
            result = scriptResult[0].result;
            if (result && !result.success) {
              result.error = `${result.error} (selector: ${selector})`;
            }
            break;
          }
          case 'send_text': {
            const { selector, text } = parsedArguments;
            if (!selector || !text) {
              result = { error: 'selector and text parameters are required for send_text tool' };
              break;
            }
            const scriptResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (selector, text) => {
                const element = document.querySelector(selector);
                if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
                  element.value = text;
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  return { success: true };
                } else {
                  return { success: false, error: 'Element not found or not an input' };
                }
              },
              args: [selector, text]
            });
            let rawResult = scriptResult[0].result;
            try {
              // Force serialization/deserialization to create plain objects
              // eslint-disable-next-line unicorn/prefer-structured-clone
              result = JSON.parse(JSON.stringify(rawResult));
              if (typeof result === 'string') {
                result = { message: result };
              }
            } catch (serializeError) {
              result = { error: `Invalid result from script execution: ${serializeError.message || serializeError}\nStack: ${serializeError.stack || 'No stack available'}` };
            }
            if (result && !result.success) {
              result.error = `${result.error} (selector: ${selector})`;
            }
            break;
          }
        }
      } catch (error) {
        result = { error: `Tool call: ${JSON.stringify(call)}\nError: ${error.message || error}\nStack: ${error.stack || 'No stack available'}` };
      }
    }
  }
  let content;
  try {
    content = JSON.stringify(result);
  } catch (serializeError) {
    content = JSON.stringify({ error: `Failed to serialize result: ${serializeError.message || serializeError}` });
  }

  // Send error to sidepanel for display
  if (result.error) {
    chrome.runtime.sendMessage({ action: 'tool_error', error: result.error });
  }

  return { tool_call_id: call.id, content };
}

const SYSTEM_MESSAGE = {
  role: 'system',
  content: 'You are a helpful assistant running in a Chrome extension sidepanel. You have access to tools that allow you to interact with the current web page: get_page_contents (to extract page information and find interactive elements), click_element (to click elements using CSS selectors), and send_text (to input text into elements using CSS selectors). When interacting with a web page, always start by using get_page_contents to discover available elements and construct appropriate CSS selectors (e.g. ".class", "[attribute]", "#id") before attempting to click or send text. Always provide valid JSON arguments for tool calls.'
};

async function handleChat(messages, sender) {
  const settings = await chrome.storage.sync.get(['sidepanelProvider', 'openaiApiKey', 'sidepanelModel', 'sidepanelOpenrouterApiKey', 'sidepanelOpenrouterModel']);
  const { sidepanelProvider } = settings;

  if (sidepanelProvider === 'openai') {
    const { openaiApiKey, sidepanelModel } = settings;
    if (!openaiApiKey || !sidepanelModel) throw new Error('OpenAI API key or model not set. Please configure in options.');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: sidepanelModel,
        messages: [SYSTEM_MESSAGE, ...messages],
        tools: tools,
        tool_choice: 'auto'
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');

    const assistantMessage = data.choices[0].message;
    if (assistantMessage.tool_calls) {
      const toolResults = await Promise.all(assistantMessage.tool_calls.map(call => executeTool(call, sender)));
      // Follow-up call with tool results
      const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: sidepanelModel,
          messages: [
            ...messages,
            assistantMessage,
            ...toolResults.map(r => ({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content }))
          ]
        })
      });
      const followUpData = await followUpResponse.json();
      if (!followUpResponse.ok) throw new Error(followUpData.error?.message || 'OpenAI API error');
      return followUpData.choices[0].message.content;
    } else {
      return assistantMessage.content;
    }
  } else {
    const { sidepanelOpenrouterApiKey, sidepanelOpenrouterModel } = settings;
    if (!sidepanelOpenrouterApiKey || !sidepanelOpenrouterModel) throw new Error('OpenRouter API key or model not set. Please configure in options.');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sidepanelOpenrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: sidepanelOpenrouterModel,
        messages: [SYSTEM_MESSAGE, ...messages],
        tools: tools,
        tool_choice: 'auto'
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'OpenRouter API error');

    const assistantMessage = data.choices[0].message;
    if (assistantMessage.tool_calls) {
      const toolResults = await Promise.all(assistantMessage.tool_calls.map(call => executeTool(call, sender)));
      // Follow-up call with tool results
      const followUpResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sidepanelOpenrouterApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: sidepanelOpenrouterModel,
          messages: [
            ...messages,
            assistantMessage,
            ...toolResults.map(r => ({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content }))
          ]
        })
      });
      const followUpData = await followUpResponse.json();
      if (!followUpResponse.ok) throw new Error(followUpData.error?.message || 'OpenRouter API error');
      return followUpData.choices[0].message.content;
    } else {
      return assistantMessage.content;
    }
  }
}

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
