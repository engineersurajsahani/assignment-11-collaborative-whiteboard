/**
 * Real-Time Collaborative Whiteboard Client
 * Handles Canvas 2D rendering, Socket.io event protocol, collaborator cursors, and UI state.
 */

// 1. URL Parameters & Setup
const urlParams = new URLSearchParams(window.location.search);
let boardId = urlParams.get('board') || 'demo';
let username = urlParams.get('username') || '';
let userColor = '#2563eb';

// Elements
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const cursorsOverlay = document.getElementById('cursors-overlay');
const boardNameDisplay = document.getElementById('board-name-display');
const btnCopyLink = document.getElementById('btn-copy-link');
const toolPen = document.getElementById('tool-pen');
const toolEraser = document.getElementById('tool-eraser');
const colorPicker = document.getElementById('color-picker');
const colorSwatches = document.querySelectorAll('.color-swatch');
const brushSizeInput = document.getElementById('brush-size');
const sizePreview = document.getElementById('size-preview');
const sizeValue = document.getElementById('size-value');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const avatarGroup = document.getElementById('avatar-group');
const usersCount = document.getElementById('users-count');
const connectionStatus = document.getElementById('connection-status');
const toastContainer = document.getElementById('toast-container');

// Modal Elements
const userModal = document.getElementById('user-modal');
const joinForm = document.getElementById('join-form');
const inputBoard = document.getElementById('input-board');
const inputUsername = document.getElementById('input-username');
const userColorBtns = document.querySelectorAll('.user-color-btn');

// State
let isDrawing = false;
let currentGroupId = null;
let prevX = 0;
let prevY = 0;
let currentTool = 'pen'; // 'pen' or 'eraser'
let currentColor = '#1e293b';
let currentSize = 4;
let localStrokes = []; // In-memory stroke buffer for re-renders and resizing
let activeUsersMap = new Map(); // socketId -> user info
let peerCursorsMap = new Map(); // socketId -> DOM Element & timer

// Initialize Socket.io
const socket = io();

// 2. High-DPI Canvas Resizing
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Redraw all strokes from buffer
  redrawCanvas();
}

window.addEventListener('resize', resizeCanvas);

// 3. Drawing Utilities
function drawSegment(stroke) {
  if (!stroke) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.stroke();
  ctx.closePath();
}

function redrawCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < localStrokes.length; i++) {
    drawSegment(localStrokes[i]);
  }
}

// Coordinate extraction helper
function getCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top)
  };
}

// 4. Pointer & Drawing Event Listeners
function startDrawing(e) {
  if (e.target !== canvas) return;
  const coords = getCanvasCoords(e);
  isDrawing = true;
  currentGroupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  prevX = coords.x;
  prevY = coords.y;

  // Single dot click handling
  const strokeColor = currentTool === 'eraser' ? '#ffffff' : currentColor;
  const stroke = {
    prevX: prevX,
    prevY: prevY,
    currX: coords.x + 0.1,
    currY: coords.y + 0.1,
    color: strokeColor,
    size: currentSize,
    groupId: currentGroupId
  };

  drawSegment(stroke);
  localStrokes.push(stroke);
  socket.emit('draw:stroke', { boardId, stroke });
}

let lastCursorEmit = 0;
const CURSOR_THROTTLE_MS = 25; // ~40fps for silky smooth cursor tracking

function handlePointerMove(e) {
  const coords = getCanvasCoords(e);

  // High-frequency pointer sync (ephemeral)
  const now = performance.now();
  if (now - lastCursorEmit > CURSOR_THROTTLE_MS) {
    socket.emit('cursor:move', { boardId, x: coords.x, y: coords.y });
    lastCursorEmit = now;
  }

  // Draw continuous stroke
  if (!isDrawing) return;

  const strokeColor = currentTool === 'eraser' ? '#ffffff' : currentColor;
  const stroke = {
    prevX: prevX,
    prevY: prevY,
    currX: coords.x,
    currY: coords.y,
    color: strokeColor,
    size: currentSize,
    groupId: currentGroupId
  };

  // Immediate local render for zero input lag
  drawSegment(stroke);
  localStrokes.push(stroke);

  // Relay to peers
  socket.emit('draw:stroke', { boardId, stroke });

  prevX = coords.x;
  prevY = coords.y;
}

function stopDrawing() {
  isDrawing = false;
}

// Mouse Events
canvas.addEventListener('mousedown', startDrawing);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', stopDrawing);

// Touch Events
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startDrawing(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (isDrawing) e.preventDefault();
  handlePointerMove(e);
}, { passive: false });

window.addEventListener('touchend', stopDrawing);
window.addEventListener('touchcancel', stopDrawing);

// 5. Collaborator Cursors Overlay
function updatePeerCursor(userId, x, y, peerName, color) {
  let cursorEntry = peerCursorsMap.get(userId);

  if (!cursorEntry) {
    // Create new cursor element
    const el = document.createElement('div');
    el.className = 'peer-cursor';
    el.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="${color || '#3b82f6'}" stroke="white" stroke-width="1.5"/>
      </svg>
      <span class="peer-cursor-label" style="background-color: ${color || '#3b82f6'};">${peerName || 'Collaborator'}</span>
    `;
    cursorsOverlay.appendChild(el);
    cursorEntry = { element: el, timeout: null };
    peerCursorsMap.set(userId, cursorEntry);
  }

  // Update position
  cursorEntry.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  cursorEntry.element.style.opacity = '1';

  // Fade out cursor after 4s of inactivity
  clearTimeout(cursorEntry.timeout);
  cursorEntry.timeout = setTimeout(() => {
    cursorEntry.element.style.opacity = '0';
  }, 4000);
}

function removePeerCursor(userId) {
  const cursorEntry = peerCursorsMap.get(userId);
  if (cursorEntry) {
    clearTimeout(cursorEntry.timeout);
    cursorEntry.element.remove();
    peerCursorsMap.delete(userId);
  }
}

// 6. UI Helpers & Avatars
function renderActiveUsers() {
  avatarGroup.innerHTML = '';
  const users = Array.from(activeUsersMap.values());
  usersCount.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;

  users.forEach(u => {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.style.backgroundColor = u.color || '#3b82f6';
    const initial = (u.username || 'U').charAt(0).toUpperCase();
    avatar.textContent = initial;
    avatar.title = u.username || 'Collaborator';
    avatarGroup.appendChild(avatar);
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// 7. Socket.io Protocol Handlers
socket.on('connect', () => {
  connectionStatus.className = 'status-badge connected';
  connectionStatus.querySelector('.status-text').textContent = 'Connected';
});

socket.on('disconnect', () => {
  connectionStatus.className = 'status-badge disconnected';
  connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
});

// Full state initialization on joining
socket.on('board:init', (data) => {
  localStrokes = data.strokes || [];
  redrawCanvas();

  activeUsersMap.clear();
  if (data.activeUsers && Array.isArray(data.activeUsers)) {
    data.activeUsers.forEach(user => {
      activeUsersMap.set(user.userId || user.username, user);
    });
  }
  renderActiveUsers();
});

// Real-time stroke segment from peer
socket.on('draw:broadcast', ({ stroke }) => {
  if (stroke) {
    localStrokes.push(stroke);
    drawSegment(stroke);
  }
});

// Real-time cursor position from peer
socket.on('cursor:update', ({ userId, x, y, username: peerName, color: peerColor }) => {
  const user = activeUsersMap.get(userId);
  const name = peerName || (user ? user.username : 'Collaborator');
  const col = peerColor || (user ? user.color : '#3b82f6');
  updatePeerCursor(userId, x, y, name, col);
});

// Peer joined
socket.on('user:joined', (user) => {
  activeUsersMap.set(user.userId, user);
  renderActiveUsers();
  showToast(`👋 ${user.username} joined`);
});

// Peer left
socket.on('user:left', ({ userId, username: leftName }) => {
  activeUsersMap.delete(userId);
  removePeerCursor(userId);
  renderActiveUsers();
  showToast(`🏃 ${leftName || 'A collaborator'} left`);
});

// Board cleared
socket.on('board:cleared', ({ clearedBy }) => {
  localStrokes = [];
  redrawCanvas();
  showToast(`🗑️ Canvas cleared by ${clearedBy || 'someone'}`);
});

// Board sync snapshot (after undo)
socket.on('board:sync', ({ strokes }) => {
  localStrokes = strokes || [];
  redrawCanvas();
});

// 8. Toolbar Controls & Actions
function updateSizePreview() {
  sizePreview.style.width = Math.min(currentSize, 18) + 'px';
  sizePreview.style.height = Math.min(currentSize, 18) + 'px';
  sizePreview.style.backgroundColor = currentTool === 'eraser' ? '#cbd5e1' : currentColor;
  sizeValue.textContent = currentSize + 'px';
}

// Tool switching
toolPen.addEventListener('click', () => {
  currentTool = 'pen';
  toolPen.classList.add('active');
  toolEraser.classList.remove('active');
  updateSizePreview();
});

toolEraser.addEventListener('click', () => {
  currentTool = 'eraser';
  toolEraser.classList.add('active');
  toolPen.classList.remove('active');
  updateSizePreview();
});

// Color picker
colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  if (currentTool === 'eraser') {
    currentTool = 'pen';
    toolPen.classList.add('active');
    toolEraser.classList.remove('active');
  }
  colorSwatches.forEach(s => s.classList.remove('active'));
  updateSizePreview();
});

// Swatches
colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    currentColor = swatch.getAttribute('data-color');
    colorPicker.value = currentColor;
    if (currentTool === 'eraser') {
      currentTool = 'pen';
      toolPen.classList.add('active');
      toolEraser.classList.remove('active');
    }
    updateSizePreview();
  });
});

// Brush size
brushSizeInput.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  updateSizePreview();
});

// Undo Action
btnUndo.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

// Clear Action
btnClear.addEventListener('click', () => {
  if (confirm('Clear the canvas for everyone in this room?')) {
    socket.emit('board:clear', { boardId });
  }
});

// Copy Invite Link
btnCopyLink.addEventListener('click', () => {
  const url = `${window.location.origin}${window.location.pathname}?board=${encodeURIComponent(boardId)}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('📋 Room link copied to clipboard!');
  }).catch(() => {
    prompt('Copy this room URL:', url);
  });
});

// Keyboard shortcuts (Ctrl+Z / Cmd+Z for undo, P for pen, E for eraser)
window.addEventListener('keydown', (e) => {
  if (userModal && !userModal.classList.contains('hidden')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    socket.emit('draw:undo', { boardId });
  } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) {
    toolPen.click();
  } else if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey) {
    toolEraser.click();
  }
});

// 9. User Setup Modal Handling
const randomGuestAdjectives = ['Swift', 'Creative', 'Bright', 'Nimble', 'Bold', 'Cosmic', 'Solar', 'Clever'];
const randomGuestAnimals = ['Fox', 'Falcon', 'Otter', 'Panda', 'Eagle', 'Badger', 'Lynx', 'Dolphin'];
const randomGuestName = () => {
  const adj = randomGuestAdjectives[Math.floor(Math.random() * randomGuestAdjectives.length)];
  const animal = randomGuestAnimals[Math.floor(Math.random() * randomGuestAnimals.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj} ${animal} #${num}`;
};

const paletteColors = ['#2563eb', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#14b8a6'];
userColor = paletteColors[Math.floor(Math.random() * paletteColors.length)];

// Pre-fill modal values
inputBoard.value = boardId;
inputUsername.value = urlUsername || randomGuestName();

// Update active user color button in modal
userColorBtns.forEach(btn => {
  if (btn.getAttribute('data-color') === userColor) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  btn.addEventListener('click', () => {
    userColorBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    userColor = btn.getAttribute('data-color');
  });
});

function joinRoom() {
  boardId = inputBoard.value.trim() || 'demo';
  username = inputUsername.value.trim() || randomGuestName();

  boardNameDisplay.textContent = boardId;
  userModal.classList.add('hidden');

  // Update browser URL query param without full reload
  const newUrl = `${window.location.pathname}?board=${encodeURIComponent(boardId)}`;
  window.history.replaceState(null, '', newUrl);

  // Emit board:join to server
  socket.emit('board:join', { boardId, username, userColor });
  showToast(`Joined board "${boardId}" as ${username}`);
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  joinRoom();
});

// Initial boot
resizeCanvas();
updateSizePreview();

// Auto join if username is provided in URL, otherwise show modal
if (urlUsername) {
  joinRoom();
}
