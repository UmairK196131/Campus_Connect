// chat.js — Campus Connect real-time chat

const SUPPORTED_EMOJIS = ['👍', '❤️', '😂'];
const AVATAR_PALETTE = ['#8b5cf6', '#22d3ee', '#f472b6', '#60a5fa', '#34d399', '#fb923c'];

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

const replyBanner         = document.getElementById('reply-banner');
const replyBannerUsername = document.getElementById('reply-banner-username');
const replyBannerText     = document.getElementById('reply-banner-text');
const replyBannerCancel   = document.getElementById('reply-banner-cancel');

// ─── State ─────────────────────────────────────────────────────────────────────
let typingTimeout;
let isTyping = false;
const typingUsers = new Set();
let replyingTo = null; // { id, username, text }

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

  const owner = getMessageOwner(bar);
  const text  = getMessageText(bar);

  bar.innerHTML = '';
  bar.appendChild(renderReactionButtons(data.reactions));
  bar.appendChild(buildReplyButton(owner, text));
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

// ─── Click handling inside the messages list (event delegation) ──────────────
// Covers: reaction buttons, reply buttons, and clicking a quoted reply to jump to it.
messagesEl.addEventListener('click', function (e) {
  const replyBtn = e.target.closest('.reply-btn');
  if (replyBtn) {
    const bar = replyBtn.closest('.reaction-bar');
    replyingTo = {
      id: bar ? bar.dataset.messageId : null,
      username: replyBtn.dataset.username,
      text: replyBtn.dataset.text
    };
    showReplyBanner();
    inputEl.focus();
    return;
  }

  const quote = e.target.closest('.reply-quote');
  if (quote) {
    const targetId = quote.dataset.jumpTo;
    const target = document.querySelector(`.message[data-msg-id="${targetId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('highlight');
      setTimeout(function () { target.classList.remove('highlight'); }, 1200);
    }
    return;
  }

  const reactBtn = e.target.closest('.react-btn');
  if (!reactBtn) return;

  const bar = reactBtn.closest('.reaction-bar');
  if (!bar) return;

  socket.emit('react', {
    room_id: ROOM_ID,
    message_id: bar.dataset.messageId,
    username: USERNAME,
    emoji: reactBtn.dataset.emoji
  });
});

// ─── Cancel reply ──────────────────────────────────────────────────────────────
replyBannerCancel.addEventListener('click', clearReply);

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
    room_id:     ROOM_ID,
    username:    USERNAME,
    text:        text,
    reply_to_id: replyingTo ? replyingTo.id : null
  });

  inputEl.value = '';
  inputEl.focus();
  clearReply();

  clearTimeout(typingTimeout);
  isTyping = false;
  socket.emit('stop_typing', { room_id: ROOM_ID, username: USERNAME });
}

function showReplyBanner() {
  replyBannerUsername.textContent = replyingTo.username;
  const txt = replyingTo.text.length > 60 ? replyingTo.text.slice(0, 57) + '...' : replyingTo.text;
  replyBannerText.textContent = txt;
  replyBanner.style.display = 'flex';
}

function clearReply() {
  replyingTo = null;
  replyBanner.style.display = 'none';
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
  wrapper.dataset.msgId = data.id;

  if (!isMe) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = colorForName(data.username);
    avatar.textContent = data.username.charAt(0).toUpperCase();
    wrapper.appendChild(avatar);
  }

  const content = document.createElement('div');
  content.className = 'message-content';

  let replyQuoteHtml = '';
  if (data.reply_to) {
    replyQuoteHtml = `
      <div class="reply-quote" data-jump-to="${data.reply_to.id}">
        <span class="reply-quote-user">${escapeHtml(data.reply_to.username)}</span>
        <span class="reply-quote-text">${escapeHtml(data.reply_to.text)}</span>
      </div>
    `;
  }

  content.innerHTML = `
    <div class="msg-header">
      <span class="msg-username">${isMe ? 'You' : escapeHtml(data.username)}</span>
      <span class="msg-time">${escapeHtml(data.time)}</span>
    </div>
    ${replyQuoteHtml}
    <div class="msg-bubble">${escapeHtml(data.text)}</div>
  `;

  const reactionBar = document.createElement('div');
  reactionBar.className = 'reaction-bar';
  reactionBar.dataset.messageId = data.id;
  reactionBar.appendChild(renderReactionButtons({}));
  reactionBar.appendChild(buildReplyButton(data.username, data.text));
  content.appendChild(reactionBar);

  wrapper.appendChild(content);
  messagesEl.appendChild(wrapper);
}

function buildReplyButton(username, text) {
  const btn = document.createElement('button');
  btn.className = 'reply-btn';
  btn.type = 'button';
  btn.title = 'Reply';
  btn.dataset.username = username;
  btn.dataset.text = text;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 14 4 9l5-5M4 9h10a5 5 0 0 1 5 5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return btn;
}

function getMessageOwner(reactionBar) {
  const existing = reactionBar.querySelector('.reply-btn');
  return existing ? existing.dataset.username : '';
}

function getMessageText(reactionBar) {
  const existing = reactionBar.querySelector('.reply-btn');
  return existing ? existing.dataset.text : '';
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