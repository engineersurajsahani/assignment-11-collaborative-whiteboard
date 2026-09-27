const socket = io();

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const cursorsContainer = document.getElementById('cursors');
const usersCount = document.getElementById('usersCount');

let isDrawing = false;
let current = { x: 0, y: 0 };
let activeUsers = {};

// Setup canvas size
const resizeCanvas = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 60; // 60px for toolbar
};
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const urlParams = new URLSearchParams(window.location.search);
const boardId = urlParams.get('board') || 'demo';
const username = `User_${Math.floor(Math.random() * 1000)}`;
const userColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;

socket.emit('board:join', { boardId, username, userColor });

// Drawing functions
const drawLine = (x0, y0, x1, y1, color, size, emit) => {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.closePath();

  if (!emit) return;
  const stroke = { prevX: x0, prevY: y0, currX: x1, currY: y1, color, size };
  socket.emit('draw:stroke', { boardId, stroke });
};

const onMouseDown = (e) => {
  isDrawing = true;
  current.x = e.clientX;
  current.y = e.clientY - 60;
};

const onMouseUp = (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  drawLine(current.x, current.y, e.clientX, e.clientY - 60, colorPicker.value, sizePicker.value, true);
};

const onMouseMove = (e) => {
  socket.emit('cursor:move', { boardId, x: e.clientX, y: e.clientY - 60 });
  
  if (!isDrawing) return;
  drawLine(current.x, current.y, e.clientX, e.clientY - 60, colorPicker.value, sizePicker.value, true);
  current.x = e.clientX;
  current.y = e.clientY - 60;
};

canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('mouseout', onMouseUp);
canvas.addEventListener('mousemove', onMouseMove);

// Clear and Undo
clearBtn.addEventListener('click', () => {
  socket.emit('board:clear', { boardId });
});

undoBtn.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId });
});

// Socket Events
socket.on('board:init', ({ strokes, activeUsers: users }) => {
  usersCount.innerText = `${users.length} user(s) online`;
  strokes.forEach(s => drawLine(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, false));
});

socket.on('draw:broadcast', ({ stroke }) => {
  drawLine(stroke.prevX, stroke.prevY, stroke.currX, stroke.currY, stroke.color, stroke.size, false);
});

socket.on('board:cleared', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('board:sync', ({ strokes }) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(s => drawLine(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, false));
});

socket.on('user:joined', ({ userId, username, color }) => {
  activeUsers[userId] = { username, color };
});

socket.on('user:left', ({ userId }) => {
  delete activeUsers[userId];
  const cursor = document.getElementById(`cursor-${userId}`);
  if (cursor) cursor.remove();
});

socket.on('cursor:update', ({ userId, x, y }) => {
  let cursor = document.getElementById(`cursor-${userId}`);
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = `cursor-${userId}`;
    cursor.className = 'cursor';
    cursorsContainer.appendChild(cursor);
  }
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
});
