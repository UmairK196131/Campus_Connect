// chat.js — Campus Connect real-time chat

const SUPPORTED_EMOJIS = ['👍', '❤️', '😂'];
const AVATAR_PALETTE = ['#f0a857', '#6fe7c0', '#f2789a', '#8ea0ff', '#9ad18f', '#ff8a65'];

function colorForName(name) {
  let total = 0;
  for (let i = 0; i < name.length; i++) total += name.charCodeAt(i);
  return AVATAR_PALETTE[total % AVATAR_PALETTE.length];
}

const socket = io();
const messagesEl    = document.getElementById('messages');
const inputEl       = document.getElementById('message-input');
const sendBtn       = document.getElementById('send-btn');
const typingEl      = document.getElementById('typing-indicator');
const typingTextEl  = document.getElementById('typing-text');
const activeCountTextEl = document.getElementById('active-count-text');

// ─── Typing State ──────────────────────────────────────────────────────────────
let typingTimeout;
let isTyping = false;
const typingUsers = new Set();

// ─── Join the room on page load ───────────────────────────────────────────────
socket.emit('join', { room_id: ROOM_ID, username: USERNAME });

// ─── Receive messages ─────────────────────────────────────────────────────────
socket.on('message', function (data) {
  if (!data.is_system) {
    typingUsers.delete(data.username);
    updateTypingIndicator();
  }
  appendMessage(data);
  scrollToBottom();
});

// ─── Receive typing events ────────────────────────────────────────────────────
socket.on('user_typing', function (data) {
  typingUsers.add(data.username);
  updateTypingIndicator();
});

socket.on('user_stopped_typing', function (data) {
  typingUsers.delete(data.username);
  updateTypingIndicator();
});

// ─── Receive online count updates ─────────────────────────────────────────────
socket.on('active_users', function (data) {
  activeCountTextEl.textContent = `${data.count} online`;
});

// ─── Receive reaction updates ─────────────────────────────────────────────────
socket.on('reaction_update', function (data) {
  const bar = document.querySelector(`.reaction-bar[data-message-id="${data.message_id}"]`);
  if (!bar) return;
  bar.innerHTML = '';
  bar.appendChild(renderReactionButtons(data.reactions));
});

// ─── Send message on button click ─────────────────────────────────────────────
sendBtn.addEventListener('click', sendMessage);

// ─── Send message on Enter key ────────────────────────────────────────────────
inputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ─── Detect typing ─────────────────────────────────────────────────────────────
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

// ─── Reaction button clicks (event delegation — works for history AND new messages) ──
messagesEl.addEventListener('click', function (e) {
  const btn = e.target.closest('.react-btn');
  if (!btn) return;

  const bar = btn.closest('.reaction-bar');
  if (!bar) return;

  const messageId = bar.dataset.messageId;
  const emoji = btn.dataset.emoji;

  socket.emit('react', {
    room_id: ROOM_ID,
    message_id: messageId,
    username: USERNAME,
    emoji: emoji
  });
});

// ─── Leave room when navigating away ─────────────────────────────────────────
window.addEventListener('beforeunload', function () {
  socket.emit('leave', { room_id: ROOM_ID, username: USERNAME });
  socket.emit('stop_typing', { room_id: ROOM_ID, username: USERNAME });
});

// ─── Functions ────────────────────────────────────────────────────────────────

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
    wrapper.innerHTML = `<div class="msg-bubble">${escapeHtml(data.text)}</div>`;
    messagesEl.appendChild(wrapper);
    return;
  }

  const isMe = data.username === USERNAME;
  wrapper.className = `message ${isMe ? 'mine' : 'theirs'}`;

  if (!isMe) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = colorForName(data.username);
    avatar.textContent = data.username.charAt(0).toUpperCase();
    wrapper.appendChild(avatar);
  }

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = `
    <div class="msg-header">
      <span class="msg-username">${isMe ? 'You' : escapeHtml(data.username)}</span>
      <span class="msg-time">${escapeHtml(data.time)}</span>
    </div>
    <div class="msg-bubble">${escapeHtml(data.text)}</div>
  `;

  const reactionBar = document.createElement('div');
  reactionBar.className = 'reaction-bar';
  reactionBar.dataset.messageId = data.id;
  reactionBar.appendChild(renderReactionButtons({}));
  content.appendChild(reactionBar);

  wrapper.appendChild(content);
  messagesEl.appendChild(wrapper);
}

function renderReactionButtons(reactionsObj) {
  const frag = document.createDocumentFragment();

  SUPPORTED_EMOJIS.forEach(function (emoji) {
    const usersList = reactionsObj[emoji] || [];
    const count = usersList.length;
    const mine = usersList.includes(USERNAME);

    const btn = document.createElement('button');
    btn.className = 'react-btn' + (mine ? ' active' : '');
    btn.dataset.emoji = emoji;
    btn.textContent = count > 0 ? `${emoji} ${count}` : emoji;
    frag.appendChild(btn);
  });

  return frag;
}

function updateTypingIndicator() {
  const names = Array.from(typingUsers);

  if (names.length === 0) {
    typingTextEl.textContent = '';
    typingEl.classList.remove('active');
  } else if (names.length === 1) {
    typingTextEl.textContent = `${names[0]} is typing`;
    typingEl.classList.add('active');
  } else if (names.length === 2) {
    typingTextEl.textContent = `${names[0]} and ${names[1]} are typing`;
    typingEl.classList.add('active');
  } else {
    typingTextEl.textContent = `Several people are typing`;
    typingEl.classList.add('active');
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