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


const prodURI = 'https://infeeai-self.vercel.app/api/ai/completion/message'
const localURI = 'http://localhost:3000/api/ai/completion/message'


const rainbowColors = [
    { name: 'Dark Red', color: '#8B0000' },
    { name: 'Dark Orange', color: '#FF4500' },
    { name: 'Dark Goldenrod', color: '#B8860B' },
    { name: 'Dark Green', color: '#006400' },
    { name: 'Dark Blue', color: '#00008B' },
    { name: 'Dark Slate Blue', color: '#483D8B' },
    { name: 'Dark Violet', color: '#9400D3' }
];

function changeThemeColor(selectedColor) {
    document.documentElement.style.setProperty('--primary-color', selectedColor);
}

// Populate the color picker dropdown
const colorPicker = document.getElementById('theme-color');
rainbowColors.forEach(color => {
    const option = document.createElement('option');
    option.value = color.color;
    option.textContent = color.name;
    colorPicker.appendChild(option);
});

// Attach event listener to the color picker
colorPicker.addEventListener('change', function () {
    const selectedColor = colorPicker.value;
    changeThemeColor(selectedColor);
});


// Change placeholder text periodically
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
            role: 'user', // Ensure the 'role' field is included
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

        // Ensure each message in history has both 'content' and 'role'
        const formattedMessages = messages.map(msg => ({
            content: msg.content,
            role: msg.role === 'ai' ? 'assistant' : msg.role, // Map 'ai' to 'assistant'
            timestamp: msg.timestamp
        }));

        // Send message to server via API
        fetch(prodURI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: {
                    content: newMessage.content,
                    role: newMessage.role
                },
                history: formattedMessages
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                removeLoadingIndicator();
                const response = data.response; // Match with server's response structure
                const timestamp = new Date().toLocaleString();
                addChatBubble(response, 'answer', timestamp);
                updateSession(newMessage.content, response, timestamp);
                scrollToBottom();
            })
            .catch(error => {
                console.error('Error communicating with the server:', error);
                removeLoadingIndicator();
                addChatBubble('Error communicating with the server.', 'system', new Date().toLocaleString());
            });
    }
});

// Add chat bubble to the chat container
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

function formatText(text) {
    // Handle code blocks wrapped in triple backticks
    const codeBlockPattern = /```(?:\w+)?\n([\s\S]*?)```/g;
    let formattedText = text.replace(codeBlockPattern, (match, code) => {
        // Escape HTML entities in the code block
        const escapedCode = escapeHTML(code.trim());
        return `<pre><code>${escapedCode}</code></pre>`;
    });

    // Replace single new lines with <br> tags for the rest of the text
    formattedText = formattedText.replace(/\n/g, '<br>');

    return formattedText;
}

// Escape HTML to prevent XSS attacks and improper rendering
function escapeHTML(text) {
    return text.replace(/[&<>"']/g, function (match) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return escapeMap[match];
    });
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
