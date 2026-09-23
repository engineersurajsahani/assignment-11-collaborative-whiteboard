/**
 * DrawSync - Collaborative Real-Time Whiteboard Client
 */

(function () {
  'use strict';

  // --- Socket & State Initialization ---
  const socket = io();

  let boardId = 'lobby';
  let username = '';
  let userColor = '#3B82F6';
  let strokesHistory = [];
  let activeUsersMap = new Map(); // userId -> { username, color, cursor, el }

  // Drawing state
  let isDrawing = false;
  let isEraser = false;
  let currentColor = '#1E293B';
  let currentBrushSize = 4;
  let currentStrokeGroupId = null;
  let lastX = 0;
  let lastY = 0;

  // Throttling for client-side cursor emits (~30ms => ~33 fps)
  let lastClientCursorEmit = 0;
  const CLIENT_CURSOR_THROTTLE_MS = 30;

  // --- DOM Elements ---
  const canvas = document.getElementById('whiteboardCanvas');
  const ctx = canvas.getContext('2d');
  const canvasContainer = document.getElementById('canvasContainer');
  const cursorOverlay = document.getElementById('cursorOverlay');
  const toastContainer = document.getElementById('toastContainer');

  // Toolbar Elements
  const currentRoomDisplay = document.getElementById('currentRoomDisplay');
  const roomTag = document.getElementById('roomTag');
  const copyHint = document.getElementById('copyHint');
  const brushToolBtn = document.getElementById('brushToolBtn');
  const eraserToolBtn = document.getElementById('eraserToolBtn');
  const colorPicker = document.getElementById('colorPicker');
  const colorPreview = document.getElementById('colorPreview');
  const presetDots = document.querySelectorAll('.color-dot');
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const activeUsersCount = document.getElementById('activeUsersCount');
  const usersList = document.getElementById('usersList');
  const myAvatarDot = document.getElementById('myAvatarDot');
  const myNameDisplay = document.getElementById('myNameDisplay');

  // Modal Elements
  const joinModal = document.getElementById('joinModal');
  const joinForm = document.getElementById('joinForm');
  const usernameInput = document.getElementById('usernameInput');
  const boardIdInput = document.getElementById('boardIdInput');
  const modalColorDots = document.querySelectorAll('.modal-color-dot');

  // --- Setup Canvas Resolution (High-DPI / Retina Aware) ---
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = canvasContainer.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;

    // Set internal resolution scaled by devicePixelRatio
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    // Style size matches container
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Scale drawing context so (x, y) coordinates operate in CSS pixel space
    ctx.scale(dpr, dpr);

    // Redraw all strokes from current history
    redrawAll(strokesHistory);
  }

  window.addEventListener('resize', resizeCanvas);

  // --- Helper: UUID Generator for Stroke Action Grouping ---
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'grp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  }

  // --- Drawing Logic ---
  /**
   * Universal stroke segment renderer used for both local and broadcasted strokes.
   * @param {CanvasRenderingContext2D} targetCtx
   * @param {Object} stroke - { prevX, prevY, currX, currY, color, size }
   */
  function drawSegment(targetCtx, stroke) {
    if (!targetCtx || !stroke) return;
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.moveTo(stroke.prevX, stroke.prevY);
    targetCtx.lineTo(stroke.currX, stroke.currY);
    targetCtx.strokeStyle = stroke.color || '#1E293B';
    targetCtx.lineWidth = stroke.size || 4;
    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.stroke();
    targetCtx.restore();
  }

  /**
   * Redraws all strokes onto the canvas.
   * @param {Array} strokes
   */
  function redrawAll(strokes) {
    const rect = canvasContainer.getBoundingClientRect();
    ctx.save();
    // Reset transform to clear entire physical canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Restore CSS pixel scaling
    ctx.scale(dpr, dpr);

    if (Array.isArray(strokes)) {
      for (let i = 0; i < strokes.length; i++) {
        drawSegment(ctx, strokes[i]);
      }
    }
    ctx.restore();
  }

  // --- Coordinate Extraction ---
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    let clientY = e.clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top)
    };
  }

  // --- Local Event Listeners for Drawing & Cursor Tracking ---
  function handleDrawStart(e) {
    // Ignore secondary mouse clicks
    if (e.type === 'mousedown' && e.button !== 0) return;

    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;

    // Generate a unique strokeGroupId for this entire continuous drag
    currentStrokeGroupId = generateUUID();

    // Draw a single dot on initial click if mouse doesn't move
    const singleSegment = {
      prevX: lastX,
      prevY: lastY,
      currX: x + 0.1,
      currY: y + 0.1,
      color: isEraser ? '#FFFFFF' : currentColor,
      size: currentBrushSize,
      strokeGroupId: currentStrokeGroupId
    };

    drawSegment(ctx, singleSegment);
    strokesHistory.push(singleSegment);

    socket.emit('draw:stroke', {
      boardId,
      stroke: singleSegment
    });
  }

  function handleDrawMove(e) {
    const { x, y } = getCanvasCoords(e);

    // High-frequency throttled cursor position broadcast
    const now = Date.now();
    if (now - lastClientCursorEmit >= CLIENT_CURSOR_THROTTLE_MS) {
      lastClientCursorEmit = now;
      socket.emit('cursor:move', {
        boardId,
        x,
        y
      });
    }

    if (!isDrawing) return;

    const strokeSegment = {
      prevX: lastX,
      prevY: lastY,
      currX: x,
      currY: y,
      color: isEraser ? '#FFFFFF' : currentColor,
      size: currentBrushSize,
      strokeGroupId: currentStrokeGroupId
    };

    // 1. Draw locally immediately for instant responsiveness
    drawSegment(ctx, strokeSegment);
    strokesHistory.push(strokeSegment);

    // 2. Emit stroke to server
    socket.emit('draw:stroke', {
      boardId,
      stroke: strokeSegment
    });

    lastX = x;
    lastY = y;
  }

  function handleDrawEnd() {
    if (isDrawing) {
      isDrawing = false;
      currentStrokeGroupId = null;
    }
  }

  // Mouse Listeners
  canvas.addEventListener('mousedown', handleDrawStart);
  window.addEventListener('mousemove', handleDrawMove);
  window.addEventListener('mouseup', handleDrawEnd);

  // Touch Listeners (Mobile & Tablet support)
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleDrawStart(e);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (isDrawing) e.preventDefault();
    handleDrawMove(e);
  }, { passive: false });

  window.addEventListener('touchend', handleDrawEnd);
  window.addEventListener('touchcancel', handleDrawEnd);

  // --- UI Controls Event Listeners ---

  // Brush / Eraser Mode Toggle
  brushToolBtn.addEventListener('click', () => {
    isEraser = false;
    brushToolBtn.classList.add('active');
    eraserToolBtn.classList.remove('active');
  });

  eraserToolBtn.addEventListener('click', () => {
    isEraser = true;
    eraserToolBtn.classList.add('active');
    brushToolBtn.classList.remove('active');
  });

  // Color selection
  function updateActiveColor(newColor) {
    currentColor = newColor;
    colorPicker.value = newColor;
    colorPreview.style.backgroundColor = newColor;
    if (isEraser) {
      isEraser = false;
      brushToolBtn.classList.add('active');
      eraserToolBtn.classList.remove('active');
    }

    presetDots.forEach((dot) => {
      if (dot.dataset.color.toLowerCase() === newColor.toLowerCase()) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  colorPreview.addEventListener('click', () => colorPicker.click());
  colorPicker.addEventListener('input', (e) => updateActiveColor(e.target.value));

  presetDots.forEach((dot) => {
    dot.addEventListener('click', () => updateActiveColor(dot.dataset.color));
  });

  // Brush size slider
  brushSizeSlider.addEventListener('input', (e) => {
    currentBrushSize = parseInt(e.target.value, 10);
    brushSizeVal.textContent = `${currentBrushSize}px`;
  });

  // Undo button action
  undoBtn.addEventListener('click', () => {
    socket.emit('draw:undo', { boardId });
  });

  // Clear button action
  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the entire whiteboard for everyone?')) {
      socket.emit('board:clear', { boardId });
    }
  });

  // Keyboard Shortcuts (Ctrl+Z / Cmd+Z for Undo, P for Pen, E for Eraser)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      socket.emit('draw:undo', { boardId });
    } else if (e.key.toLowerCase() === 'p') {
      brushToolBtn.click();
    } else if (e.key.toLowerCase() === 'e') {
      eraserToolBtn.click();
    }
  });

  // Copy Room Link
  roomTag.addEventListener('click', async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?board=${encodeURIComponent(boardId)}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyHint.textContent = '✅ Copied!';
      showToast('Invite link copied to clipboard!');
      setTimeout(() => {
        copyHint.textContent = '📋 Copy Link';
      }, 2000);
    } catch (err) {
      showToast(`Share URL: ${shareUrl}`);
    }
  });

  // --- Toast Notifications ---
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }, 3000);
  }

  // --- Collaborator Cursor Overlays ---
  function getOrCreateCursorElement(userId, name, color) {
    let cursorEl = document.getElementById(`cursor-${userId}`);
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.id = `cursor-${userId}`;
      cursorEl.className = 'peer-cursor';
      cursorEl.style.setProperty('--cursor-color', color || '#3B82F6');

      const pointer = document.createElement('div');
      pointer.className = 'peer-cursor-pointer';

      const tag = document.createElement('div');
      tag.className = 'peer-cursor-tag';
      tag.textContent = name || 'Collaborator';

      cursorEl.appendChild(pointer);
      cursorEl.appendChild(tag);
      cursorOverlay.appendChild(cursorEl);
    }
    return cursorEl;
  }

  function removeCursorElement(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`);
    if (cursorEl && cursorEl.parentNode) {
      cursorEl.parentNode.removeChild(cursorEl);
    }
  }

  function updateUsersListUI() {
    usersList.innerHTML = '';

    // Add myself
    const myLi = document.createElement('li');
    myLi.className = 'user-item is-me';
    myLi.innerHTML = `
      <span class="user-item-dot" style="background:${userColor};"></span>
      <span class="user-item-name">${escapeHtml(username)}</span>
    `;
    usersList.appendChild(myLi);

    let totalCount = 1;
    activeUsersMap.forEach((user, userId) => {
      if (userId !== socket.id) {
        totalCount++;
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
          <span class="user-item-dot" style="background:${user.color};"></span>
          <span class="user-item-name">${escapeHtml(user.username)}</span>
        `;
        usersList.appendChild(li);
      }
    });

    activeUsersCount.textContent = `${totalCount} online`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // --- Real-Time Socket Event Protocol Handlers ---

  // 1. Initial room state from server upon joining
  socket.on('board:init', ({ strokes, activeUsers }) => {
    strokesHistory = strokes || [];
    redrawAll(strokesHistory);

    activeUsersMap.clear();
    if (Array.isArray(activeUsers)) {
      activeUsers.forEach((u) => {
        if (u.userId !== socket.id) {
          activeUsersMap.set(u.userId, u);
          getOrCreateCursorElement(u.userId, u.username, u.color);
        }
      });
    }
    updateUsersListUI();
  });

  // 2. Incoming stroke segment from another peer
  socket.on('draw:broadcast', ({ stroke }) => {
    if (!stroke) return;
    strokesHistory.push(stroke);
    drawSegment(ctx, stroke);
  });

  // 3. Canvas cleared by someone
  socket.on('board:cleared', ({ clearedBy }) => {
    strokesHistory = [];
    redrawAll(strokesHistory);
    showToast(`${clearedBy || 'Someone'} cleared the whiteboard`);
  });

  // 4. Board synchronized (after undo or full sync)
  socket.on('board:sync', ({ strokes }) => {
    strokesHistory = strokes || [];
    redrawAll(strokesHistory);
  });

  // 5. New user joined room
  socket.on('user:joined', ({ userId, username: newUserName, color: newUserColor }) => {
    if (userId === socket.id) return;
    activeUsersMap.set(userId, {
      username: newUserName,
      color: newUserColor,
      cursor: { x: 0, y: 0 }
    });
    getOrCreateCursorElement(userId, newUserName, newUserColor);
    updateUsersListUI();
    showToast(`${newUserName} joined the board`);
  });

  // 6. User left room
  socket.on('user:left', ({ userId, username: leftUserName }) => {
    activeUsersMap.delete(userId);
    removeCursorElement(userId);
    updateUsersListUI();
    showToast(`${leftUserName || 'A user'} left`);
  });

  // 7. Throttled cursor position update from peer
  socket.on('cursor:update', ({ userId, x, y }) => {
    if (userId === socket.id) return;
    const user = activeUsersMap.get(userId);
    const cursorEl = getOrCreateCursorElement(
      userId,
      user ? user.username : 'Collaborator',
      user ? user.color : '#3B82F6'
    );
    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  });

  // --- Initialization & Join Flow ---
  function joinRoom(selectedBoardId, selectedUsername, selectedColor) {
    boardId = selectedBoardId || 'lobby';
    username = selectedUsername || `User-${Math.floor(1000 + Math.random() * 9000)}`;
    userColor = selectedColor || '#3B82F6';

    currentRoomDisplay.textContent = boardId;
    myNameDisplay.textContent = username;
    myAvatarDot.style.backgroundColor = userColor;

    // Update URL query string without reloading
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('board', boardId);
    newUrl.searchParams.set('username', username);
    window.history.replaceState({}, '', newUrl.toString());

    // Emit board:join to server
    socket.emit('board:join', {
      boardId,
      username,
      userColor
    });

    updateUsersListUI();
  }

  function initApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryBoard = urlParams.get('board');
    const queryUsername = urlParams.get('username');

    // Setup modal avatar color selection
    let modalSelectedColor = '#3B82F6';
    modalColorDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        modalColorDots.forEach((d) => d.classList.remove('selected'));
        dot.classList.add('selected');
        modalSelectedColor = dot.dataset.color;
      });
    });

    // Handle Join Form Submit
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredName = usernameInput.value.trim();
      const enteredBoard = boardIdInput.value.trim() || 'lobby';

      if (!enteredName) return;
      joinModal.classList.add('hidden');
      joinRoom(enteredBoard, enteredName, modalSelectedColor);
    });

    // If username is provided in URL, join directly; else show modal
    if (queryUsername && queryUsername.trim()) {
      const randomColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
      const chosenColor = randomColors[Math.floor(Math.random() * randomColors.length)];
      joinRoom(queryBoard || 'lobby', queryUsername.trim(), chosenColor);
    } else {
      boardIdInput.value = queryBoard || 'demo';
      joinModal.classList.remove('hidden');
      usernameInput.focus();
    }

    // Initialize Canvas Dimensions
    resizeCanvas();
    updateActiveColor('#1E293B');
  }

  // Start on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
