(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const canvasWrapper = document.getElementById('canvasWrapper');

  const joinForm = document.getElementById('joinForm');
  const usernameInput = document.getElementById('usernameInput');
  const boardIdInput = document.getElementById('boardIdInput');
  const boardIdLabel = document.getElementById('boardIdLabel');
  const connectionStatus = document.getElementById('connectionStatus');

  const colorPicker = document.getElementById('colorPicker');
  const sizePicker = document.getElementById('sizePicker');
  const sizeLabel = document.getElementById('sizeLabel');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const activeUsersEl = document.getElementById('activeUsers');
  const toast = document.getElementById('toast');

  // ---------- Setup from URL (?board=demo & ?server=https://...) ----------
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledBoard = urlParams.get('board');
  if (prefilledBoard) boardIdInput.value = prefilledBoard;

  const serverUrl = urlParams.get('server') || window.BACKEND_URL || localStorage.getItem('whiteboard_backend_url') || (window.location.hostname.includes('vercel.app') ? 'https://collaborative-whiteboard-backend-r4lq.onrender.com' : undefined);
  if (urlParams.get('server')) {
    localStorage.setItem('whiteboard_backend_url', urlParams.get('server'));
  }

  const socket = serverUrl ? io(serverUrl, { transports: ['websocket', 'polling'] }) : io();

  let boardId = null;
  let username = null;
  let userColor = randomColor();
  let isDrawing = false;
  let lastPoint = null;
  let currentStrokeGroupId = null;

  // userId -> { el, username, color }
  const cursorEls = {};
  // userId -> { username, color }
  const knownUsers = {};

  // ---------- Canvas sizing ----------
  function resizeCanvas() {
    // Preserve drawing across resize by redrawing from the in-memory
    // stroke buffer rather than trying to scale raw pixel data.
    canvas.width = canvasWrapper.clientWidth;
    canvas.height = canvasWrapper.clientHeight;
    redrawAll(window.__strokes || []);
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- Helpers ----------
  function randomColor() {
    const palette = ['#ff5722', '#4f7cff', '#2ecc71', '#e91e63', '#ff9800', '#9b59b6', '#00bcd4', '#795548'];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  connectionStatus.style.cursor = 'pointer';
  connectionStatus.title = 'Click to configure backend WebSocket URL';
  connectionStatus.addEventListener('click', () => {
    const current = localStorage.getItem('whiteboard_backend_url') || '';
    const newUrl = prompt('Enter your live WebSocket backend URL (e.g. https://your-backend.onrender.com):', current);
    if (newUrl !== null) {
      if (newUrl.trim()) {
        localStorage.setItem('whiteboard_backend_url', newUrl.trim());
      } else {
        localStorage.removeItem('whiteboard_backend_url');
      }
      window.location.reload();
    }
  });

  function setConnectionStatus(connected) {
    connectionStatus.textContent = connected ? 'Connected' : 'Not connected';
    connectionStatus.classList.toggle('connected', connected);
  }

  function drawSegment(stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.prevX, stroke.prevY);
    ctx.lineTo(stroke.currX, stroke.currY);
    ctx.stroke();
  }

  function redrawAll(strokes) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(drawSegment);
  }

  function renderUserPill(userId, user) {
    let pill = document.getElementById(`pill-${userId}`);
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'user-pill';
      pill.id = `pill-${userId}`;
      activeUsersEl.appendChild(pill);
    }
    pill.innerHTML = `<span class="user-dot" style="background:${user.color}"></span>${escapeHtml(user.username)}`;
  }

  function removeUserPill(userId) {
    const pill = document.getElementById(`pill-${userId}`);
    if (pill) pill.remove();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function updateCursor(userId, x, y) {
    const user = knownUsers[userId];
    if (!user) return;

    let el = cursorEls[userId];
    if (!el) {
      el = document.createElement('div');
      el.className = 'cursor-label';
      el.innerHTML = `<span class="cursor-dot" style="background:${user.color}"></span><span class="cursor-name">${escapeHtml(user.username)}</span>`;
      canvasWrapper.appendChild(el);
      cursorEls[userId] = el;
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function removeCursor(userId) {
    const el = cursorEls[userId];
    if (el) el.remove();
    delete cursorEls[userId];
  }

  // ---------- Join flow ----------
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    username = usernameInput.value.trim();
    boardId = boardIdInput.value.trim();
    if (!username || !boardId) return;

    socket.emit('board:join', { boardId, username, userColor });
    boardIdLabel.textContent = `Board: ${boardId}`;
  });

  // ---------- Drawing ----------
  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    if (!boardId) return;
    isDrawing = true;
    currentStrokeGroupId = `${socket.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    lastPoint = getPointerPos(e);
  }

  function moveDraw(e) {
    const pos = getPointerPos(e);

    // Always emit cursor position, drawing or not, for live collaborator cursors
    if (boardId) {
      socket.emit('cursor:move', { boardId, x: pos.x, y: pos.y });
    }

    if (!isDrawing || !boardId) return;

    const stroke = {
      prevX: lastPoint.x,
      prevY: lastPoint.y,
      currX: pos.x,
      currY: pos.y,
      color: colorPicker.value,
      size: Number(sizePicker.value),
      strokeGroupId: currentStrokeGroupId
    };

    drawSegment(stroke);
    window.__strokes = window.__strokes || [];
    window.__strokes.push({ ...stroke, userId: socket.id });

    socket.emit('draw:stroke', { boardId, stroke });

    lastPoint = pos;
  }

  function endDraw() {
    isDrawing = false;
    lastPoint = null;
    currentStrokeGroupId = null;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);

  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); });
  window.addEventListener('touchend', endDraw);

  // ---------- Toolbar ----------
  sizePicker.addEventListener('input', () => {
    sizeLabel.textContent = `${sizePicker.value}px`;
  });

  undoBtn.addEventListener('click', () => {
    if (!boardId) return;
    socket.emit('draw:undo', { boardId });
  });

  clearBtn.addEventListener('click', () => {
    if (!boardId) return;
    socket.emit('board:clear', { boardId });
  });

  // ---------- Socket events ----------
  socket.on('connect', () => setConnectionStatus(true));
  socket.on('disconnect', () => setConnectionStatus(false));
  socket.on('connect_error', (err) => {
    setConnectionStatus(false);
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('board:error', ({ message }) => {
    showToast(message);
  });

  socket.on('board:init', ({ strokes, activeUsers }) => {
    window.__strokes = strokes;
    redrawAll(strokes);

    activeUsersEl.innerHTML = '';
    Object.keys(cursorEls).forEach(removeCursor);

    // Register self
    knownUsers[socket.id] = { username, color: userColor };
    renderUserPill(socket.id, knownUsers[socket.id]);

    activeUsers.forEach((u) => {
      knownUsers[u.userId] = { username: u.username, color: u.color };
      renderUserPill(u.userId, knownUsers[u.userId]);
    });

    showToast(`Joined board "${boardId}"`);
  });

  socket.on('user:joined', ({ userId, username: joinedName, color }) => {
    knownUsers[userId] = { username: joinedName, color };
    renderUserPill(userId, knownUsers[userId]);
    showToast(`${joinedName} joined the board`);
  });

  socket.on('user:left', ({ userId, username: leftName }) => {
    removeUserPill(userId);
    removeCursor(userId);
    delete knownUsers[userId];
    showToast(`${leftName} left the board`);
  });

  socket.on('draw:broadcast', ({ stroke }) => {
    drawSegment(stroke);
    window.__strokes = window.__strokes || [];
    window.__strokes.push(stroke);
  });

  socket.on('board:cleared', ({ clearedBy }) => {
    window.__strokes = [];
    redrawAll([]);
    showToast(`Canvas cleared by ${clearedBy}`);
  });

  socket.on('board:sync', ({ strokes }) => {
    window.__strokes = strokes;
    redrawAll(strokes);
  });

  socket.on('cursor:update', ({ userId, x, y }) => {
    updateCursor(userId, x, y);
  });

  // ---------- Init ----------
  resizeCanvas();
})();
