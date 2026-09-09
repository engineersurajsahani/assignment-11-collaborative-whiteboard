/**
 * public/canvas.js
 * Client-Side Collaborative Drawing Engine & Socket.io Event Synchronization
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. App State & User Configuration
  // =========================================================================

  const PALETTE_COLORS = ['#1e293b', '#ef4444', '#f97316', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

  // Parse board ID from URL query param (e.g. ?board=DESIGN_101) or default
  const urlParams = new URLSearchParams(window.location.search);
  let currentBoardId = urlParams.get('board') || 'DESIGN_101';

  // Persistent / Generated User Profile
  let username = localStorage.getItem('syncboard_username') || `Artist_${Math.floor(1000 + Math.random() * 9000)}`;
  let userColor = localStorage.getItem('syncboard_color') || PALETTE_COLORS[Math.floor(Math.random() * PALETTE_COLORS.length)];

  // Drawing Tool State
  let currentTool = 'pen'; // 'pen' | 'eraser'
  let currentColor = '#1e293b';
  let currentSize = 4;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentActionId = null;

  // Stroke History Buffer & Active Collaborators
  let localStrokes = [];
  const remoteUsers = new Map(); // socketId -> { username, color, cursorEl }

  // Cursor Throttling
  let lastCursorEmitTime = 0;
  const CURSOR_EMIT_INTERVAL_MS = 25; // ~40 fps cursor updates

  // =========================================================================
  // 2. DOM Elements
  // =========================================================================

  const canvas = document.getElementById('whiteboardCanvas');
  const ctx = canvas.getContext('2d');
  const viewport = document.getElementById('canvasViewport');
  const cursorsOverlay = document.getElementById('cursorsOverlay');

  const connectionStatus = document.getElementById('connectionStatus');
  const currentBoardDisplay = document.getElementById('currentBoardDisplay');
  const btnCopyBoardLink = document.getElementById('btnCopyBoardLink');
  const btnSwitchRoom = document.getElementById('btnSwitchRoom');

  const myColorIndicator = document.getElementById('myColorIndicator');
  const myNameDisplay = document.getElementById('myNameDisplay');
  const btnEditUser = document.getElementById('btnEditUser');

  const collaboratorCount = document.getElementById('collaboratorCount');
  const collaboratorAvatars = document.getElementById('collaboratorAvatars');
  const collaboratorsBadge = document.getElementById('collaboratorsBadge');
  const collaboratorsPopover = document.getElementById('collaboratorsPopover');
  const collaboratorList = document.getElementById('collaboratorList');
  const popoverCount = document.getElementById('popoverCount');

  const toolPen = document.getElementById('toolPen');
  const toolEraser = document.getElementById('toolEraser');
  const colorDots = document.querySelectorAll('.color-dot');
  const customColorPicker = document.getElementById('customColorPicker');
  const customColorPreview = document.getElementById('customColorPreview');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeDot = document.getElementById('sizeDot');
  const sizeValue = document.getElementById('sizeValue');

  const btnUndo = document.getElementById('btnUndo');
  const btnClear = document.getElementById('btnClear');
  const btnExportImage = document.getElementById('btnExportImage');

  // Modals
  const modalSwitchRoom = document.getElementById('modalSwitchRoom');
  const formSwitchRoom = document.getElementById('formSwitchRoom');
  const inputBoardId = document.getElementById('inputBoardId');
  const btnCloseRoomModal = document.getElementById('btnCloseRoomModal');
  const btnCancelRoomModal = document.getElementById('btnCancelRoomModal');

  const modalEditProfile = document.getElementById('modalEditProfile');
  const formEditProfile = document.getElementById('formEditProfile');
  const inputUsername = document.getElementById('inputUsername');
  const profileColorChoices = document.querySelectorAll('.profile-color-picker .color-choice');
  const btnCloseProfileModal = document.getElementById('btnCloseProfileModal');
  const btnCancelProfileModal = document.getElementById('btnCancelProfileModal');

  const modalConfirmClear = document.getElementById('modalConfirmClear');
  const btnCloseClearModal = document.getElementById('btnCloseClearModal');
  const btnCancelClear = document.getElementById('btnCancelClear');
  const btnConfirmClear = document.getElementById('btnConfirmClear');

  const toastHub = document.getElementById('toastHub');

  // =========================================================================
  // 3. Canvas Resizing & Resolution Handling (HiDPI / Retina)
  // =========================================================================

  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    const rect = viewport.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;

    // Set internal pixel buffer size scaled by DPR
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Set visual display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Scale drawing context so standard coordinates match pixels
    ctx.scale(dpr, dpr);

    // Re-render all cached strokes
    redrawAllStrokes();
  }

  window.addEventListener('resize', resizeCanvas);

  // Get pointer coordinates relative to canvas top-left
  function getCanvasCoords(event) {
    const rect = canvas.getBoundingClientRect();
    let clientX = event.clientX;
    let clientY = event.clientY;

    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // =========================================================================
  // 4. Drawing Engine
  // =========================================================================

  /**
   * Render a single vector stroke segment on the canvas
   */
  function drawSegment(prevX, prevY, currX, currY, color, size, isEraser = false) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;

    if (isEraser || color === '#ffffff') {
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.strokeStyle = color;
    }

    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }

  /**
   * Clear and re-render full stroke history buffer
   */
  function redrawAllStrokes() {
    const rect = viewport.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = 0; i < localStrokes.length; i++) {
      const s = localStrokes[i];
      drawSegment(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, s.isEraser);
    }
  }

  function startDrawing(e) {
    if (e.button !== undefined && e.button !== 0) return; // Left mouse button only
    e.preventDefault();

    const coords = getCanvasCoords(e);
    isDrawing = true;
    lastX = coords.x;
    lastY = coords.y;

    // Generate unique action ID for this continuous stroke gesture
    currentActionId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function handleDrawing(e) {
    const coords = getCanvasCoords(e);

    // 1. Emit live cursor position to collaborators (throttled)
    emitCursorMove(coords.x, coords.y);

    // 2. Handle stroke drawing
    if (!isDrawing) return;
    e.preventDefault();

    const currX = coords.x;
    const currY = coords.y;

    // Prevent zero-length duplicate dots
    if (currX === lastX && currY === lastY) return;

    const strokeColor = currentTool === 'eraser' ? '#ffffff' : currentColor;
    const strokeSize = currentSize;
    const isEraser = currentTool === 'eraser';

    // Render locally immediately
    drawSegment(lastX, lastY, currX, currY, strokeColor, strokeSize, isEraser);

    const strokeData = {
      prevX: Math.round(lastX * 10) / 10,
      prevY: Math.round(lastY * 10) / 10,
      currX: Math.round(currX * 10) / 10,
      currY: Math.round(currY * 10) / 10,
      color: strokeColor,
      size: strokeSize,
      isEraser,
      actionId: currentActionId
    };

    // Store in local buffer
    localStrokes.push(strokeData);

    // Broadcast stroke to room via Socket.io
    socket.emit('draw:stroke', {
      boardId: currentBoardId,
      stroke: strokeData
    });

    lastX = currX;
    lastY = currY;
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;
    currentActionId = null;
  }

  // Pointer & Touch event bindings
  canvas.addEventListener('mousedown', startDrawing);
  window.addEventListener('mousemove', handleDrawing);
  window.addEventListener('mouseup', stopDrawing);

  // Touch support for tablets & mobile
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  window.addEventListener('touchmove', handleDrawing, { passive: false });
  window.addEventListener('touchend', stopDrawing);
  window.addEventListener('touchcancel', stopDrawing);

  // =========================================================================
  // 5. High-Frequency Live Cursor Sync & Rendering
  // =========================================================================

  function emitCursorMove(x, y) {
    const now = performance.now();
    if (now - lastCursorEmitTime >= CURSOR_EMIT_INTERVAL_MS) {
      lastCursorEmitTime = now;
      socket.emit('cursor:move', {
        boardId: currentBoardId,
        x: Math.round(x),
        y: Math.round(y)
      });
    }
  }

  function getOrCreateRemoteCursor(userId, name, color) {
    if (remoteUsers.has(userId)) {
      return remoteUsers.get(userId);
    }

    const cursorEl = document.createElement('div');
    cursorEl.className = 'remote-cursor';
    cursorEl.id = `cursor-${userId}`;
    cursorEl.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="1.5">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"></path>
      </svg>
      <span class="remote-cursor-tag" style="background-color: ${color};">${escapeHtml(name)}</span>
    `;

    cursorsOverlay.appendChild(cursorEl);

    const userObj = {
      username: name,
      color: color,
      cursorEl: cursorEl
    };

    remoteUsers.set(userId, userObj);
    return userObj;
  }

  function updateRemoteCursorPosition(userId, x, y) {
    let user = remoteUsers.get(userId);
    if (!user) {
      user = getOrCreateRemoteCursor(userId, `User_${userId.slice(0, 4)}`, '#3b82f6');
    }
    user.cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function removeRemoteCursor(userId) {
    const user = remoteUsers.get(userId);
    if (user && user.cursorEl) {
      user.cursorEl.remove();
    }
    remoteUsers.delete(userId);
  }

  // =========================================================================
  // 6. Socket.io Event Handling
  // =========================================================================

  const socket = io({
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    updateConnectionStatus(true);
    console.log(`[Socket] Connected to server with ID: ${socket.id}`);

    // Emit board join event with boardId, username, and userColor
    socket.emit('board:join', {
      boardId: currentBoardId,
      username: username,
      userColor: userColor
    });
  });

  socket.on('disconnect', () => {
    updateConnectionStatus(false);
    console.log('[Socket] Disconnected from server');
  });

  socket.on('connect_error', () => {
    updateConnectionStatus(false);
  });

  // Complete stroke history & initial room state
  socket.on('board:init', (data) => {
    console.log('[Socket] Received board:init', data);
    localStrokes = data.strokes || [];
    redrawAllStrokes();

    // Rebuild active users list
    remoteUsers.forEach((u) => u.cursorEl && u.cursorEl.remove());
    remoteUsers.clear();

    if (data.activeUsers && Array.isArray(data.activeUsers)) {
      data.activeUsers.forEach((u) => {
        if (u.userId !== socket.id) {
          getOrCreateRemoteCursor(u.userId, u.username, u.color);
        }
      });
    }

    updateCollaboratorUI();
  });

  // Remote stroke broadcast
  socket.on('draw:broadcast', (data) => {
    if (!data || !data.stroke) return;
    const s = data.stroke;
    localStrokes.push(s);
    drawSegment(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, s.isEraser);
  });

  // Remote cursor movement
  socket.on('cursor:update', (data) => {
    if (!data || !data.userId) return;
    updateRemoteCursorPosition(data.userId, data.x, data.y);
  });

  // Peer joined room
  socket.on('user:joined', (data) => {
    if (!data || !data.userId || data.userId === socket.id) return;
    getOrCreateRemoteCursor(data.userId, data.username, data.color);
    updateCollaboratorUI();
    showToast(`${data.username} joined the board`);
  });

  // Peer left room
  socket.on('user:left', (data) => {
    if (!data || !data.userId) return;
    const departingName = remoteUsers.get(data.userId)?.username || data.username || 'Collaborator';
    removeRemoteCursor(data.userId);
    updateCollaboratorUI();
    showToast(`${departingName} left`);
  });

  // Canvas cleared by someone
  socket.on('board:cleared', (data) => {
    localStrokes = [];
    redrawAllStrokes();
    showToast(`Whiteboard cleared by ${data.clearedBy || 'a collaborator'}`);
  });

  // Canvas sync snapshot (after undo)
  socket.on('board:sync', (data) => {
    localStrokes = data.strokes || [];
    redrawAllStrokes();
  });

  // =========================================================================
  // 7. UI Controls, Toolbars & Actions
  // =========================================================================

  function updateConnectionStatus(isConnected) {
    if (isConnected) {
      connectionStatus.className = 'connection-status connected';
      connectionStatus.querySelector('.status-label').textContent = 'Live';
    } else {
      connectionStatus.className = 'connection-status disconnected';
      connectionStatus.querySelector('.status-label').textContent = 'Offline';
    }
  }

  function updateCollaboratorUI() {
    const totalCount = remoteUsers.size + 1; // peers + self
    collaboratorCount.textContent = totalCount;
    popoverCount.textContent = totalCount;

    // Render avatar stack in header
    collaboratorAvatars.innerHTML = '';
    
    // Add self avatar
    const selfAv = document.createElement('div');
    selfAv.className = 'collaborator-avatar';
    selfAv.style.backgroundColor = userColor;
    selfAv.textContent = username.charAt(0).toUpperCase();
    selfAv.title = `${username} (You)`;
    collaboratorAvatars.appendChild(selfAv);

    // Add peer avatars (up to 3)
    let count = 0;
    remoteUsers.forEach((user) => {
      if (count < 3) {
        const av = document.createElement('div');
        av.className = 'collaborator-avatar';
        av.style.backgroundColor = user.color;
        av.textContent = user.username.charAt(0).toUpperCase();
        av.title = user.username;
        collaboratorAvatars.appendChild(av);
        count++;
      }
    });

    // Populate popover list
    collaboratorList.innerHTML = `
      <div class="collaborator-item">
        <span class="status-indicator" style="background-color: ${userColor};"></span>
        <span>${escapeHtml(username)} <em>(You)</em></span>
      </div>
    `;

    remoteUsers.forEach((user) => {
      const item = document.createElement('div');
      item.className = 'collaborator-item';
      item.innerHTML = `
        <span class="status-indicator" style="background-color: ${user.color};"></span>
        <span>${escapeHtml(user.username)}</span>
      `;
      collaboratorList.appendChild(item);
    });
  }

  // Tool Switching (Pen / Eraser)
  toolPen.addEventListener('click', () => {
    currentTool = 'pen';
    toolPen.classList.add('active');
    toolEraser.classList.remove('active');
  });

  toolEraser.addEventListener('click', () => {
    currentTool = 'eraser';
    toolEraser.classList.add('active');
    toolPen.classList.remove('active');
  });

  // Color Palette Selection
  colorDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      colorDots.forEach((d) => d.classList.remove('active'));
      dot.classList.add('active');
      currentColor = dot.getAttribute('data-color');
      customColorPicker.value = currentColor;

      // Switch back to pen tool if on eraser
      if (currentTool === 'eraser') {
        currentTool = 'pen';
        toolPen.classList.add('active');
        toolEraser.classList.remove('active');
      }
    });
  });

  // Custom Color Picker
  customColorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    colorDots.forEach((d) => d.classList.remove('active'));
    if (currentTool === 'eraser') {
      currentTool = 'pen';
      toolPen.classList.add('active');
      toolEraser.classList.remove('active');
    }
  });

  // Size Slider
  sizeSlider.addEventListener('input', (e) => {
    currentSize = parseInt(e.target.value, 10);
    sizeValue.textContent = `${currentSize}px`;
    const dotSize = Math.min(Math.max(currentSize, 3), 18);
    sizeDot.style.width = `${dotSize}px`;
    sizeDot.style.height = `${dotSize}px`;
  });

  // Undo Action (Button & Keyboard Shortcut)
  function triggerUndo() {
    socket.emit('draw:undo', {
      boardId: currentBoardId
    });
  }

  btnUndo.addEventListener('click', triggerUndo);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      triggerUndo();
    } else if (e.key.toLowerCase() === 'p') {
      toolPen.click();
    } else if (e.key.toLowerCase() === 'e') {
      toolEraser.click();
    }
  });

  // Clear Action
  btnClear.addEventListener('click', () => {
    modalConfirmClear.classList.add('open');
  });

  btnCloseClearModal.addEventListener('click', () => modalConfirmClear.classList.remove('open'));
  btnCancelClear.addEventListener('click', () => modalConfirmClear.classList.remove('open'));

  btnConfirmClear.addEventListener('click', () => {
    modalConfirmClear.classList.remove('open');
    socket.emit('board:clear', {
      boardId: currentBoardId
    });
  });

  // Export Canvas Image (PNG)
  btnExportImage.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const rect = viewport.getBoundingClientRect();
    tempCanvas.width = rect.width * 2;
    tempCanvas.height = rect.height * 2;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill solid white background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.scale(2, 2);

    // Draw all strokes
    for (let i = 0; i < localStrokes.length; i++) {
      const s = localStrokes[i];
      tempCtx.save();
      tempCtx.beginPath();
      tempCtx.moveTo(s.prevX, s.prevY);
      tempCtx.lineTo(s.currX, s.currY);
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.lineWidth = s.size;
      tempCtx.strokeStyle = s.isEraser ? '#ffffff' : s.color;
      tempCtx.stroke();
      tempCtx.closePath();
      tempCtx.restore();
    }

    const dataUrl = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `whiteboard-${currentBoardId}-${Date.now()}.png`;
    a.click();
    showToast('Whiteboard exported as PNG');
  });

  // Copy Board Link
  btnCopyBoardLink.addEventListener('click', () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?board=${encodeURIComponent(currentBoardId)}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      showToast('Invite link copied to clipboard!');
    }).catch(() => {
      prompt('Copy invite URL:', inviteUrl);
    });
  });

  // Switch Room Modal
  btnSwitchRoom.addEventListener('click', () => {
    inputBoardId.value = currentBoardId;
    modalSwitchRoom.classList.add('open');
  });

  btnCloseRoomModal.addEventListener('click', () => modalSwitchRoom.classList.remove('open'));
  btnCancelRoomModal.addEventListener('click', () => modalSwitchRoom.classList.remove('open'));

  formSwitchRoom.addEventListener('submit', (e) => {
    e.preventDefault();
    const newBoard = inputBoardId.value.trim();
    if (newBoard && newBoard !== currentBoardId) {
      window.location.search = `?board=${encodeURIComponent(newBoard)}`;
    } else {
      modalSwitchRoom.classList.remove('open');
    }
  });

  // Collaborators Popover Toggle
  collaboratorsBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    collaboratorsPopover.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!collaboratorsPopover.contains(e.target) && !collaboratorsBadge.contains(e.target)) {
      collaboratorsPopover.classList.remove('open');
    }
  });

  // Edit User Profile Modal
  btnEditUser.addEventListener('click', () => {
    inputUsername.value = username;
    profileColorChoices.forEach((el) => {
      if (el.getAttribute('data-color') === userColor) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
    modalEditProfile.classList.add('open');
  });

  btnCloseProfileModal.addEventListener('click', () => modalEditProfile.classList.remove('open'));
  btnCancelProfileModal.addEventListener('click', () => modalEditProfile.classList.remove('open'));

  let selectedProfileColor = userColor;
  profileColorChoices.forEach((choice) => {
    choice.addEventListener('click', () => {
      profileColorChoices.forEach((c) => c.classList.remove('selected'));
      choice.classList.add('selected');
      selectedProfileColor = choice.getAttribute('data-color');
    });
  });

  formEditProfile.addEventListener('submit', (e) => {
    e.preventDefault();
    const newName = inputUsername.value.trim();
    if (newName) {
      username = newName;
      userColor = selectedProfileColor;
      localStorage.setItem('syncboard_username', username);
      localStorage.setItem('syncboard_color', userColor);

      updateSelfProfileUI();

      // Re-join board with updated identity
      socket.emit('board:join', {
        boardId: currentBoardId,
        username,
        userColor
      });

      modalEditProfile.classList.remove('open');
      showToast('Profile updated!');
    }
  });

  // =========================================================================
  // 8. Utilities & Helpers
  // =========================================================================

  function updateSelfProfileUI() {
    myNameDisplay.textContent = username;
    myColorIndicator.style.backgroundColor = userColor;
    currentBoardDisplay.textContent = currentBoardId;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastHub.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-leave');
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  // Initial UI Setup
  updateSelfProfileUI();
  resizeCanvas();

})();
