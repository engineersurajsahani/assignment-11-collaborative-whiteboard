const socket = io();

// Get board room ID from URL query string (e.g. ?board=DESIGN_101) or default
const urlParams = new URLSearchParams(window.location.search);
const boardId = urlParams.get('board') || 'DESIGN_101';
const username = 'User_' + Math.floor(Math.random() * 899 + 100);
const userColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

document.getElementById('room-badge').innerText = `Room: ${boardId}`;

// DOM Elements
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');

const colorPicker = document.getElementById('color-picker');
const sizePicker = document.getElementById('size-picker');
const btnPencil = document.getElementById('btn-pencil');
const btnEraser = document.getElementById('btn-eraser');
const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const usersCountBadge = document.getElementById('users-count');

// Drawing State
let isDrawing = false;
let mode = 'pencil'; // 'pencil' | 'eraser'
let prevX = 0;
let prevY = 0;
let currentStrokeId = null;
const peerCursors = {};

// Setup Canvas Size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  socket.emit('draw:undo', { boardId }); // Request state sync trigger or rebuild
}
window.addEventListener('resize', resizeCanvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Join Room
socket.emit('board:join', { boardId, username, userColor });

// Draw Line Helper
function renderStrokeSegment(stroke) {
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function clearLocalCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Tool Switching
btnPencil.addEventListener('click', () => {
  mode = 'pencil';
  btnPencil.classList.add('active');
  btnEraser.classList.remove('active');
});

btnEraser.addEventListener('click', () => {
  mode = 'eraser';
  btnEraser.classList.add('active');
  btnPencil.classList.remove('active');
});

// Event Actions
btnClear.addEventListener('click', () => {
  socket.emit('board:clear', { boardId });
});

btnUndo.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

// Mouse & Touch Coordinates Helper
function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// Drawing Handlers
function startDrawing(e) {
  isDrawing = true;
  const coords = getCoords(e);
  prevX = coords.x;
  prevY = coords.y;
  currentStrokeId = socket.id + '_' + Date.now();
}

function draw(e) {
  const coords = getCoords(e);

  // Broadcast mouse position
  socket.emit('cursor:move', { boardId, x: coords.x, y: coords.y });

  if (!isDrawing) return;

  const strokeColor = mode === 'eraser' ? '#f8f9fa' : colorPicker.value;
  const strokeSize = Number(sizePicker.value);

  const stroke = {
    strokeId: currentStrokeId,
    prevX,
    prevY,
    currX: coords.x,
    currY: coords.y,
    color: strokeColor,
    size: strokeSize
  };

  renderStrokeSegment(stroke);
  socket.emit('draw:stroke', { boardId, stroke });

  prevX = coords.x;
  prevY = coords.y;
}

function stopDrawing() {
  isDrawing = false;
  currentStrokeId = null;
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

canvas.addEventListener('touchstart', (e) => { startDrawing(e); e.preventDefault(); });
canvas.addEventListener('touchmove', (e) => { draw(e); e.preventDefault(); });
canvas.addEventListener('touchend', stopDrawing);

// Socket Event Handlers
socket.on('board:init', ({ strokes, activeUsers }) => {
  clearLocalCanvas();
  strokes.forEach(renderStrokeSegment);
  if (activeUsers) {
    usersCountBadge.innerText = `${activeUsers.length} Online`;
  }
});

socket.on('draw:broadcast', ({ stroke }) => {
  renderStrokeSegment(stroke);
});

socket.on('board:cleared', () => {
  clearLocalCanvas();
});

socket.on('board:sync', ({ strokes }) => {
  clearLocalCanvas();
  strokes.forEach(renderStrokeSegment);
});

socket.on('user:joined', ({ username, color }) => {
  console.log(`User joined: ${username}`);
});

socket.on('user:left', ({ userId }) => {
  if (peerCursors[userId]) {
    peerCursors[userId].remove();
    delete peerCursors[userId];
  }
});

// Real-Time Collaborator Cursors
socket.on('cursor:update', ({ userId, username, color, x, y }) => {
  let cursorElem = peerCursors[userId];

  if (!cursorElem) {
    cursorElem = document.createElement('div');
    cursorElem.className = 'peer-cursor';
    cursorElem.innerHTML = `
      <div class="cursor-pointer" style="background-color: ${color};"></div>
      <div class="cursor-label">${username}</div>
    `;
    container.appendChild(cursorElem);
    peerCursors[userId] = cursorElem;
  }

  cursorElem.style.left = `${x}px`;
  cursorElem.style.top = `${y}px`;
});