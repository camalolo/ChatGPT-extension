document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.querySelector('#message-input');
    const sendButton = document.querySelector('#send-button');
    const clearButton = document.querySelector('#clear-button');
    const chatMessages = document.querySelector('#chat-messages');

    let conversationHistory = [];

    function addMessage(text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.textContent = text;
        chatMessages.append(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function clearChat() {
        conversationHistory = [];
        chatMessages.innerHTML = '';
    }

    // Listen for tool errors
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'tool_error') {
            addMessage(`Tool Error: ${request.error}`, 'error');
        }
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        conversationHistory.push({ role: 'user', content: text });
        addMessage(text, 'user');
        messageInput.value = '';

        const loadingIndicator = document.querySelector('#loading-indicator');
        loadingIndicator.style.display = 'block';

        try {
            const response = await chrome.runtime.sendMessage({ action: 'chat', messages: conversationHistory });
            if (response.error) {
                addMessage(`Error: ${response.error}`, 'assistant');
            } else {
                conversationHistory.push({ role: 'assistant', content: response.reply });
                addMessage(response.reply, 'assistant');
            }
        } catch (error) {
            addMessage(`Error: ${error.message}`, 'assistant');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    function updateSendButton() {
        sendButton.disabled = !messageInput.value.trim();
    }

    messageInput.addEventListener('input', updateSendButton);
    sendButton.addEventListener('click', sendMessage);
    clearButton.addEventListener('click', clearChat);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') sendMessage();
    });
    updateSendButton(); // Initial state
});