// Establish Socket.io connection
const socket = io();

// UI Elements
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const cursorsLayer = document.getElementById('cursorsLayer');
const toastContainer = document.getElementById('toastContainer');
const boardIdInput = document.getElementById('boardIdInput');
const usernameInput = document.getElementById('usernameInput');
const userColorPicker = document.getElementById('userColorPicker');
const joinBtn = document.getElementById('joinBtn');
const roomStatusText = document.getElementById('roomStatusText');
const activeUsersList = document.getElementById('activeUsersList');

const brushToolBtn = document.getElementById('brushToolBtn');
const eraserToolBtn = document.getElementById('eraserToolBtn');
const brushColorPicker = document.getElementById('brushColorPicker');
const brushSizeInput = document.getElementById('brushSizeInput');
const brushSizeVal = document.getElementById('brushSizeVal');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const colorSwatches = document.querySelectorAll('.color-swatch');

// Canvas Background Color Constant
const CANVAS_BG_COLOR = '#0b0f19';

// Application State
let currentBoardId = 'demo';
let currentUsername = '';
let currentUserColor = '#3b82f6';
let isJoined = false;

let isDrawing = false;
let currentStrokeId = null;
let lastX = 0;
let lastY = 0;

let currentTool = 'brush'; // 'brush' or 'eraser'
let currentColor = '#f8fafc';
let currentSize = 4;

// Remote collaborator cursors map: socketId -> DOM Element
const remoteCursors = {};

// Helper: Random Color Generator
function getRandomColor() {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate random username if none provided
function generateRandomUsername() {
  const adjectives = ['Swift', 'Creative', 'Bright', 'Nimble', 'Bold', 'Silent', 'Cosmic'];
  const nouns = ['Artist', 'Painter', 'Sketcher', 'Doodler', 'Creator', 'Designer', 'Coder'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${adj}${noun}_${num}`;
}

// Helper: Show Toast Notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialize Canvas Dimensions with Window Resize Support
function resizeCanvas() {
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Set physical pixel dimensions for crisp rendering
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Scale context coordinates to match CSS pixels
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

window.addEventListener('resize', () => {
  // Save current image, resize, and restore
  const prevWidth = canvas.width;
  const prevHeight = canvas.height;
  if (prevWidth > 0 && prevHeight > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = prevWidth;
    tempCanvas.height = prevHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    resizeCanvas();
    ctx.drawImage(tempCanvas, 0, 0);
  } else {
    resizeCanvas();
  }
});

// Setup Initial Identity from URL Parameters or Defaults
function initIdentity() {
  const urlParams = new URLSearchParams(window.location.search);
  const boardFromUrl = urlParams.get('board') || 'demo';
  const nameFromUrl = urlParams.get('user') || generateRandomUsername();
  const colorFromUrl = urlParams.get('color') || getRandomColor();

  boardIdInput.value = boardFromUrl;
  usernameInput.value = nameFromUrl;
  userColorPicker.value = colorFromUrl;

  currentBoardId = boardFromUrl;
  currentUsername = nameFromUrl;
  currentUserColor = colorFromUrl;
}

// Join Board Room Function
function joinBoardRoom() {
  const boardId = boardIdInput.value.trim();
  const username = usernameInput.value.trim() || generateRandomUsername();
  const userColor = userColorPicker.value;

  if (!boardId) {
    alert('Please enter a valid Board ID');
    return;
  }

  currentBoardId = boardId;
  currentUsername = username;
  currentUserColor = userColor;
  usernameInput.value = username;

  // Emit board:join to server
  socket.emit('board:join', {
    boardId: currentBoardId,
    username: currentUsername,
    userColor: currentUserColor
  });

  isJoined = true;
  roomStatusText.textContent = `Connected: Room #${currentBoardId}`;
  roomStatusText.style.color = '#10b981';
  showToast(`Joined board: ${currentBoardId}`);
}

// Render stroke on canvas
function drawLineSegment(stroke) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// Redraw all strokes from server history
function redrawAllStrokes(strokes) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (Array.isArray(strokes)) {
    for (const stroke of strokes) {
      drawLineSegment(stroke);
    }
  }
}

// Update Active Users List UI
function updateUsersListUI(users) {
  activeUsersList.innerHTML = '';
  if (!users) return;

  Object.values(users).forEach((user) => {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.style.backgroundColor = user.color || '#3b82f6';
    avatar.textContent = (user.username || 'U').substring(0, 2).toUpperCase();
    avatar.title = `${user.username}${user.socketId === socket.id ? ' (You)' : ''}`;
    activeUsersList.appendChild(avatar);
  });
}

// Get Cursor Position relative to Canvas
function getCanvasCoordinates(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

// Mouse & Touch Event Handlers for Drawing
function startDrawing(e) {
  if (!isJoined) return;
  const coords = getCanvasCoordinates(e);
  isDrawing = true;
  lastX = coords.x;
  lastY = coords.y;
  currentStrokeId = 'stroke_' + socket.id + '_' + Date.now();
}

function handleDrawing(e) {
  const coords = getCanvasCoordinates(e);

  // Send live cursor coordinate to server (throttled/on move)
  if (isJoined) {
    socket.emit('cursor:move', {
      boardId: currentBoardId,
      x: coords.x,
      y: coords.y
    });
  }

  if (!isDrawing || !isJoined) return;

  const strokeColor = currentTool === 'eraser' ? CANVAS_BG_COLOR : currentColor;
  const strokeSize = currentTool === 'eraser' ? currentSize * 3 : currentSize;

  const strokeData = {
    strokeId: currentStrokeId,
    prevX: lastX,
    prevY: lastY,
    currX: coords.x,
    currY: coords.y,
    color: strokeColor,
    size: strokeSize
  };

  // Draw locally
  drawLineSegment(strokeData);

  // Broadcast to other room members
  socket.emit('draw:stroke', {
    boardId: currentBoardId,
    stroke: strokeData
  });

  lastX = coords.x;
  lastY = coords.y;
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  currentStrokeId = null;
}

// Event Listeners for Canvas Pointer Interaction
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', handleDrawing);
window.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', () => {
  stopDrawing();
});

// Touch Device Support
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    startDrawing(e.touches[0]);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 1) {
    handleDrawing(e.touches[0]);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopDrawing();
}, { passive: false });

// Toolbar Controls
joinBtn.addEventListener('click', joinBoardRoom);

boardIdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBoardRoom();
});
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBoardRoom();
});

brushToolBtn.addEventListener('click', () => {
  currentTool = 'brush';
  brushToolBtn.classList.add('active');
  eraserToolBtn.classList.remove('active');
});

eraserToolBtn.addEventListener('click', () => {
  currentTool = 'eraser';
  eraserToolBtn.classList.add('active');
  brushToolBtn.classList.remove('active');
});

colorSwatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    colorSwatches.forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    currentColor = swatch.dataset.color;
    brushColorPicker.value = currentColor;
    if (currentTool === 'eraser') {
      brushToolBtn.click();
    }
  });
});

brushColorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorSwatches.forEach((s) => s.classList.remove('active'));
  if (currentTool === 'eraser') {
    brushToolBtn.click();
  }
});

brushSizeInput.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  brushSizeVal.textContent = `${currentSize}px`;
});

// Clear Canvas Button Handler
clearBtn.addEventListener('click', () => {
  if (!isJoined) return;
  if (confirm('Are you sure you want to clear the whiteboard for everyone?')) {
    socket.emit('board:clear', {
      boardId: currentBoardId
    });
  }
});

// Undo Button Handler
undoBtn.addEventListener('click', () => {
  if (!isJoined) return;
  socket.emit('draw:undo', {
    boardId: currentBoardId
  });
});

// Update Remote Collaborator Cursor Marker
function updateRemoteCursor(data) {
  const { userId, username, color, x, y } = data;
  if (userId === socket.id) return;

  let cursorElem = remoteCursors[userId];
  if (!cursorElem) {
    cursorElem = document.createElement('div');
    cursorElem.className = 'collaborator-cursor';
    cursorElem.id = `cursor-${userId}`;
    cursorElem.innerHTML = `
      <svg class="cursor-pointer" viewBox="0 0 24 24" fill="${color || '#3b82f6'}">
        <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.879v-21z"/>
      </svg>
      <div class="cursor-label" style="background-color: ${color || '#3b82f6'};">${username || 'User'}</div>
    `;
    cursorsLayer.appendChild(cursorElem);
    remoteCursors[userId] = cursorElem;
  }

  cursorElem.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function removeRemoteCursor(userId) {
  if (remoteCursors[userId]) {
    remoteCursors[userId].remove();
    delete remoteCursors[userId];
  }
}

// ---------------- Socket.io Event Listeners ----------------

// Initial state received on joining board
socket.on('board:init', (data) => {
  redrawAllStrokes(data.strokes);
  updateUsersListUI(data.users);
});

// Incoming drawing stroke from another user
socket.on('draw:broadcast', (stroke) => {
  drawLineSegment(stroke);
});

// Synchronized full board state (e.g. after undo)
socket.on('board:sync', (data) => {
  redrawAllStrokes(data.strokes);
});

// Board cleared event
socket.on('board:cleared', (data) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  showToast(`${data.clearedBy || 'A user'} cleared the canvas`);
});

// Remote cursor update
socket.on('cursor:update', (data) => {
  updateRemoteCursor(data);
});

// Another user joined
socket.on('user:joined', (data) => {
  updateUsersListUI(data.users);
  showToast(`${data.username} joined the board`);
});

// Another user disconnected
socket.on('user:left', (data) => {
  updateUsersListUI(data.users);
  removeRemoteCursor(data.socketId);
  showToast(`${data.username || 'A user'} left the board`);
});

// Connection error or reconnect handling
socket.on('disconnect', () => {
  roomStatusText.textContent = 'Disconnected';
  roomStatusText.style.color = '#ef4444';
});

socket.on('connect', () => {
  if (isJoined) {
    joinBoardRoom();
  }
});

// Kick off initialization
resizeCanvas();
initIdentity();
// Automatically join default room on initial load
joinBoardRoom();
