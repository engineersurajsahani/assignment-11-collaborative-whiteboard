const socket = io();

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const cursorLayer = document.getElementById('cursorLayer');
const activeUsersList = document.getElementById('activeUsersList');
const currentRoomDisplay = document.getElementById('currentRoomDisplay');

const toolBrush = document.getElementById('toolBrush');
const toolEraser = document.getElementById('toolEraser');
const toolLine = document.getElementById('toolLine');
const strokeColorInput = document.getElementById('strokeColor');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeDisplay = document.getElementById('brushSizeDisplay');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');

const usernameInput = document.getElementById('usernameInput');
const userColorInput = document.getElementById('userColorInput');
const switchRoomBtn = document.getElementById('switchRoomBtn');
const roomModal = document.getElementById('roomModal');
const modalRoomInput = document.getElementById('modalRoomInput');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalJoinBtn = document.getElementById('modalJoinBtn');

const urlParams = new URLSearchParams(window.location.search);
let currentBoardId = urlParams.get('board') || 'DESIGN_101';
currentRoomDisplay.textContent = currentBoardId;

const VIBRANT_COLORS = ['#ff5722', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
const randomColor = VIBRANT_COLORS[Math.floor(Math.random() * VIBRANT_COLORS.length)];
const randomId = Math.floor(1000 + Math.random() * 9000);
let currentUsername = localStorage.getItem('collab_username') || `Artist_${randomId}`;
let currentUserColor = localStorage.getItem('collab_usercolor') || randomColor;

usernameInput.value = currentUsername;
userColorInput.value = currentUserColor;

let strokes = [];
let activeUsers = {};
let peerCursors = {};

let isDrawing = false;
let currentTool = 'brush';
let currentColor = strokeColorInput.value;
let currentSize = parseInt(brushSizeInput.value, 10);
let prevX = 0;
let prevY = 0;
let lineStartX = 0;
let lineStartY = 0;
let currentStrokeId = null;
let lastCursorEmit = 0;

const setupCanvasResolution = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  redrawAllStrokes();
};

window.addEventListener('resize', () => {
  setupCanvasResolution();
});

const getCanvasCoordinates = (e) => {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
};

const drawStrokeSegment = (stroke, appendToHistory = false) => {
  ctx.save();

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
  }

  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.stroke();
  ctx.restore();

  if (appendToHistory) {
    strokes.push(stroke);
  }
};

const redrawAllStrokes = () => {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  for (let i = 0; i < strokes.length; i++) {
    drawStrokeSegment(strokes[i], false);
  }
};

const updateActiveUsersUI = () => {
  activeUsersList.innerHTML = '';
  Object.values(activeUsers).forEach((user) => {
    const badge = document.createElement('div');
    badge.className = 'user-badge';
    badge.innerHTML = `
      <span class="user-badge-dot" style="background:${user.color}"></span>
      <span>${user.username}</span>
    `;
    activeUsersList.appendChild(badge);
  });
};

const getOrCreatePeerCursor = (userId, username, color) => {
  if (!peerCursors[userId]) {
    const el = document.createElement('div');
    el.className = 'peer-cursor';
    el.innerHTML = `
      <svg class="peer-cursor-pointer" viewBox="0 0 24 24" fill="${color || '#3b82f6'}">
        <path d="M4 0l16 12-7 2-4 8z"/>
      </svg>
      <div class="peer-cursor-label" style="background:${color || '#3b82f6'}">${username || 'User'}</div>
    `;
    cursorLayer.appendChild(el);
    peerCursors[userId] = el;
  }
  return peerCursors[userId];
};

const removePeerCursor = (userId) => {
  if (peerCursors[userId]) {
    peerCursors[userId].remove();
    delete peerCursors[userId];
  }
};

const joinCurrentBoard = () => {
  socket.emit('board:join', {
    boardId: currentBoardId,
    username: currentUsername,
    userColor: currentUserColor
  });
};

socket.on('connect', () => {
  joinCurrentBoard();
});

socket.on('board:init', (payload) => {
  strokes = payload.strokes || [];
  redrawAllStrokes();

  activeUsers = {};
  if (payload.activeUsers) {
    payload.activeUsers.forEach((u) => {
      activeUsers[u.userId] = u;
    });
  }
  updateActiveUsersUI();
});

socket.on('user:joined', (payload) => {
  activeUsers[payload.userId] = payload;
  updateActiveUsersUI();
});

socket.on('user:left', (payload) => {
  delete activeUsers[payload.userId];
  removePeerCursor(payload.userId);
  updateActiveUsersUI();
});

socket.on('draw:broadcast', (payload) => {
  if (payload && payload.stroke) {
    drawStrokeSegment(payload.stroke, true);
  }
});

socket.on('cursor:update', (payload) => {
  const user = activeUsers[payload.userId] || { username: 'Peer', color: '#3b82f6' };
  const cursorEl = getOrCreatePeerCursor(payload.userId, user.username, user.color);
  cursorEl.style.transform = `translate(${payload.x}px, ${payload.y}px)`;
});

socket.on('board:cleared', () => {
  strokes = [];
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
});

socket.on('board:sync', (payload) => {
  strokes = payload.strokes || [];
  redrawAllStrokes();
});

const startDrawing = (e) => {
  isDrawing = true;
  const coords = getCanvasCoordinates(e);
  prevX = coords.x;
  prevY = coords.y;
  lineStartX = coords.x;
  lineStartY = coords.y;
  currentStrokeId = `${socket.id || 'local'}_${Date.now()}_${Math.random()}`;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    const dotSegment = {
      prevX,
      prevY,
      currX: prevX + 0.1,
      currY: prevY + 0.1,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
      strokeId: currentStrokeId
    };
    drawStrokeSegment(dotSegment, true);
    socket.emit('draw:stroke', {
      boardId: currentBoardId,
      stroke: dotSegment
    });
  }
};

const draw = (e) => {
  const coords = getCanvasCoordinates(e);

  const now = Date.now();
  if (now - lastCursorEmit > 30) {
    socket.emit('cursor:move', {
      boardId: currentBoardId,
      x: coords.x,
      y: coords.y
    });
    lastCursorEmit = now;
  }

  if (!isDrawing) return;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    const strokeSegment = {
      prevX,
      prevY,
      currX: coords.x,
      currY: coords.y,
      color: currentColor,
      size: currentSize,
      tool: currentTool,
      strokeId: currentStrokeId
    };

    drawStrokeSegment(strokeSegment, true);
    socket.emit('draw:stroke', {
      boardId: currentBoardId,
      stroke: strokeSegment
    });

    prevX = coords.x;
    prevY = coords.y;
  } else if (currentTool === 'line') {
    redrawAllStrokes();
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    ctx.restore();
  }
};

const stopDrawing = (e) => {
  if (!isDrawing) return;

  if (currentTool === 'line' && e) {
    const coords = getCanvasCoordinates(e);
    const lineStroke = {
      prevX: lineStartX,
      prevY: lineStartY,
      currX: coords.x,
      currY: coords.y,
      color: currentColor,
      size: currentSize,
      tool: 'line',
      strokeId: currentStrokeId
    };
    drawStrokeSegment(lineStroke, true);
    socket.emit('draw:stroke', {
      boardId: currentBoardId,
      stroke: lineStroke
    });
  }

  isDrawing = false;
  currentStrokeId = null;
};

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

window.addEventListener('touchend', (e) => {
  stopDrawing(e);
});

const setTool = (tool) => {
  currentTool = tool;
  toolBrush.classList.toggle('active', tool === 'brush');
  toolEraser.classList.toggle('active', tool === 'eraser');
  toolLine.classList.toggle('active', tool === 'line');
};

toolBrush.addEventListener('click', () => setTool('brush'));
toolEraser.addEventListener('click', () => setTool('eraser'));
toolLine.addEventListener('click', () => setTool('line'));

strokeColorInput.addEventListener('input', (e) => {
  currentColor = e.target.value;
  if (currentTool === 'eraser') setTool('brush');
});

document.querySelectorAll('.palette-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    currentColor = swatch.dataset.color;
    strokeColorInput.value = currentColor;
    if (currentTool === 'eraser') setTool('brush');
  });
});

brushSizeInput.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  brushSizeDisplay.textContent = `${currentSize}px`;
});

undoBtn.addEventListener('click', () => {
  socket.emit('draw:undo', { boardId: currentBoardId });
});

clearBtn.addEventListener('click', () => {
  if (confirm('Clear the entire board for all collaborators?')) {
    socket.emit('board:clear', { boardId: currentBoardId });
  }
});

downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `whiteboard-${currentBoardId}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

usernameInput.addEventListener('change', () => {
  currentUsername = usernameInput.value.trim() || 'Artist';
  localStorage.setItem('collab_username', currentUsername);
  joinCurrentBoard();
});

userColorInput.addEventListener('input', () => {
  currentUserColor = userColorInput.value;
  localStorage.setItem('collab_usercolor', currentUserColor);
  joinCurrentBoard();
});

switchRoomBtn.addEventListener('click', () => {
  modalRoomInput.value = currentBoardId;
  roomModal.classList.remove('hidden');
  modalRoomInput.focus();
});

modalCancelBtn.addEventListener('click', () => {
  roomModal.classList.add('hidden');
});

modalJoinBtn.addEventListener('click', () => {
  const targetRoom = modalRoomInput.value.trim();
  if (targetRoom) {
    window.location.search = `?board=${encodeURIComponent(targetRoom)}`;
  }
});

modalRoomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    modalJoinBtn.click();
  }
});

setupCanvasResolution();
