const socket = io();

// DOM elements
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const cursorOverlay = document.getElementById('cursor-overlay');

const roomDisplay = document.getElementById('room-display');
const userDisplay = document.getElementById('user-display');
const usersCount = document.getElementById('users-count');

const colorPicker = document.getElementById('color-picker');
const sizeSlider = document.getElementById('size-slider');
const sizeVal = document.getElementById('size-val');

const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');

const joinModal = document.getElementById('join-modal');
const joinBtn = document.getElementById('join-btn');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const userColorInput = document.getElementById('user-color-input');

// Application state
let boardId = 'DESIGN_101';
let username = 'User1';
let userColor = '#ff5722';

let currentTool = 'pencil';
let currentColor = '#000000';
let currentSize = 3;

let isDrawing = false;
let startX = 0;
let startY = 0;
let lastX = 0;
let lastY = 0;
let currentStrokeId = null;

let strokes = [];
let activeUsers = [];
const peerCursors = {};
let lastCursorTime = 0;

// Set up canvas sizing
function initCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  redraw();
}

window.addEventListener('resize', initCanvas);

// Parse URL params
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('board')) {
  boardId = urlParams.get('board');
  roomInput.value = boardId;
}

// Get mouse position relative to canvas
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top)
  };
}

// Draw a single stroke object
function drawStroke(context, stroke) {
  if (!stroke) return;

  context.save();
  context.beginPath();
  context.lineWidth = stroke.size;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (stroke.tool === 'eraser') {
    context.strokeStyle = '#ffffff';
  } else {
    context.strokeStyle = stroke.color;
  }

  if (stroke.tool === 'pencil' || stroke.tool === 'eraser' || stroke.tool === 'line') {
    context.moveTo(stroke.prevX, stroke.prevY);
    context.lineTo(stroke.currX, stroke.currY);
    context.stroke();
  } else if (stroke.tool === 'rect') {
    const width = stroke.currX - stroke.prevX;
    const height = stroke.currY - stroke.prevY;
    context.strokeRect(stroke.prevX, stroke.prevY, width, height);
  } else if (stroke.tool === 'circle') {
    const rx = Math.abs(stroke.currX - stroke.prevX) / 2;
    const ry = Math.abs(stroke.currY - stroke.prevY) / 2;
    const cx = Math.min(stroke.prevX, stroke.currX) + rx;
    const cy = Math.min(stroke.prevY, stroke.currY) + ry;
    if (rx > 0 && ry > 0) {
      context.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      context.stroke();
    }
  }

  context.restore();
}

// Redraw entire canvas history
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < strokes.length; i++) {
    drawStroke(ctx, strokes[i]);
  }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
  const pos = getPos(e);
  isDrawing = true;
  startX = pos.x;
  startY = pos.y;
  lastX = pos.x;
  lastY = pos.y;
  currentStrokeId = 'stk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
});

canvas.addEventListener('mousemove', (e) => {
  const pos = getPos(e);

  // Send cursor move
  const now = Date.now();
  if (now - lastCursorTime > 30) {
    lastCursorTime = now;
    socket.emit('cursor:move', { boardId, x: pos.x, y: pos.y });
  }

  if (!isDrawing) return;

  if (currentTool === 'pencil' || currentTool === 'eraser') {
    const stroke = {
      prevX: lastX,
      prevY: lastY,
      currX: pos.x,
      currY: pos.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
      strokeId: currentStrokeId
    };

    drawStroke(ctx, stroke);
    strokes.push(stroke);
    socket.emit('draw:stroke', { boardId, stroke });

    lastX = pos.x;
    lastY = pos.y;
  } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
    redraw();
    const tempStroke = {
      prevX: startX,
      prevY: startY,
      currX: pos.x,
      currY: pos.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
      strokeId: currentStrokeId
    };
    drawStroke(ctx, tempStroke);
  }
});

function stopDrawing(e) {
  if (!isDrawing) return;

  if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'circle') {
    const pos = getPos(e);
    const stroke = {
      prevX: startX,
      prevY: startY,
      currX: pos.x,
      currY: pos.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
      strokeId: currentStrokeId
    };
    redraw();
    drawStroke(ctx, stroke);
    strokes.push(stroke);
    socket.emit('draw:stroke', { boardId, stroke });
  }

  isDrawing = false;
  currentStrokeId = null;
}

canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

// Toolbar interactions
document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
});

sizeSlider.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  sizeVal.textContent = currentSize + 'px';
});

undoBtn.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

clearBtn.addEventListener('click', () => {
  if (confirm('Clear canvas for everyone?')) {
    socket.emit('board:clear', { boardId });
  }
});

// Join button
joinBtn.addEventListener('click', () => {
  username = usernameInput.value.trim() || 'User';
  boardId = roomInput.value.trim() || 'DESIGN_101';
  userColor = userColorInput.value;

  roomDisplay.textContent = 'Room: ' + boardId;
  userDisplay.textContent = 'User: ' + username;

  joinModal.classList.add('hidden');
  initCanvas();

  socket.emit('board:join', { boardId, username, userColor });
});

// Socket events
socket.on('board:init', (data) => {
  strokes = data.strokes || [];
  activeUsers = data.activeUsers || [];
  usersCount.textContent = 'Users: ' + activeUsers.length;
  redraw();
});

socket.on('user:joined', (user) => {
  activeUsers.push(user);
  usersCount.textContent = 'Users: ' + activeUsers.length;
});

socket.on('user:left', (data) => {
  if (peerCursors[data.userId]) {
    peerCursors[data.userId].remove();
    delete peerCursors[data.userId];
  }
  activeUsers = activeUsers.filter((u) => u.userId !== data.userId);
  usersCount.textContent = 'Users: ' + activeUsers.length;
});

socket.on('draw:broadcast', (data) => {
  if (data && data.stroke) {
    strokes.push(data.stroke);
    drawStroke(ctx, data.stroke);
  }
});

socket.on('cursor:update', (data) => {
  let el = peerCursors[data.userId];
  if (!el) {
    const user = activeUsers.find((u) => u.userId === data.userId) || {};
    const color = user.color || '#3b82f6';
    const name = user.username || 'User';

    el = document.createElement('div');
    el.className = 'peer-cursor';
    el.innerHTML = `
      <div class="peer-cursor-point" style="background-color: ${color}"></div>
      <div class="peer-cursor-label">${name}</div>
    `;
    cursorOverlay.appendChild(el);
    peerCursors[data.userId] = el;
  }
  el.style.transform = `translate(${data.x}px, ${data.y}px)`;
});

socket.on('board:cleared', () => {
  strokes = [];
  redraw();
});

socket.on('board:sync', (data) => {
  strokes = data.strokes || [];
  redraw();
});
