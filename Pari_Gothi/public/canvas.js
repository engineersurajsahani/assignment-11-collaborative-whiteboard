/**
 * canvas.js
 * Client-side Canvas Drawing Logic & Socket.io Event Handling
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Socket.io Connection
  const socket = io();

  // DOM Elements
  const canvas = document.getElementById('whiteboardCanvas');
  const ctx = canvas.getContext('2d');
  const cursorsLayer = document.getElementById('cursorsLayer');
  const toastContainer = document.getElementById('toastContainer');

  // Top Bar Elements
  const currentRoomDisplay = document.getElementById('currentRoomDisplay');
  const copyRoomBtn = document.getElementById('copyRoomBtn');
  const switchRoomBtn = document.getElementById('switchRoomBtn');
  const collaboratorsList = document.getElementById('collaboratorsList');
  const userCountBadge = document.getElementById('userCountBadge');
  const userColorIndicator = document.getElementById('userColorIndicator');
  const usernameDisplay = document.getElementById('usernameDisplay');

  // Toolbar Elements
  const brushToolBtn = document.getElementById('brushToolBtn');
  const eraserToolBtn = document.getElementById('eraserToolBtn');
  const colorSwatches = document.querySelectorAll('.color-swatch');
  const customColorInput = document.getElementById('customColorInput');
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushSizeValue = document.getElementById('brushSizeValue');
  const sizePreviewDot = document.getElementById('sizePreviewDot');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');

  // Modal Elements
  const joinModal = document.getElementById('joinModal');
  const joinForm = document.getElementById('joinForm');
  const roomInput = document.getElementById('roomInput');
  const usernameInput = document.getElementById('usernameInput');
  const modalColorGrid = document.getElementById('modalColorGrid');

  // Application State
  const state = {
    boardId: 'demo',
    username: 'User_' + Math.floor(1000 + Math.random() * 9000),
    userColor: '#3b82f6',
    tool: 'brush', // 'brush' or 'eraser'
    color: '#3b82f6',
    size: 4,
    isDrawing: false,
    prevX: 0,
    prevY: 0,
    currentStrokeId: null,
    strokes: [], // local cache for redraws
    activeUsers: new Map(), // userId -> { username, color, element }
    peerCursors: new Map(), // userId -> DOM Element
    isPointerMoving: false
  };

  // --------------------------------------------------------------------------
  // 1. URL Query Parameter & Initial Join Setup
  // --------------------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const paramBoard = urlParams.get('board');
  const paramUser = urlParams.get('user');

  if (paramBoard) {
    state.boardId = paramBoard.trim();
    roomInput.value = state.boardId;
  } else {
    roomInput.value = state.boardId;
  }

  if (paramUser) {
    state.username = paramUser.trim();
    usernameInput.value = state.username;
  } else {
    usernameInput.value = state.username;
  }

  // Pre-select random color for user
  const choiceButtons = modalColorGrid.querySelectorAll('.user-color-choice');
  const randomChoice = choiceButtons[Math.floor(Math.random() * choiceButtons.length)];
  if (randomChoice) {
    choiceButtons.forEach(btn => btn.classList.remove('active'));
    randomChoice.classList.add('active');
    state.userColor = randomChoice.dataset.color;
    state.color = state.userColor;
  }

  // Color picker choice in modal
  modalColorGrid.addEventListener('click', (e) => {
    const target = e.target.closest('.user-color-choice');
    if (!target) return;
    choiceButtons.forEach(btn => btn.classList.remove('active'));
    target.classList.add('active');
    state.userColor = target.dataset.color;
    state.color = state.userColor;
  });

  // Handle Form Submission / Room Entry
  joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.boardId = roomInput.value.trim() || 'demo';
    state.username = usernameInput.value.trim() || 'Anonymous';

    // Update URL without refreshing page
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('board', state.boardId);
    window.history.pushState({}, '', newUrl);

    // Update UI headers
    currentRoomDisplay.textContent = state.boardId;
    usernameDisplay.textContent = state.username;
    userColorIndicator.style.backgroundColor = state.userColor;
    userColorIndicator.style.color = state.userColor;

    // Update active swatch
    updateActiveColor(state.color);

    // Close Modal
    joinModal.classList.add('hidden');

    // Emit board:join
    socket.emit('board:join', {
      boardId: state.boardId,
      username: state.username,
      userColor: state.userColor
    });

    showToast(`Joined room: <strong>${state.boardId}</strong> as <strong>${state.username}</strong>`, 'info');
  });

  // Switch Room Button
  switchRoomBtn.addEventListener('click', () => {
    roomInput.value = state.boardId;
    usernameInput.value = state.username;
    joinModal.classList.remove('hidden');
  });

  // Copy Room Invite Link
  copyRoomBtn.addEventListener('click', () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      showToast('Invite link copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Could not copy link to clipboard', 'danger');
    });
  });

  // --------------------------------------------------------------------------
  // 2. High-DPI Canvas Resizing & Coordinate Mapping
  // --------------------------------------------------------------------------
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    redrawAllStrokes();
  }

  window.addEventListener('resize', resizeCanvas);

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // --------------------------------------------------------------------------
  // 3. Drawing Rendering Functions
  // --------------------------------------------------------------------------
  function drawSegment(stroke) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(stroke.prevX, stroke.prevY);
    ctx.lineTo(stroke.currX, stroke.currY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.mode === 'eraser') {
      ctx.strokeStyle = '#0d121f'; // Canvas background color
      ctx.lineWidth = stroke.size * 2.5;
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    ctx.stroke();
    ctx.restore();
  }

  function redrawAllStrokes() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = 0; i < state.strokes.length; i++) {
      drawSegment(state.strokes[i]);
    }
  }

  // --------------------------------------------------------------------------
  // 4. Mouse & Touch Event Handlers (Local Drawing)
  // --------------------------------------------------------------------------
  function startDrawing(e) {
    if (e.button !== undefined && e.button !== 0) return; // Only primary mouse button
    state.isDrawing = true;
    const coords = getCanvasCoordinates(e);
    state.prevX = coords.x;
    state.prevY = coords.y;
    state.currentStrokeId = `${socket.id || 'local'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  function draw(e) {
    // Send live cursor coordinates
    sendCursorPosition(e);

    if (!state.isDrawing) return;

    const coords = getCanvasCoordinates(e);
    const currX = coords.x;
    const currY = coords.y;

    // Skip if negligible movement
    if (Math.abs(currX - state.prevX) < 0.5 && Math.abs(currY - state.prevY) < 0.5) {
      return;
    }

    const strokeData = {
      strokeId: state.currentStrokeId,
      prevX: state.prevX,
      prevY: state.prevY,
      currX: currX,
      currY: currY,
      color: state.color,
      size: state.size,
      mode: state.tool
    };

    // Draw locally immediately
    drawSegment(strokeData);
    state.strokes.push(strokeData);

    // Emit draw:stroke to server
    socket.emit('draw:stroke', {
      boardId: state.boardId,
      stroke: strokeData
    });

    state.prevX = currX;
    state.prevY = currY;
  }

  function stopDrawing() {
    if (state.isDrawing) {
      state.isDrawing = false;
      state.currentStrokeId = null;
    }
  }

  // Mouse listeners
  canvas.addEventListener('mousedown', startDrawing);
  window.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDrawing);

  // Touch listeners
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDrawing(e);
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    draw(e);
  }, { passive: false });

  window.addEventListener('touchend', stopDrawing);
  window.addEventListener('touchcancel', stopDrawing);

  // --------------------------------------------------------------------------
  // 5. Cursor Tracking (Optimized with requestAnimationFrame)
  // --------------------------------------------------------------------------
  let lastCursorX = 0;
  let lastCursorY = 0;
  let cursorTicking = false;

  function sendCursorPosition(e) {
    const coords = getCanvasCoordinates(e);
    lastCursorX = coords.x;
    lastCursorY = coords.y;

    if (!cursorTicking) {
      window.requestAnimationFrame(() => {
        socket.emit('cursor:move', {
          boardId: state.boardId,
          x: Math.round(lastCursorX),
          y: Math.round(lastCursorY)
        });
        cursorTicking = false;
      });
      cursorTicking = true;
    }
  }

  function updatePeerCursor(userId, x, y) {
    let cursorEl = state.peerCursors.get(userId);
    const userInfo = state.activeUsers.get(userId);
    const peerColor = (userInfo && userInfo.color) ? userInfo.color : '#6366f1';
    const peerName = (userInfo && userInfo.username) ? userInfo.username : 'Peer';

    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.className = 'peer-cursor';
      cursorEl.id = `cursor-${userId}`;
      cursorEl.innerHTML = `
        <svg class="peer-cursor-pointer" viewBox="0 0 24 24" fill="${peerColor}">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36Z" stroke="#ffffff" stroke-width="1.5"/>
        </svg>
        <span class="peer-cursor-label" style="border-left: 3px solid ${peerColor}">${escapeHtml(peerName)}</span>
      `;
      cursorsLayer.appendChild(cursorEl);
      state.peerCursors.set(userId, cursorEl);
    }

    cursorEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function removePeerCursor(userId) {
    const cursorEl = state.peerCursors.get(userId);
    if (cursorEl) {
      cursorEl.remove();
      state.peerCursors.delete(userId);
    }
  }

  // --------------------------------------------------------------------------
  // 6. UI Toolbar Controls & Actions
  // --------------------------------------------------------------------------
  function updateActiveColor(newColor) {
    state.color = newColor;
    sizePreviewDot.style.backgroundColor = state.tool === 'eraser' ? '#ffffff' : state.color;

    colorSwatches.forEach(swatch => {
      if (swatch.dataset.color.toLowerCase() === newColor.toLowerCase()) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });
  }

  function updateActiveTool(tool) {
    state.tool = tool;
    if (tool === 'brush') {
      brushToolBtn.classList.add('active');
      eraserToolBtn.classList.remove('active');
      sizePreviewDot.style.backgroundColor = state.color;
      canvas.style.cursor = 'crosshair';
    } else {
      eraserToolBtn.classList.add('active');
      brushToolBtn.classList.remove('active');
      sizePreviewDot.style.backgroundColor = '#ffffff';
      canvas.style.cursor = 'cell';
    }
  }

  brushToolBtn.addEventListener('click', () => updateActiveTool('brush'));
  eraserToolBtn.addEventListener('click', () => updateActiveTool('eraser'));

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      updateActiveTool('brush');
      updateActiveColor(swatch.dataset.color);
    });
  });

  customColorInput.addEventListener('input', (e) => {
    updateActiveTool('brush');
    updateActiveColor(e.target.value);
  });

  function updateBrushSize(newSize) {
    state.size = newSize;
    brushSizeSlider.value = newSize;
    brushSizeValue.textContent = `${newSize}px`;
    const previewSize = Math.max(3, Math.min(20, newSize));
    sizePreviewDot.style.width = `${previewSize}px`;
    sizePreviewDot.style.height = `${previewSize}px`;
  }

  brushSizeSlider.addEventListener('input', (e) => {
    updateBrushSize(Number(e.target.value));
  });

  // Undo Action
  undoBtn.addEventListener('click', () => {
    socket.emit('draw:undo', { boardId: state.boardId });
  });

  // Clear Action
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear the entire whiteboard for everyone in this room?')) {
      socket.emit('board:clear', { boardId: state.boardId });
    }
  });

  // Export as PNG
  exportBtn.addEventListener('click', () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    // Fill dark background
    expCtx.fillStyle = '#0d121f';
    expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    expCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `collab-whiteboard-${state.boardId}-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
    showToast('Canvas exported as PNG', 'success');
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // If active element is an input, skip shortcuts
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      socket.emit('draw:undo', { boardId: state.boardId });
    } else if (e.key.toLowerCase() === 'b') {
      updateActiveTool('brush');
    } else if (e.key.toLowerCase() === 'e') {
      updateActiveTool('eraser');
    }
  });

  // --------------------------------------------------------------------------
  // 7. Collaborators List & UI Badges
  // --------------------------------------------------------------------------
  function renderCollaborators() {
    collaboratorsList.innerHTML = '';
    const users = Array.from(state.activeUsers.values());

    users.forEach(u => {
      const avatar = document.createElement('div');
      avatar.className = 'collaborator-avatar';
      avatar.style.backgroundColor = u.color;
      avatar.title = u.username;
      avatar.textContent = (u.username || 'U').charAt(0).toUpperCase();
      collaboratorsList.appendChild(avatar);
    });

    const count = users.length + 1; // including self
    userCountBadge.textContent = `${count} online`;
  }

  // --------------------------------------------------------------------------
  // 8. Socket.io Event Protocol Implementation
  // --------------------------------------------------------------------------

  // board:init (Server -> Client)
  socket.on('board:init', (data) => {
    state.strokes = data.strokes || [];
    redrawAllStrokes();

    state.activeUsers.clear();
    if (Array.isArray(data.activeUsers)) {
      data.activeUsers.forEach(u => {
        if (u.userId !== socket.id) {
          state.activeUsers.set(u.userId, u);
        }
      });
    }
    renderCollaborators();
  });

  // user:joined (Server -> Room)
  socket.on('user:joined', (data) => {
    state.activeUsers.set(data.userId, {
      username: data.username,
      color: data.color
    });
    renderCollaborators();
    showToast(`<strong>${escapeHtml(data.username)}</strong> joined the board`, 'info');
  });

  // user:left (Server -> Room)
  socket.on('user:left', (data) => {
    removePeerCursor(data.userId);
    state.activeUsers.delete(data.userId);
    renderCollaborators();
    showToast(`<strong>${escapeHtml(data.username || 'A collaborator')}</strong> left`, 'info');
  });

  // draw:broadcast (Server -> Room)
  socket.on('draw:broadcast', (data) => {
    if (data && data.stroke) {
      state.strokes.push(data.stroke);
      drawSegment(data.stroke);
    }
  });

  // cursor:update (Server -> Room)
  socket.on('cursor:update', (data) => {
    if (data && data.userId && typeof data.x === 'number' && typeof data.y === 'number') {
      updatePeerCursor(data.userId, data.x, data.y);
    }
  });

  // board:cleared (Server -> Room)
  socket.on('board:cleared', (data) => {
    state.strokes = [];
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    showToast(`Board cleared by <strong>${escapeHtml(data.clearedBy || 'someone')}</strong>`, 'danger');
  });

  // board:sync (Server -> Room)
  socket.on('board:sync', (data) => {
    state.strokes = data.strokes || [];
    redrawAllStrokes();
    showToast('Stroke undone', 'info');
  });

  // --------------------------------------------------------------------------
  // Helper Utilities
  // --------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // Initial setup call
  updateBrushSize(4);
  resizeCanvas();
});
