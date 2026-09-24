// Wait for DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const canvas = document.getElementById('whiteboardCanvas');
  const ctx = canvas.getContext('2d');
  const canvasContainer = document.getElementById('canvasContainer');
  const cursorOverlay = document.getElementById('cursorOverlay');
  
  // Header Elements
  const roomBadge = document.getElementById('roomBadge');
  const roomInput = document.getElementById('roomInput');
  const joinRoomBtn = document.getElementById('joinRoomBtn');
  const myColorBadge = document.getElementById('myColorBadge');
  const myUsernameDisplay = document.getElementById('myUsernameDisplay');

  // Toolbar Elements
  const toolPencil = document.getElementById('toolPencil');
  const toolEraser = document.getElementById('toolEraser');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorPicker = document.getElementById('customColorPicker');
  const brushSizeInput = document.getElementById('brushSize');
  const sizeValueDisplay = document.getElementById('sizeValue');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Users & Toast Elements
  const usersList = document.getElementById('usersList');
  const userCount = document.getElementById('userCount');
  const toastContainer = document.getElementById('toastContainer');

  // Join Modal Elements
  const joinModal = document.getElementById('joinModal');
  const modalUsername = document.getElementById('modalUsername');
  const modalBoardId = document.getElementById('modalBoardId');
  const colorOpts = document.querySelectorAll('.color-opt');
  const startBtn = document.getElementById('startBtn');

  // --- State Variables ---
  const urlParams = new URLSearchParams(window.location.search);
  let currentBoardId = urlParams.get('board') || urlParams.get('room') || 'DESIGN_101';
  let myUsername = urlParams.get('name') || '';
  let myColor = '#ff5722';

  let currentTool = 'pencil'; // 'pencil' or 'eraser'
  let currentColor = '#1e293b';
  let currentSize = 4;

  let isDrawing = false;
  let prevX = 0;
  let prevY = 0;
  let currentStrokeId = null;

  let localStrokesHistory = [];
  let peerCursors = {}; // Map of userId -> DOM Element

  // Initialize Socket.io Connection
  const socket = io();

  // --- Utility & UI Helpers ---
  function getRandomColor() {
    const colors = ['#ff5722', '#00bcd4', '#9c27b0', '#4caf50', '#ffb300', '#e91e63'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // --- Canvas Resizing & Scaling ---
  function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    
    // Support High DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    redrawAllStrokes();
  }

  window.addEventListener('resize', resizeCanvas);

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // --- Rendering Vector Strokes ---
  function drawSegment(stroke) {
    const { prevX, prevY, currX, currY, color, size, mode } = stroke;

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 3; // Eraser size multiplier
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }

    ctx.stroke();
    ctx.closePath();
  }

  function redrawAllStrokes() {
    const rect = canvasContainer.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    localStrokesHistory.forEach(stroke => {
      drawSegment(stroke);
    });
  }

  // --- Session Join Logic ---
  function joinCanvasSession() {
    if (!myUsername.trim()) {
      myUsername = `User_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    // Update UI Header
    roomBadge.textContent = `Room: ${currentBoardId}`;
    roomInput.value = currentBoardId;
    myColorBadge.style.backgroundColor = myColor;
    myUsernameDisplay.textContent = myUsername;

    // Hide Modal
    joinModal.classList.add('hidden');

    // Socket Join Event
    socket.emit('board:join', {
      boardId: currentBoardId,
      username: myUsername,
      userColor: myColor
    });

    resizeCanvas();
  }

  // Check Modal / Quick Join
  if (!urlParams.get('name')) {
    modalBoardId.value = currentBoardId;
    myColor = getRandomColor();
    colorOpts.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.color === myColor);
    });
  } else {
    joinCanvasSession();
  }

  // --- Event Listeners: Modal & Header ---
  colorOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      colorOpts.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      myColor = opt.dataset.color;
    });
  });

  startBtn.addEventListener('click', () => {
    myUsername = modalUsername.value.trim();
    currentBoardId = modalBoardId.value.trim() || 'DESIGN_101';
    joinCanvasSession();
  });

  joinRoomBtn.addEventListener('click', () => {
    const newBoard = roomInput.value.trim();
    if (newBoard && newBoard !== currentBoardId) {
      window.location.search = `?board=${encodeURIComponent(newBoard)}&name=${encodeURIComponent(myUsername)}`;
    }
  });

  // --- Event Listeners: Drawing Tools ---
  toolPencil.addEventListener('click', () => {
    currentTool = 'pencil';
    toolPencil.classList.add('active');
    toolEraser.classList.remove('active');
  });

  toolEraser.addEventListener('click', () => {
    currentTool = 'eraser';
    toolEraser.classList.add('active');
    toolPencil.classList.remove('active');
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      currentColor = swatch.dataset.color;
      customColorPicker.value = currentColor;
      if (currentTool === 'eraser') {
        toolPencil.click();
      }
    });
  });

  customColorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorSwatches.forEach(s => s.classList.remove('active'));
    if (currentTool === 'eraser') {
      toolPencil.click();
    }
  });

  brushSizeInput.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value, 10);
    sizeValueDisplay.textContent = `${currentSize}px`;
  });

  undoBtn.addEventListener('click', () => {
    socket.emit('draw:undo', { boardId: currentBoardId });
  });

  clearBtn.addEventListener('click', () => {
    socket.emit('board:clear', { boardId: currentBoardId });
  });

  // --- Event Listeners: Canvas Drawing & Pointer Tracking ---
  function startDrawing(e) {
    isDrawing = true;
    const { x, y } = getCanvasCoordinates(e);
    prevX = x;
    prevY = y;
    currentStrokeId = `stroke_${socket.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  }

  function handlePointerMove(e) {
    const { x, y } = getCanvasCoordinates(e);

    // Stream high-frequency mouse coordinates to peers
    socket.emit('cursor:move', {
      boardId: currentBoardId,
      x: Math.round(x),
      y: Math.round(y)
    });

    if (!isDrawing) return;

    const strokePayload = {
      strokeId: currentStrokeId,
      prevX: Math.round(prevX),
      prevY: Math.round(prevY),
      currX: Math.round(x),
      currY: Math.round(y),
      color: currentColor,
      size: currentSize,
      mode: currentTool
    };

    // 1. Local Instant Render
    drawSegment(strokePayload);
    localStrokesHistory.push(strokePayload);

    // 2. Emit Stroke Segment to Server
    socket.emit('draw:stroke', {
      boardId: currentBoardId,
      stroke: strokePayload
    });

    prevX = x;
    prevY = y;
  }

  function stopDrawing() {
    isDrawing = false;
    currentStrokeId = null;
  }

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // Touch device support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDrawing(e);
  });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handlePointerMove(e);
  });
  canvas.addEventListener('touchend', stopDrawing);

  // --- Socket.io Server Protocols ---

  // 1. Initial State Sync (`board:init`)
  socket.on('board:init', ({ strokes, activeUsers }) => {
    localStrokesHistory = strokes || [];
    redrawAllStrokes();
    updateActiveUsersUI(activeUsers || []);
  });

  // 2. User Joined Notification (`user:joined`)
  socket.on('user:joined', ({ userId, username, color }) => {
    showToast(`👋 ${username} joined the room`);
    addUserToUI({ userId, username, color });
  });

  // 3. User Left Notification (`user:left`)
  socket.on('user:left', ({ userId, username }) => {
    showToast(`🚪 ${username} left the room`);
    removeUserFromUI(userId);
    removePeerCursor(userId);
  });

  // 4. Live Vector Stroke Broadcast (`draw:broadcast`)
  socket.on('draw:broadcast', ({ stroke }) => {
    if (!stroke) return;
    localStrokesHistory.push(stroke);
    drawSegment(stroke);
  });

  // 5. Collaborator Cursor Updates (`cursor:update`)
  socket.on('cursor:update', ({ userId, x, y, username, color }) => {
    updatePeerCursor(userId, x, y, username, color);
  });

  // 6. Canvas Reset Event (`board:cleared`)
  socket.on('board:cleared', ({ clearedBy }) => {
    localStrokesHistory = [];
    redrawAllStrokes();
    showToast(`🧹 Canvas cleared by ${clearedBy}`);
  });

  // 7. Undo Snapshot Sync (`board:sync`)
  socket.on('board:sync', ({ strokes }) => {
    localStrokesHistory = strokes || [];
    redrawAllStrokes();
    showToast(`↩️ Stroke undone`);
  });

  // --- Peer Cursor DOM Management ---
  function updatePeerCursor(userId, x, y, username, color) {
    if (userId === socket.id) return; // Ignore own cursor update

    let cursorElem = peerCursors[userId];
    if (!cursorElem) {
      cursorElem = document.createElement('div');
      cursorElem.className = 'user-cursor';
      cursorElem.id = `cursor_${userId}`;

      cursorElem.innerHTML = `
        <svg class="cursor-pointer" viewBox="0 0 24 24" fill="${color}">
          <path d="M3 3l7 18 3-7 7-3L3 3z"/>
        </svg>
        <span class="cursor-label" style="background-color: ${color};">${username}</span>
      `;

      cursorOverlay.appendChild(cursorElem);
      peerCursors[userId] = cursorElem;
    }

    cursorElem.style.left = `${x}px`;
    cursorElem.style.top = `${y}px`;
  }

  function removePeerCursor(userId) {
    if (peerCursors[userId]) {
      peerCursors[userId].remove();
      delete peerCursors[userId];
    }
  }

  // --- Active Users UI Management ---
  function updateActiveUsersUI(users) {
    usersList.innerHTML = '';
    userCount.textContent = users.length;
    users.forEach(user => addUserToUI(user));
  }

  function addUserToUI(user) {
    if (document.getElementById(`user_item_${user.userId}`)) return;

    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.id = `user_item_${user.userId}`;

    const isSelf = user.userId === socket.id;

    userItem.innerHTML = `
      <div class="user-dot" style="background-color: ${user.color || '#ff5722'};"></div>
      <span>${user.username} ${isSelf ? '(You)' : ''}</span>
    `;

    usersList.appendChild(userItem);
    const count = parseInt(userCount.textContent, 10) || 0;
    userCount.textContent = usersList.children.length;
  }

  function removeUserFromUI(userId) {
    const elem = document.getElementById(`user_item_${userId}`);
    if (elem) {
      elem.remove();
      userCount.textContent = usersList.children.length;
    }
  }
});
