const socket = io();

let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let color = '#000000';
let brushSize = 3;
let brushType = 'round';
let boardId = 'default';
let username = '';
let userColor = '#ff5722';

function init() {
  canvas = document.getElementById('whiteboard');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const params = new URLSearchParams(window.location.search);
  boardId = params.get('board') || 'default';
  document.getElementById('board-name').textContent = `Board: ${boardId}`;

  setupEventListeners();
  showJoinModal();
}

function resizeCanvas() {
  const container = document.querySelector('.canvas-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  redrawCanvas();
}

function showJoinModal() {
  document.getElementById('join-modal').classList.remove('hidden');
}

function hideJoinModal() {
  document.getElementById('join-modal').classList.add('hidden');
}

function joinBoard() {
  username = document.getElementById('username').value.trim() || 'Anonymous';
  userColor = document.getElementById('user-color').value;

  socket.emit('board:join', {
    boardId,
    username,
    userColor
  });

  hideJoinModal();
  color = userColor;
  document.getElementById('color-picker').value = color;
}

function setupEventListeners() {
  document.getElementById('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    joinBoard();
  });

  document.getElementById('color-picker').addEventListener('input', (e) => {
    color = e.target.value;
  });

  document.getElementById('brush-size').addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    document.getElementById('brush-size-display').textContent = `${brushSize}px`;
  });

  document.getElementById('brush-type').addEventListener('change', (e) => {
    brushType = e.target.value;
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    if (confirm('Clear the entire canvas for all users?')) {
      socket.emit('board:clear', { boardId });
    }
  });

  document.getElementById('undo-btn').addEventListener('click', () => {
    socket.emit('draw:undo', { boardId });
  });

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  canvas.addEventListener('touchstart', handleTouch);
  canvas.addEventListener('touchmove', handleTouch);
  canvas.addEventListener('touchend', stopDrawing);

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    socket.emit('cursor:move', { boardId, x, y });
  });
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
}

function draw(e) {
  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const currX = e.clientX - rect.left;
  const currY = e.clientY - rect.top;

  const stroke = {
    prevX: lastX,
    prevY: lastY,
    currX,
    currY,
    color,
    size: brushSize,
    type: brushType
  };

  drawStroke(stroke);
  socket.emit('draw:stroke', { boardId, stroke });

  lastX = currX;
  lastY = currY;
}

function stopDrawing() {
  isDrawing = false;
}

function handleTouch(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent(
    e.type === 'touchstart' ? 'mousedown' : 'mousemove',
    {
      clientX: touch.clientX,
      clientY: touch.clientY
    }
  );
  canvas.dispatchEvent(mouseEvent);
}

function drawStroke(stroke) {
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = stroke.type || 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateUsersList(users) {
  const usersList = document.getElementById('users-list');
  usersList.innerHTML = '';
  
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="user-color-dot" style="background: ${user.color}"></span>
      <span>${user.username}</span>
    `;
    usersList.appendChild(li);
  });

  document.getElementById('user-count').textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
}

function createCursor(userId, username, userColor) {
  const cursorContainer = document.getElementById('cursors');
  
  let cursor = document.getElementById(`cursor-${userId}`);
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = `cursor-${userId}`;
    cursor.className = 'cursor';
    cursor.innerHTML = `
      <div class="cursor-dot" style="background: ${userColor}"></div>
      <div class="cursor-name" style="background: ${userColor}">${username}</div>
    `;
    cursorContainer.appendChild(cursor);
  }
}

function removeCursor(userId) {
  const cursor = document.getElementById(`cursor-${userId}`);
  if (cursor) {
    cursor.remove();
  }
}

function updateCursor(userId, x, y) {
  const cursor = document.getElementById(`cursor-${userId}`);
  if (cursor) {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
  }
}

socket.on('board:init', (data) => {
  ctx = canvas.getContext('2d');
  data.strokes.forEach((stroke) => {
    drawStroke(stroke);
  });
  updateUsersList(data.activeUsers);
});

socket.on('user:joined', (data) => {
  updateUsersList(data.activeUsers || []);
  createCursor(data.userId, data.username, data.color);
});

socket.on('user:left', (data) => {
  removeCursor(data.userId);
  const usersListEl = document.getElementById('users-list');
  const items = usersListEl.querySelectorAll('li');
  items.forEach((item) => {
    if (item.querySelector('span:last-child').textContent === data.username) {
      item.remove();
    }
  });
  const usersCount = usersListEl.querySelectorAll('li').length;
  document.getElementById('user-count').textContent = `${usersCount} user${usersCount !== 1 ? 's' : ''}`;
});

socket.on('draw:broadcast', (data) => {
  drawStroke(data.stroke);
});

socket.on('cursor:update', (data) => {
  createCursor(data.userId, data.username, data.color);
  updateCursor(data.userId, data.x, data.y);
});

socket.on('board:cleared', (data) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('board:sync', (data) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  data.strokes.forEach((stroke) => {
    drawStroke(stroke);
  });
});

document.addEventListener('DOMContentLoaded', init);
