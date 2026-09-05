// Client-Side Collaborative Canvas Engine
const socket = io();

// Canvas & Context references
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const cursorsContainer = document.getElementById('cursors-container');

// State Variables
let isDrawing = false;
let currentTool = 'brush'; // 'brush' or 'eraser'
let currentColor = '#1E293B';
let currentSize = 3;
let currentActionId = null;
let prevX = 0;
let prevY = 0;

// User & Room details
let boardId = '';
let username = '';
const userColor = generateRandomColor();

// DOM Elements
const currentBoardNameEl = document.getElementById('current-board-name');
const userCountEl = document.getElementById('user-count');
const usersAvatarListEl = document.getElementById('users-avatar-list');
const joinModal = document.getElementById('join-modal');
const joinForm = document.getElementById('join-form');
const inputBoardId = document.getElementById('input-board-id');
const inputUsername = document.getElementById('input-username');
const strokeSizeInput = document.getElementById('stroke-size');
const sizeLabel = document.getElementById('size-label');
const sizePreview = document.getElementById('size-preview');
const customColorPicker = document.getElementById('custom-color-picker');
const colorSwatches = document.querySelectorAll('.color-swatch');
const toolBrushBtn = document.getElementById('tool-brush');
const toolEraserBtn = document.getElementById('tool-eraser');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const btnDownload = document.getElementById('btn-download');
const btnShare = document.getElementById('btn-share');
const btnSwitchRoom = document.getElementById('btn-switch-room');
const toastEl = document.getElementById('toast');

// Map of remote cursors: { [userId]: DOMElement }
const remoteCursors = {};

// Helper: Generate distinct collaborator color
function generateRandomColor() {
  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Show Toast notification
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

// Initialize Canvas Sizing with High-DPI support
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Save current drawing image data before resize
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Restore image data
  ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
}

window.addEventListener('resize', resizeCanvas);

// URL parameters parsing (?board=DESIGN_101&user=Alice)
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const urlBoard = params.get('board');
  const urlUser = params.get('user');

  if (urlBoard) {
    inputBoardId.value = urlBoard;
  }
  if (urlUser) {
    inputUsername.value = urlUser;
  }

  if (urlBoard && urlUser) {
    joinRoom(urlBoard, urlUser);
  } else {
    joinModal.classList.remove('hidden');
    inputUsername.focus();
  }
}

// Join Room Handler
function joinRoom(selectedBoard, enteredUser) {
  boardId = selectedBoard.trim() || 'DESIGN_101';
  username = enteredUser.trim() || `User_${Math.floor(Math.random() * 900 + 100)}`;

  currentBoardNameEl.textContent = boardId;
  joinModal.classList.add('hidden');

  // Update URL without reload
  const newUrl = `${window.location.pathname}?board=${encodeURIComponent(boardId)}&user=${encodeURIComponent(username)}`;
  window.history.replaceState(null, '', newUrl);

  resizeCanvas();

  // Emit board join event to server
  socket.emit('board:join', {
    boardId,
    username,
    userColor
  });

  showToast(`Joined board room: ${boardId}`);
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  joinRoom(inputBoardId.value, inputUsername.value);
});

btnSwitchRoom.addEventListener('click', () => {
  joinModal.classList.remove('hidden');
});

btnShare.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  showToast('📋 Board URL copied to clipboard!');
});

// Render a stroke segment on canvas
function renderStroke(stroke) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);

  if (stroke.isEraser) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = stroke.size * 2;
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.closePath();
  ctx.restore();
}

// Drawing Event Listeners
function getCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startDrawing(e) {
  isDrawing = true;
  currentActionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const coords = getCoordinates(e);
  prevX = coords.x;
  prevY = coords.y;
}

function draw(e) {
  const coords = getCoordinates(e);

  // Emit cursor movement for collaborator tracking
  emitCursor(coords.x, coords.y);

  if (!isDrawing) return;

  const currX = coords.x;
  const currY = coords.y;

  const stroke = {
    prevX,
    prevY,
    currX,
    currY,
    color: currentColor,
    size: currentSize,
    isEraser: currentTool === 'eraser',
    actionId: currentActionId
  };

  // Draw locally
  renderStroke(stroke);

  // Emit to server
  socket.emit('draw:stroke', {
    boardId,
    stroke
  });

  prevX = currX;
  prevY = currY;
}

function stopDrawing() {
  isDrawing = false;
}

// Mouse & Touch bindings
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startDrawing(e);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  draw(e);
}, { passive: false });

window.addEventListener('touchend', stopDrawing);

// Throttled cursor emission
let lastCursorEmit = 0;
function emitCursor(x, y) {
  const now = Date.now();
  if (now - lastCursorEmit > 30) { // ~33fps
    socket.emit('cursor:move', { boardId, x, y });
    lastCursorEmit = now;
  }
}

// Tool Selection Handlers
toolBrushBtn.addEventListener('click', () => {
  currentTool = 'brush';
  toolBrushBtn.classList.add('active');
  toolEraserBtn.classList.remove('active');
  canvas.style.cursor = 'crosshair';
});

toolEraserBtn.addEventListener('click', () => {
  currentTool = 'eraser';
  toolEraserBtn.classList.add('active');
  toolBrushBtn.classList.remove('active');
  canvas.style.cursor = 'cell';
});

// Color Selection Handlers
colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    currentColor = swatch.getAttribute('data-color');
    customColorPicker.value = currentColor;
    sizePreview.style.backgroundColor = currentColor;
  });
});

customColorPicker.addEventListener('input', (e) => {
  colorSwatches.forEach(s => s.classList.remove('active'));
  currentColor = e.target.value;
  sizePreview.style.backgroundColor = currentColor;
});

// Size Selection Handler
strokeSizeInput.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  sizeLabel.textContent = `${currentSize}px`;
  sizePreview.style.width = `${Math.min(currentSize, 24)}px`;
  sizePreview.style.height = `${Math.min(currentSize, 24)}px`;
});

// Undo Handler
btnUndo.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    socket.emit('draw:undo', { boardId });
  }
});

// Clear Canvas Handler
btnClear.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the canvas for everyone in this room?')) {
    socket.emit('board:clear', { boardId });
  }
});

// Export as PNG
btnDownload.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `${boardId}_whiteboard.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('💾 Board image exported!');
});

// ==================== Socket.io Handlers ====================

// 1. Initial State Hydration on Room Join
socket.on('board:init', ({ strokes, activeUsers }) => {
  // Clear and replay all existing strokes
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (strokes && Array.isArray(strokes)) {
    strokes.forEach(stroke => renderStroke(stroke));
  }
  updateUsersList(activeUsers);
});

// 2. Incoming Stroke Broadcast from collaborator
socket.on('draw:broadcast', ({ stroke }) => {
  renderStroke(stroke);
});

// 3. Canvas Cleared Event
socket.on('board:cleared', ({ clearedBy }) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  showToast(`🧹 Canvas cleared by ${clearedBy}`);
});

// 4. State Sync Event (After Undo)
socket.on('board:sync', ({ strokes }) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (strokes && Array.isArray(strokes)) {
    strokes.forEach(stroke => renderStroke(stroke));
  }
});

// 5. Collaborator Cursor Updates
socket.on('cursor:update', ({ userId, username, color, x, y }) => {
  let cursorEl = remoteCursors[userId];

  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.className = 'collaborator-cursor';
    cursorEl.innerHTML = `
      <svg class="cursor-pointer-icon" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"/>
      </svg>
      <span class="cursor-label" style="background-color: ${color};">${username}</span>
    `;
    cursorsContainer.appendChild(cursorEl);
    remoteCursors[userId] = cursorEl;
  }

  cursorEl.style.transform = `translate(${x}px, ${y}px)`;
});

// 6. User Joined / Left Roster Updates
socket.on('user:joined', ({ username, color }) => {
  showToast(`👋 ${username} joined the board`);
});

socket.on('user:left', ({ userId, username }) => {
  if (remoteCursors[userId]) {
    remoteCursors[userId].remove();
    delete remoteCursors[userId];
  }
  showToast(`🚪 ${username} left the board`);
});

function updateUsersList(users) {
  if (!users) return;
  userCountEl.textContent = `${users.length} online`;
  usersAvatarListEl.innerHTML = '';

  users.slice(0, 5).forEach(user => {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar-badge';
    avatar.style.backgroundColor = user.color || '#3B82F6';
    avatar.textContent = (user.username || 'U').charAt(0).toUpperCase();
    avatar.title = user.username;
    usersAvatarListEl.appendChild(avatar);
  });

  if (users.length > 5) {
    const extra = document.createElement('div');
    extra.className = 'user-avatar-badge';
    extra.style.backgroundColor = '#64748B';
    extra.textContent = `+${users.length - 5}`;
    usersAvatarListEl.appendChild(extra);
  }
}

// Start application
parseUrlParams();
