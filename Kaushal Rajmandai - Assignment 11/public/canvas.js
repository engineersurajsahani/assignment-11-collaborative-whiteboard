const socket = io();

const params = new URLSearchParams(window.location.search);
const boardId = params.get('board') || 'default';
document.getElementById('boardLabel').textContent = `Board: ${boardId}`;

const username = 'User-' + Math.floor(Math.random() * 1000);
const userColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const wrapper = document.getElementById('canvasWrapper');
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  redrawAll();
}
window.addEventListener('resize', resizeCanvas);

let allStrokes = [];
let currentStrokeId = null;
let drawing = false;
let lastX = 0, lastY = 0;

const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');

function drawSegment(stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.stroke();
}

function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  allStrokes.forEach(drawSegment);
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  currentStrokeId = Date.now() + '-' + Math.random();
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  socket.emit('cursor:move', { boardId, x, y });

  if (!drawing) return;

  const stroke = {
    strokeId: currentStrokeId,
    prevX: lastX,
    prevY: lastY,
    currX: x,
    currY: y,
    color: colorPicker.value,
    size: parseInt(sizePicker.value, 10)
  };

  drawSegment(stroke);
  allStrokes.push(stroke);
  socket.emit('draw:stroke', { boardId, stroke });

  lastX = x;
  lastY = y;
});

window.addEventListener('mouseup', () => { drawing = false; currentStrokeId = null; });

document.getElementById('clearBtn').addEventListener('click', () => {
  socket.emit('board:clear', { boardId });
});

document.getElementById('undoBtn').addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

// --- Socket event listeners ---

socket.on('connect', () => {
  socket.emit('board:join', { boardId, username, userColor });
});

socket.on('board:init', ({ strokes, activeUsers }) => {
  allStrokes = strokes;
  redrawAll();
  renderUserList(activeUsers);
});

socket.on('draw:broadcast', ({ stroke }) => {
  allStrokes.push(stroke);
  drawSegment(stroke);
});

socket.on('board:cleared', ({ clearedBy }) => {
  allStrokes = [];
  redrawAll();
  console.log(`Board cleared by ${clearedBy}`);
});

socket.on('board:sync', ({ strokes }) => {
  allStrokes = strokes;
  redrawAll();
});

const activeUsers = {};

socket.on('user:joined', ({ userId, username, color }) => {
  activeUsers[userId] = { username, color };
  renderUserList(Object.entries(activeUsers).map(([id, u]) => ({ userId: id, ...u })));
});

socket.on('user:left', ({ userId }) => {
  delete activeUsers[userId];
  removeCursor(userId);
  renderUserList(Object.entries(activeUsers).map(([id, u]) => ({ userId: id, ...u })));
});

function renderUserList(users) {
  users.forEach(u => activeUsers[u.userId] = { username: u.username, color: u.color });
  const list = document.getElementById('userList');
  list.innerHTML = Object.entries(activeUsers)
    .map(([id, u]) => `<div class="user-chip"><span class="user-dot" style="background:${u.color}"></span>${u.username}</div>`)
    .join('');
}

// --- Live cursor rendering ---

const cursors = {};

socket.on('cursor:update', ({ userId, x, y }) => {
  let dot = cursors[userId];
  if (!dot) {
    dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.style.background = activeUsers[userId]?.color || '#888';
    document.getElementById('canvasWrapper').appendChild(dot);
    cursors[userId] = dot;
  }
  dot.style.left = x + 'px';
  dot.style.top = y + 'px';
});

function removeCursor(userId) {
  if (cursors[userId]) {
    cursors[userId].remove();
    delete cursors[userId];
  }
}

resizeCanvas();