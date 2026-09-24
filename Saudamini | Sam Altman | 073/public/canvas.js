// public/canvas.js
const socket = io();

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const cursorContainer = document.getElementById('cursor-container');
const activeUsersList = document.getElementById('active-users');

// Room and User Setup
const urlParams = new URLSearchParams(window.location.search);
let currentBoard = urlParams.get('board') || 'DESIGN_101';
let username = prompt('Enter your name:') || `User_${Math.floor(Math.random() * 1000)}`;
const userColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const userColor = userColors[Math.floor(Math.random() * userColors.length)];

document.getElementById('room-input').value = currentBoard;
document.getElementById('display-username').textContent = username;

// Drawing state
let isDrawing = false;
let currentTool = 'pen'; // 'pen' or 'eraser'
let currentColor = '#ffffff';
let currentSize = 3;
let lastX = 0;
let lastY = 0;
let strokesHistory = [];
const remoteCursors = {};

// Resize canvas to fill parent container
function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  redrawAllStrokes();
}

window.addEventListener('resize', resizeCanvas);

// Redraw entire history
function redrawAllStrokes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokesHistory.forEach(s => renderStroke(s));
}

// Render a single stroke
function renderStroke(s) {
  ctx.beginPath();
  ctx.moveTo(s.prevX, s.prevY);
  ctx.lineTo(s.currX, s.currY);
  ctx.strokeStyle = s.tool === 'eraser' ? '#0f172a' : s.color;
  ctx.lineWidth = s.tool === 'eraser' ? s.size * 3 : s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// Join board room
socket.emit('board:join', { boardId: currentBoard, username, userColor });

// Sockets Listeners
socket.on('board:init', (data) => {
  strokesHistory = data.strokes || [];
  redrawAllStrokes();
  updateUsersList(data.activeUsers || []);
});

socket.on('user:joined', (user) => {
  appendUser(user);
});

socket.on('user:left', (data) => {
  removeUser(data.userId);
});

socket.on('draw:broadcast', ({ stroke }) => {
  strokesHistory.push(stroke);
  renderStroke(stroke);
});

socket.on('board:sync', (data) => {
  strokesHistory = data.strokes || [];
  redrawAllStrokes();
});

socket.on('board:cleared', (data) => {
  strokesHistory = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('cursor:update', (data) => {
  updateRemoteCursor(data);
});

// Canvas Drawing Events
canvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const currX = e.clientX - rect.left;
  const currY = e.clientY - rect.top;

  // Emit cursor movement
  socket.emit('cursor:move', { boardId: currentBoard, x: currX, y: currY });

  if (!isDrawing) return;

  const stroke = {
    prevX: lastX,
    prevY: lastY,
    currX,
    currY,
    color: currentColor,
    size: currentSize,
    tool: currentTool
  };

  strokesHistory.push(stroke);
  renderStroke(stroke);
  socket.emit('draw:stroke', { boardId: currentBoard, stroke });

  lastX = currX;
  lastY = currY;
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
});

// UI Tool Handlers
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.getAttribute('data-tool');
  });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    currentColor = swatch.getAttribute('data-color');
    currentTool = 'pen';
    document.querySelector('[data-tool="pen"]').classList.add('active');
    document.querySelector('[data-tool="eraser"]').classList.remove('active');
  });
});

document.getElementById('size-slider').addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
});

document.getElementById('btn-undo').addEventListener('click', () => {
  socket.emit('draw:undo', { boardId: currentBoard });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the canvas for everyone?')) {
    socket.emit('board:clear', { boardId: currentBoard });
  }
});

document.getElementById('btn-save').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `whiteboard-${currentBoard}.png`;
  link.href = canvas.toDataURL();
  link.click();
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const newRoom = document.getElementById('room-input').value.trim();
  if (newRoom && newRoom !== currentBoard) {
    window.location.search = `?board=${encodeURIComponent(newRoom)}`;
  }
});

// Remote Cursors and User presence
function updateRemoteCursor(data) {
  let cursorEl = remoteCursors[data.userId];
  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'remote-cursor';
    cursorEl.innerHTML = `
      <div class="cursor-dot" style="background: #3b82f6;"></div>
      <div class="cursor-label" style="background: #3b82f6;">Peer</div>
    `;
    cursorContainer.appendChild(cursorEl);
    remoteCursors[data.userId] = cursorEl;
  }
  cursorEl.style.left = `${data.x}px`;
  cursorEl.style.top = `${data.y}px`;
}

function updateUsersList(users) {
  activeUsersList.innerHTML = '';
  users.forEach(u => appendUser(u));
}

function appendUser(user) {
  const badge = document.createElement('span');
  badge.id = `user-${user.userId}`;
  badge.className = 'user-badge';
  badge.style.backgroundColor = user.color || '#3b82f6';
  badge.textContent = user.username;
  activeUsersList.appendChild(badge);
}

function removeUser(userId) {
  const badge = document.getElementById(`user-${userId}`);
  if (badge) badge.remove();
  if (remoteCursors[userId]) {
    remoteCursors[userId].remove();
    delete remoteCursors[userId];
  }
}

// Initial Resize
setTimeout(resizeCanvas, 50);
