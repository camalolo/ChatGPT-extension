import { setupContextMenus, handleMenuClick } from './context-menus.js';
import { setupMessageListeners } from './messaging.js';

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
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

// Setup message listeners
setupMessageListeners();

// Setup context menu click listener
chrome.contextMenus.onClicked.addListener(handleMenuClick);
