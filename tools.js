// Tool definitions for OpenAI
export const tools = [
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

export async function executeTool(call, sender) {
  const { name, arguments: arguments_ } = call.function;
  let tab;

  // Parse arguments - can be string or object depending on API
  let parsedArguments;
  if (typeof arguments_ === 'string') {
    try {
      parsedArguments = JSON.parse(arguments_);
    } catch {
      return { tool_call_id: call.id, content: JSON.stringify({ error: `Failed to parse arguments string: ${arguments_}` }) };
    }
  } else if (typeof arguments_ === 'object' && arguments_ !== null) {
    parsedArguments = arguments_;
  } else {
    return { tool_call_id: call.id, content: JSON.stringify({ error: 'Invalid arguments type' }) };
  }

  let result;

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
                      level: Number.Number.parseInt(h.tagName.charAt(1)),
                      text: h.textContent.trim()
                    });
                  }
                }

                // Extract main content text (visible text from content areas, excluding scripts/styles)
                function extractMainContent() {
                  const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.main-content'];
                  let mainElement;

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