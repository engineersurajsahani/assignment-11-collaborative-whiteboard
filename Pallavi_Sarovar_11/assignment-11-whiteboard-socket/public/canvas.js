/**
 * CollabBoard — Client-side Canvas & Socket.io Logic
 *
 * Architecture:
 * - Join modal collects username, then emits board:join.
 * - Drawing tools: pointer, pen, eraser.
 * - Each mousedown→mousemove…→mouseup sequence shares one strokeGroupId
 *   so the server can undo an entire continuous stroke at once.
 * - HiDPI-aware canvas resizing preserves drawings via server re-sync.
 * - Remote cursors render with colored pointer SVG and username label.
 */

(() => {
  "use strict";

  // ──────────── Socket ────────────
  const socket = io();

  // ──────────── DOM References ────────────
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const joinModal      = $("#joinModal");
  const clearModal     = $("#clearModal");
  const appEl          = $("#app");
  const usernameInput  = $("#username");
  const boardInput     = $("#boardId");
  const joinBtn        = $("#joinBtn");
  const canvas         = $("#whiteboard");
  const ctx            = canvas.getContext("2d");
  const canvasWrap     = $("#canvasWrap");
  const remoteCursors  = $("#remoteCursors");
  const currentBoardEl = $("#currentBoard");
  const userCountEl    = $("#userCount");
  const collabAvatars  = $("#collaboratorAvatars");
  const connectionBadge = $("#connectionBadge");
  const connectionStatus = $("#connectionStatus");
  const statusDotSm    = $("#statusDotSm");
  const colorPicker    = $("#colorPicker");
  const colorPreview   = $("#colorPreview");
  const colorSwatches  = $("#colorSwatches");
  const sizePicker     = $("#sizePicker");
  const sizeValueEl    = $("#sizeValue");
  const sizePreviewDot = $("#sizePreviewDot");
  const undoBtn        = $("#undoBtn");
  const clearBtn       = $("#clearBtn");
  const clearCancel    = $("#clearCancel");
  const clearConfirm   = $("#clearConfirm");
  const toastContainer = $("#toastContainer");

  // Status bar elements
  const statusTool     = $("#statusTool");
  const statusSize     = $("#statusSize");
  const statusColorDot = $("#statusColorDot");
  const statusColorHex = $("#statusColorHex");
  const statusConnection = $("#statusConnection");

  // Tool buttons
  const toolButtons = {
    pen:    $("#toolPen"),
    brush:  $("#toolBrush"),
    eraser: $("#toolEraser")
  };

  // ──────────── State ────────────
  let boardId = new URLSearchParams(window.location.search).get("board") || "demo";
  let username = localStorage.getItem("whiteboardUsername") || "";
  let hasJoined = false;
  let isDrawing = false;
  let lastPoint = null;
  let currentStrokeGroupId = null;
  let currentTool = "pen";        // 'pen' | 'brush' | 'eraser'
  let currentColor = "#1e1e1e";
  let currentSize = 4;
  let activeUsers = {};           // userId → { username, color }
  let remoteCursorElements = {};  // userId → DOM element
  let localStrokes = [];          // local cache for redraw after resize

  // ──────────── Init ────────────
  boardInput.value = boardId;
  usernameInput.value = username;

  // Focus username input on load
  setTimeout(() => usernameInput.focus(), 100);

  // ──────────── Toast Notifications ────────────
  function showToast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastContainer.appendChild(el);
    // Remove from DOM after animation completes
    setTimeout(() => el.remove(), 2600);
  }

  // ──────────── Canvas Sizing (HiDPI) ────────────
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width  = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";

    // Redraw from local strokes cache
    redraw(localStrokes);
  }

  // ──────────── Coordinate Helpers ────────────
  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  }

  // ──────────── Drawing Primitives ────────────
  function drawStroke(stroke) {
    ctx.beginPath();
    ctx.moveTo(stroke.prevX, stroke.prevY);
    ctx.lineTo(stroke.currX, stroke.currY);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth   = stroke.size;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
  }

  function redraw(strokes) {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const stroke of strokes) {
      drawStroke(stroke);
    }
  }

  // ──────────── Color Helper ────────────
  function hexToRgba(hex, alpha = 0.35) {
    if (!hex || hex === "#ffffff") return `rgba(255, 255, 255, ${alpha})`;
    const cleaned = hex.replace("#", "");
    const bigint = parseInt(cleaned.length === 3
      ? cleaned.split("").map(c => c + c).join("")
      : cleaned, 16);
    if (isNaN(bigint)) return hex;
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ──────────── Tool Selection ────────────
  function selectTool(tool) {
    currentTool = tool;

    // Update toolbar button states
    Object.entries(toolButtons).forEach(([name, btn]) => {
      if (btn) btn.classList.toggle("active", name === tool);
    });

    // Update canvas cursor
    canvasWrap.className = "canvas-wrap";
    if (tool === "eraser") canvasWrap.classList.add("cursor-eraser");
    else canvasWrap.classList.add("cursor-crosshair");

    // Update status bar
    const toolNames = { pen: "Pen", brush: "Brush", eraser: "Eraser" };
    statusTool.innerHTML = toolNames[tool] || "Pen";
  }

  // ──────────── Color Management ────────────
  function setColor(color) {
    currentColor = color;
    colorPicker.value = color;
    colorPreview.style.background = color;
    statusColorDot.style.background = color;
    statusColorHex.textContent = color;

    // Update swatch active state
    colorSwatches.querySelectorAll(".swatch").forEach((s) => {
      s.classList.toggle("active", s.dataset.color === color);
    });
  }

  // ──────────── Size Management ────────────
  function setSize(size) {
    currentSize = size;
    sizePicker.value = size;
    sizeValueEl.textContent = size;
    statusSize.textContent = `Size: ${size}px`;

    // Update preview dot
    const dotSize = Math.max(3, Math.min(24, size));
    sizePreviewDot.style.width  = dotSize + "px";
    sizePreviewDot.style.height = dotSize + "px";
  }

  // ──────────── Join Board ────────────
  function joinBoard() {
    const requestedBoard = boardInput.value.trim() || "demo";
    username = usernameInput.value.trim() || `User-${socket.id?.slice(0, 5) || "anon"}`;
    boardId = requestedBoard;

    localStorage.setItem("whiteboardUsername", username);
    window.history.replaceState({}, "", `?board=${encodeURIComponent(boardId)}`);

    socket.emit("board:join", {
      boardId,
      username,
      userColor: colorPicker.value
    });

    currentBoardEl.textContent = boardId;

    // Switch to app view
    joinModal.style.display = "none";
    appEl.style.display = "flex";
    hasJoined = true;

    // Resize canvas now that it is visible
    requestAnimationFrame(() => {
      resizeCanvas();
    });
  }

  // ──────────── Render Collaborators ────────────
  function renderUsers() {
    const users = Object.values(activeUsers);
    userCountEl.textContent = users.length;

    // Clear and rebuild avatar strip
    collabAvatars.innerHTML = "";
    users.forEach((user) => {
      const avatar = document.createElement("div");
      avatar.className = "collab-avatar";
      avatar.style.background = user.color || "#ea580c";
      avatar.setAttribute("data-tooltip", user.username);
      avatar.textContent = (user.username || "?")[0].toUpperCase();
      collabAvatars.appendChild(avatar);
    });
  }

  // ──────────── Remote Cursor Rendering ────────────
  function addOrUpdateCursor(userId, x, y, cursorUsername, cursorColor) {
    // Try to resolve user info from activeUsers or from the cursor event itself
    const user = activeUsers[userId];
    const name  = cursorUsername || user?.username || "User";
    const color = cursorColor || user?.color || "#ea580c";

    if (!remoteCursorElements[userId]) {
      const wrapper = document.createElement("div");
      wrapper.className = "remote-cursor";

      // SVG cursor pointer
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "20");
      svg.setAttribute("viewBox", "0 0 16 20");
      svg.setAttribute("class", "cursor-pointer-svg");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M0 0L12 9.5L6.4 10.8L9.6 18.4L7 19.6L3.8 12L0 15.2V0Z");
      path.setAttribute("fill", color);
      path.setAttribute("stroke", "#fff");
      path.setAttribute("stroke-width", "1");
      svg.appendChild(path);
      wrapper.appendChild(svg);

      // Label
      const label = document.createElement("span");
      label.className = "cursor-label";
      label.style.background = color;
      label.textContent = name;
      wrapper.appendChild(label);

      remoteCursors.appendChild(wrapper);
      remoteCursorElements[userId] = wrapper;
    }

    const cursor = remoteCursorElements[userId];
    cursor.style.left = `${x}px`;
    cursor.style.top  = `${y}px`;
  }

  function removeCursor(userId) {
    if (remoteCursorElements[userId]) {
      remoteCursorElements[userId].remove();
      delete remoteCursorElements[userId];
    }
  }

  // ──────────── Drawing Event Handlers ────────────
  function onPointerDown(event) {
    if (event.target !== canvas) return;

    isDrawing = true;
    lastPoint = getPoint(event);
    currentStrokeGroupId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function onPointerMove(event) {
    const point = getPoint(event);

    // Always send cursor position for collaboration
    if (hasJoined) {
      socket.emit("cursor:move", {
        boardId,
        x: point.x,
        y: point.y
      });
    }

    if (!isDrawing || !lastPoint) return;

    let strokeColor = currentColor;
    let strokeSize  = currentSize;

    if (currentTool === "eraser") {
      strokeColor = "#ffffff";
      strokeSize  = Math.max(currentSize * 3, 14);
    } else if (currentTool === "brush") {
      // 100% solid opacity -> perfectly smooth and continuous, zero overlapping beads!
      strokeColor = currentColor;
      strokeSize  = Math.max(currentSize * 2.5, 8);
    } else {
      strokeColor = currentColor;
      strokeSize  = currentSize;
    }

    const stroke = {
      prevX: lastPoint.x,
      prevY: lastPoint.y,
      currX: point.x,
      currY: point.y,
      color: strokeColor,
      size:  strokeSize,
      strokeGroupId: currentStrokeGroupId
    };

    drawStroke(stroke);
    localStrokes.push(stroke);
    socket.emit("draw:stroke", { boardId, stroke });
    lastPoint = point;
  }

  function onPointerUp() {
    isDrawing = false;
    lastPoint = null;
    currentStrokeGroupId = null;
  }

  // Mouse events
  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  // Touch events
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    onPointerDown(e);
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    onPointerMove(e);
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    onPointerUp();
  }, { passive: false });

  // Prevent page scroll while drawing
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
  }, { passive: false });

  // ──────────── Tool Button Handlers ────────────
  Object.entries(toolButtons).forEach(([name, btn]) => {
    btn.addEventListener("click", () => selectTool(name));
  });

  // ──────────── Color Swatch Handlers ────────────
  colorSwatches.addEventListener("click", (e) => {
    const swatch = e.target.closest(".swatch");
    if (swatch && swatch.dataset.color) {
      setColor(swatch.dataset.color);
    }
  });

  colorPicker.addEventListener("input", () => {
    setColor(colorPicker.value);
  });

  // ──────────── Size Slider Handler ────────────
  sizePicker.addEventListener("input", () => {
    setSize(Number(sizePicker.value));
  });

  // ──────────── Join Button ────────────
  joinBtn.addEventListener("click", joinBoard);

  // Also allow Enter key in the modal
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBoard();
  });
  boardInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBoard();
  });

  // ──────────── Undo Button ────────────
  undoBtn.addEventListener("click", () => {
    if (!hasJoined) return;
    socket.emit("draw:undo", { boardId });
  });

  // ──────────── Clear Canvas (with confirmation modal) ────────────
  clearBtn.addEventListener("click", () => {
    if (!hasJoined) return;
    clearModal.style.display = "flex";
  });

  clearCancel.addEventListener("click", () => {
    clearModal.style.display = "none";
  });

  clearConfirm.addEventListener("click", () => {
    clearModal.style.display = "none";
    socket.emit("board:clear", { boardId });
  });

  // Close modal on overlay click
  clearModal.addEventListener("click", (e) => {
    if (e.target === clearModal) {
      clearModal.style.display = "none";
    }
  });

  // ──────────── Socket.io Events ────────────

  socket.on("connect", () => {
    connectionBadge.className = "connection-badge connected";
    connectionStatus.textContent = "Connected";
    statusDotSm.style.background = "#22c55e";
    statusConnection.innerHTML = '<span class="status-dot-sm" style="background:#22c55e"></span> Connected';

    if (hasJoined) {
      // Reconnect: re-join the board
      joinBoard();
    }
  });

  socket.on("disconnect", () => {
    connectionBadge.className = "connection-badge disconnected";
    connectionStatus.textContent = "Disconnected";
    statusDotSm.style.background = "#ef4444";
    statusConnection.innerHTML = '<span class="status-dot-sm" style="background:#ef4444"></span> Disconnected';
  });

  socket.on("board:init", ({ strokes, activeUsers: users }) => {
    localStrokes = strokes || [];
    redraw(localStrokes);

    activeUsers = {};
    for (const user of users || []) {
      activeUsers[user.userId] = user;
    }
    renderUsers();
  });

  socket.on("user:joined", (user) => {
    activeUsers[user.userId] = user;
    renderUsers();
    showToast(`${user.username} joined the board`);
  });

  socket.on("user:left", ({ userId, username: leftUsername }) => {
    delete activeUsers[userId];
    removeCursor(userId);
    renderUsers();
    showToast(`${leftUsername} left the board`);
  });

  socket.on("draw:broadcast", ({ stroke }) => {
    drawStroke(stroke);
    localStrokes.push(stroke);
  });

  socket.on("cursor:update", ({ userId, x, y, username: cursorUsername, color }) => {
    addOrUpdateCursor(userId, x, y, cursorUsername, color);
  });

  socket.on("board:cleared", ({ clearedBy }) => {
    localStrokes = [];
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    showToast(`Canvas cleared by ${clearedBy}`);
  });

  socket.on("board:sync", ({ strokes }) => {
    localStrokes = strokes || [];
    redraw(localStrokes);
    showToast("Board synchronized (undo)");
  });

  // ──────────── Window Resize ────────────
  window.addEventListener("resize", () => {
    if (hasJoined) resizeCanvas();
  });

  // ──────────── Initial Setup ────────────
  selectTool("pen");
  setColor("#1e1e1e");
  setSize(4);

})();
