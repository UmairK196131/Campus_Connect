// chat.js — Campus Connect real-time chat

const socket = io();
const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('message-input');
const sendBtn     = document.getElementById('send-btn');
const typingEl    = document.getElementById('typing-indicator');

let typingTimeout;
let isTyping = false;
const typingUsers = new Set();

socket.emit('join', { room_id: ROOM_ID, username: USERNAME });

socket.on('message', function (data) {
  if (!data.is_system) {
    typingUsers.delete(data.username);
    updateTypingIndicator();
  }
  appendMessage(data);
  scrollToBottom();
});

socket.on('user_typing', function (data) {
  typingUsers.add(data.username);
  updateTypingIndicator();
});

socket.on('user_stopped_typing', function (data) {
  typingUsers.delete(data.username);
  updateTypingIndicator();
});

sendBtn.addEventListener('click', sendMessage);

inputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', function () {
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', { room_id: ROOM_ID, username: USERNAME });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(function () {
    isTyping = false;
    socket.emit('stop_typing', { room_id: ROOM_ID, username: USERNAME });
  }, 1500);
});

window.addEventListener('beforeunload', function () {
  socket.emit('leave', { room_id: ROOM_ID, username: USERNAME });
  socket.emit('stop_typing', { room_id: ROOM_ID, username: USERNAME });
});

function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  socket.emit('send_message', {
    room_id:  ROOM_ID,
    username: USERNAME,
    text:     text
  });

  inputEl.value = '';
  inputEl.focus();

  clearTimeout(typingTimeout);
  isTyping = false;
  socket.emit('stop_typing', { room_id: ROOM_ID, username: USERNAME });
}

function appendMessage(data) {
  const wrapper = document.createElement('div');

  if (data.is_system) {
    wrapper.className = 'message system';
    wrapper.innerHTML = `
      <div class="msg-bubble">${escapeHtml(data.text)}</div>
    `;
  } else {
    const isMe = data.username === USERNAME;
    wrapper.className = `message ${isMe ? 'mine' : 'theirs'}`;
    wrapper.innerHTML = `
      <div class="msg-header">
        <span class="msg-username">${isMe ? 'You' : escapeHtml(data.username)}</span>
        <span class="msg-time">${escapeHtml(data.time)}</span>
      </div>
      <div class="msg-bubble">${escapeHtml(data.text)}</div>
    `;
  }

  messagesEl.appendChild(wrapper);
}

function updateTypingIndicator() {
  const names = Array.from(typingUsers);

  if (names.length === 0) {
    typingEl.textContent = '';
    typingEl.style.display = 'none';
  } else if (names.length === 1) {
    typingEl.textContent = `${names[0]} is typing...`;
    typingEl.style.display = 'block';
  } else if (names.length === 2) {
    typingEl.textContent = `${names[0]} and ${names[1]} are typing...`;
    typingEl.style.display = 'block';
  } else {
    typingEl.textContent = `Several people are typing...`;
    typingEl.style.display = 'block';
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}