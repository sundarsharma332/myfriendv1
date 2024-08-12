const socket = io('http://localhost:4000/', {
    reconnection: false
});

// const socket = io('https://myfriendv1ws.vercel.app');


const textarea = document.getElementById('search-input');
const button = document.getElementById('send-button');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggle-sidebar');
const newChatCircle = document.getElementById('new-chat-circle');
const historyList = document.getElementById('history-list');
const chatContainer = document.getElementById('chat-container');
const emptyChatBackground = document.getElementById('empty-chat-background');
const placeholders = ["Search Anything", "Get Precise Information", "Write Help for help and commands"];
let placeholderIndex = 0;
let currentSessionId = null;
let messages = []; // Store chat history
let isThinking = false; // Flag to indicate if the AI is thinking

function changePlaceholder() {
    textarea.placeholder = placeholders[placeholderIndex];
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
}

setInterval(changePlaceholder, 2000); // change placeholder every 2000ms

textarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.max(this.scrollHeight, 52) + 'px'; // maintain at least the initial height

    if (this.value.trim() !== "") {
        button.classList.add('visible');
    } else {
        button.classList.remove('visible');
    }
});

// Initialize the chat and history from localStorage
function initializeFromLocalStorage() {
    const historyData = JSON.parse(localStorage.getItem('historyData')) || [];
    currentSessionId = localStorage.getItem('currentSessionId') || generateUUID();

    historyData.forEach((session) => {
        addHistoryItem(session.id, session.title, session.lastUpdated);
    });

    messages = JSON.parse(localStorage.getItem(currentSessionId)) || [];
    messages.forEach(({ text, type, timestamp }) => {
        addChatBubble(text, type, timestamp);
    });

    updateEmptyChatBackground();
    scrollToBottom();
}

// Generate a UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Toggle sidebar visibility
toggleSidebar.addEventListener('click', function () {
    if (historyList.children.length === 0) {
        alert('No sessions available. Create a new session first.');
        return;
    }
    sidebar.classList.toggle('open');
});

// Handle new chat button click
newChatCircle.addEventListener('click', function () {
    currentSessionId = generateUUID();
    localStorage.setItem('currentSessionId', currentSessionId);
    chatContainer.innerHTML = '';
    textarea.value = '';
    textarea.style.height = '52px'; // Reset height to default
    button.classList.remove('visible');
    messages = []; // Clear messages
    updateEmptyChatBackground();
});

// Handle send button click
button.addEventListener('click', function () {
    if (textarea.value.trim() !== "") {
        const question = textarea.value.trim();
        const timestamp = new Date().toLocaleString();

        const newMessage = {
            role: 'user',
            content: question,
            timestamp: timestamp
        };

        messages.push(newMessage);
        addChatBubble(question, 'question', timestamp);
        showLoadingIndicator();

        textarea.value = ""; // Clear the textarea
        textarea.style.height = '52px'; // Reset height to default
        button.classList.remove('visible'); // Hide send button after sending

        scrollToBottom();

        // Send message to server
        socket.emit('message', {
            message: newMessage,
            history: messages
        });
    }
});

// Add chat bubble to the chat container
function addChatBubble(text, type, timestamp = new Date().toLocaleTimeString()) {
    const chatBubble = document.createElement('div');
    chatBubble.className = `chat-bubble ${type}`;

    // Format the text content
    const formattedText = formatText(text);
    chatBubble.innerHTML = formattedText;

    const timeElement = document.createElement('div');
    timeElement.className = 'chat-timestamp';
    timeElement.textContent = timestamp;

    chatBubble.appendChild(timeElement);
    chatContainer.appendChild(chatBubble);
}

// Format text for display
function formatText(text) {
    // Replace new lines with <br> tags
    const formattedText = text.replace(/\n/g, '<br>');
    return formattedText;
}

// Show loading indicator
function showLoadingIndicator() {
    isThinking = true;
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.id = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;
    chatContainer.appendChild(loadingIndicator);
    scrollToBottom();
}

// Remove loading indicator
function removeLoadingIndicator() {
    isThinking = false;
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        chatContainer.removeChild(loadingIndicator);
    }
}

// Add a history item to the sidebar
function addHistoryItem(sessionId, title, lastUpdated) {
    const listItem = document.createElement('li');
    listItem.className = 'history-item';
    listItem.setAttribute('data-session-id', sessionId);

    listItem.innerHTML = `
        <div class="history-item-title">${title}</div>
        <div class="history-item-timestamp">Last updated on ${lastUpdated}</div>
    `;

    historyList.appendChild(listItem);
}

// Update the current session with new question and response
function updateSession(question, response, timestamp) {
    const sessionData = JSON.parse(localStorage.getItem(currentSessionId)) || [];
    sessionData.push({ text: question, type: 'question', timestamp });
    sessionData.push({ text: response, type: 'answer', timestamp });

    localStorage.setItem(currentSessionId, JSON.stringify(sessionData));

    const historyData = JSON.parse(localStorage.getItem('historyData')) || [];
    const sessionIndex = historyData.findIndex(session => session.id === currentSessionId);

    if (sessionIndex === -1) {
        historyData.push({
            id: currentSessionId,
            title: question,
            lastUpdated: timestamp,
            createdAt: timestamp
        });
    } else {
        historyData[sessionIndex].lastUpdated = timestamp;
    }

    localStorage.setItem('historyData', JSON.stringify(historyData));
    updateHistoryUI(historyData);
    updateEmptyChatBackground();
}

// Update the history UI
function updateHistoryUI(historyData) {
    historyList.innerHTML = '';
    historyData.forEach(({ id, title, lastUpdated }) => {
        addHistoryItem(id, title, lastUpdated);
    });
}

// Populate search bar and chat when a history item is clicked
historyList.addEventListener('click', function (event) {
    const item = event.target.closest('.history-item');
    if (item) {
        const sessionId = item.getAttribute('data-session-id');
        loadSession(sessionId);
    }
});

// Load a session into the chat container
function loadSession(sessionId) {
    const sessionData = JSON.parse(localStorage.getItem(sessionId)) || [];
    chatContainer.innerHTML = '';
    sessionData.forEach(({ text, type, timestamp }) => {
        addChatBubble(text, type, timestamp);
    });
    scrollToBottom();
    currentSessionId = sessionId;
    localStorage.setItem('currentSessionId', sessionId);
    messages = sessionData; // Load messages
    updateEmptyChatBackground();
}

// Scroll to the bottom of the chat container
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Update the empty chat background
function updateEmptyChatBackground() {
    if (chatContainer.children.length === 0) {
        emptyChatBackground.style.display = 'block';
    } else {
        emptyChatBackground.style.display = 'none';
    }
}

// Initialize the chat and history when the page loads
initializeFromLocalStorage();

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('Connected to the server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from the server');
    addChatBubble('Disconnected from server', 'system', new Date().toLocaleString());
});

socket.on('connect_error', (err) => {
    console.log('Connection Error:', err);
    addChatBubble(`Connection error - ${err}`, 'system', new Date().toLocaleString());
});

socket.on('error', (err) => {
    console.log('Error:', err);
    addChatBubble(`Error - ${err}`, 'system', new Date().toLocaleString());
});

socket.on('response', (data) => {
    removeLoadingIndicator();
    const response = data;
    const timestamp = new Date().toLocaleString();
    addChatBubble(response, 'answer', timestamp);
    updateSession(messages[messages.length - 1].content, response, timestamp);
    scrollToBottom();
});

socket.on('getMessageEvent', (data) => {
    console.log('New message received:', data);
    const timestamp = new Date().toLocaleString();
    addChatBubble(data, 'assistant', timestamp);
    scrollToBottom();
});