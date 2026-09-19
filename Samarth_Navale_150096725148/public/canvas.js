const socket = io();

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');

const boardInput = document.getElementById('boardIdInput');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const activeCount = document.getElementById('activeCount');

let drawing = false;
let prevX = 0;
let prevY = 0;
let currentStrokeId = null;
const collaboratorCursors = {};

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('board')) {
  boardInput.value = urlParams.get('board');
}

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let c = '#';
  for (let i = 0; i < 6; i++) {
    c += letters[Math.floor(Math.random() * 16)];
  }
  return c;
};

let myColor = getRandomColor();
colorPicker.value = myColor;

const joinCurrentBoard = () => {
  const bId = boardInput.value.trim() || 'DESIGN_101';
  const uname = nameInput.value.trim() || 'User';
  socket.emit('board:join', {
    boardId: bId,
    username: uname,
    userColor: myColor
  });
};

joinBtn.addEventListener('click', joinCurrentBoard);

const drawLine = (pX, pY, cX, cY, color, size) => {
  ctx.beginPath();
  ctx.moveTo(pX, pY);
  ctx.lineTo(cX, cY);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.closePath();
};

const redrawAll = (strokes) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (Array.isArray(strokes)) {
    strokes.forEach((s) => {
      drawLine(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size);
    });
  }
};

const getPos = (e) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
};

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const pos = getPos(e);
  prevX = pos.x;
  prevY = pos.y;
  currentStrokeId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
});

canvas.addEventListener('mousemove', (e) => {
  const pos = getPos(e);

  const bId = boardInput.value.trim() || 'DESIGN_101';
  socket.emit('cursor:move', {
    boardId: bId,
    x: pos.x,
    y: pos.y
  });

  if (!drawing) return;

  const color = colorPicker.value;
  const size = Number(sizePicker.value) || 3;

  drawLine(prevX, prevY, pos.x, pos.y, color, size);

  const stroke = {
    prevX,
    prevY,
    currX: pos.x,
    currY: pos.y,
    color,
    size,
    strokeId: currentStrokeId
  };

  socket.emit('draw:stroke', {
    boardId: bId,
    stroke
  });

  prevX = pos.x;
  prevY = pos.y;
});

const stopDrawing = () => {
  drawing = false;
  currentStrokeId = null;
};

canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);

clearBtn.addEventListener('click', () => {
  const bId = boardInput.value.trim() || 'DESIGN_101';
  socket.emit('board:clear', { boardId: bId });
});

undoBtn.addEventListener('click', () => {
  const bId = boardInput.value.trim() || 'DESIGN_101';
  socket.emit('draw:undo', { boardId: bId });
});

socket.on('connect', () => {
  joinCurrentBoard();
});

socket.on('board:init', ({ strokes, activeUsers }) => {
  redrawAll(strokes);
  if (Array.isArray(activeUsers)) {
    activeCount.textContent = `Users: ${activeUsers.length}`;
  }
});

socket.on('user:joined', ({ username }) => {
  console.log(`User joined: ${username}`);
});

socket.on('user:left', ({ userId, username }) => {
  if (collaboratorCursors[userId]) {
    collaboratorCursors[userId].remove();
    delete collaboratorCursors[userId];
  }
});

socket.on('draw:broadcast', ({ stroke }) => {
  if (stroke) {
    drawLine(stroke.prevX, stroke.prevY, stroke.currX, stroke.currY, stroke.color, stroke.size);
  }
});

socket.on('cursor:update', ({ userId, x, y, username, color }) => {
  let el = collaboratorCursors[userId];
  if (!el) {
    el = document.createElement('div');
    el.className = 'collaborator-cursor';
    el.innerHTML = `<div class="cursor-dot" style="background-color:${color}"></div><div class="cursor-label" style="background-color:${color}">${username}</div>`;
    container.appendChild(el);
    collaboratorCursors[userId] = el;
  }
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
});

socket.on('board:cleared', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('board:sync', ({ strokes }) => {
  redrawAll(strokes);
});
