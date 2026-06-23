// chat.js — Campus Connect real-time chat

const socket = io();
const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('message-input');
const sendBtn     = document.getElementById('send-btn');

// ─── Join the room on page load ───────────────────────────────────────────────
socket.emit('join', { room_id: ROOM_ID, username: USERNAME });

// ─── Receive messages ─────────────────────────────────────────────────────────
socket.on('message', function (data) {
  appendMessage(data);
  scrollToBottom();
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

// ─── Leave room when navigating away ─────────────────────────────────────────
window.addEventListener('beforeunload', function () {
  socket.emit('leave', { room_id: ROOM_ID, username: USERNAME });
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

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}
