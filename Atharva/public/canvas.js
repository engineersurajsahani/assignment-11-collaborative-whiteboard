(() => {
  // ---------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------
  const joinOverlay = document.getElementById("join-overlay");
  const boardInput = document.getElementById("board-input");
  const nameInput = document.getElementById("name-input");
  const joinBtn = document.getElementById("join-btn");

  const app = document.getElementById("app");
  const boardNameLabel = document.getElementById("board-name-label");
  const connectionDot = document.getElementById("connection-dot");
  const canvas = document.getElementById("board-canvas");
  const ctx = canvas.getContext("2d");
  const cursorLayer = document.getElementById("cursor-layer");
  const userListEl = document.getElementById("user-list");
  const brushColorInput = document.getElementById("brush-color");
  const brushSizeInput = document.getElementById("brush-size");
  const undoBtn = document.getElementById("undo-btn");
  const clearBtn = document.getElementById("clear-btn");
  const toastEl = document.getElementById("toast");

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  let socket = null;
  let boardId = null;
  let username = null;
  let userColor = "#000000";

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentStrokeId = null;

  let allStrokes = []; // local mirror of the server's stroke history, for redraws
  const remoteCursorEls = new Map(); // userId -> DOM element
  const remoteCursorTimers = new Map(); // userId -> hide timeout
  const knownUsers = new Map(); // userId -> { username, color }

  const CURSOR_THROTTLE_MS = 40;
  let lastCursorSentAt = 0;

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function uuid() {
    return "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  // A curated palette so auto-assigned user/cursor colors stay legible and distinct.
  const USER_COLOR_PALETTE = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#14b8a6", "#3b82f6", "#6366f1", "#a855f7",
    "#ec4899", "#f43f5e", "#0ea5e9", "#84cc16",
  ];

  function assignRandomUserColor() {
    return USER_COLOR_PALETTE[Math.floor(Math.random() * USER_COLOR_PALETTE.length)];
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  function resizeCanvas() {
    // Preserve drawing across a resize by redrawing from the stroke buffer.
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    redrawAll();
  }

  function drawSegment(stroke) {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.prevX, stroke.prevY);
    ctx.lineTo(stroke.currX, stroke.currY);
    ctx.stroke();
  }

  function redrawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allStrokes.forEach(drawSegment);
  }

  function getCanvasCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const point = evt.touches ? evt.touches[0] : evt;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  function renderUserList() {
    userListEl.innerHTML = "";
    knownUsers.forEach((u) => {
      const chip = document.createElement("div");
      chip.className = "user-chip";
      chip.innerHTML = `<span class="swatch" style="background:${u.color}"></span>${u.username}`;
      userListEl.appendChild(chip);
    });
  }

  function ensureRemoteCursorEl(userId, uColor, uName) {
    let el = remoteCursorEls.get(userId);
    if (!el) {
      el = document.createElement("div");
      el.className = "remote-cursor";
      el.innerHTML = `<div class="dot-cursor" style="background:${uColor}"></div><div class="label" style="background:${uColor}">${uName}</div>`;
      cursorLayer.appendChild(el);
      remoteCursorEls.set(userId, el);
    }
    return el;
  }

  function removeRemoteCursor(userId) {
    const el = remoteCursorEls.get(userId);
    if (el) {
      el.remove();
      remoteCursorEls.delete(userId);
    }
    clearTimeout(remoteCursorTimers.get(userId));
    remoteCursorTimers.delete(userId);
  }

  // ---------------------------------------------------------------------
  // Join flow
  // ---------------------------------------------------------------------
  function prefillFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const board = params.get("board");
    if (board) boardInput.value = board;
  }
  prefillFromUrl();

  joinBtn.addEventListener("click", handleJoin);
  [boardInput, nameInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleJoin();
    })
  );

  function handleJoin() {
    const boardVal = boardInput.value.trim() || "default-room";
    const nameVal = nameInput.value.trim() || `Guest-${Math.floor(Math.random() * 1000)}`;
    const colorVal = assignRandomUserColor();

    boardId = boardVal;
    username = nameVal;
    userColor = colorVal;
    brushColorInput.value = colorVal;

    // Reflect chosen board in the URL for easy sharing.
    const url = new URL(window.location.href);
    url.searchParams.set("board", boardId);
    window.history.replaceState({}, "", url);

    joinOverlay.classList.add("hidden");
    app.classList.remove("hidden");
    boardNameLabel.textContent = boardId;

    resizeCanvas();
    connectSocket();
  }

  // ---------------------------------------------------------------------
  // Socket wiring
  // ---------------------------------------------------------------------
  function connectSocket() {
    socket = io("https://assignment-11-collaborative-whiteboard-bzun.onrender.com");

    socket.on("connect", () => {
      connectionDot.classList.remove("dot-offline");
      connectionDot.classList.add("dot-online");
      socket.emit("board:join", { boardId, username, userColor });
    });

    socket.on("disconnect", () => {
      connectionDot.classList.remove("dot-online");
      connectionDot.classList.add("dot-offline");
    });

    // Full history + roster on join.
    socket.on("board:init", ({ strokes, activeUsers }) => {
      allStrokes = strokes || [];
      redrawAll();
      knownUsers.clear();
      (activeUsers || []).forEach((u) => knownUsers.set(u.userId, u));
      knownUsers.set(socket.id, { username, color: userColor });
      renderUserList();
    });

    socket.on("user:joined", ({ userId, username: uName, color }) => {
      knownUsers.set(userId, { username: uName, color });
      renderUserList();
      showToast(`${uName} joined the board`);
    });

    socket.on("user:left", ({ userId, username: uName }) => {
      knownUsers.delete(userId);
      renderUserList();
      removeRemoteCursor(userId);
      if (uName) showToast(`${uName} left the board`);
    });

    // Incoming drawing from other peers.
    socket.on("draw:broadcast", ({ stroke }) => {
      allStrokes.push(stroke);
      drawSegment(stroke);
    });

    // Live collaborator cursor positions.
    socket.on("cursor:update", ({ userId, username: uName, color, x, y }) => {
      const el = ensureRemoteCursorEl(userId, color || "#333", uName || "Guest");
      el.style.transform = `translate(${x}px, ${y}px)`;

      clearTimeout(remoteCursorTimers.get(userId));
      const t = setTimeout(() => removeRemoteCursor(userId), 4000);
      remoteCursorTimers.set(userId, t);
    });

    // Board cleared by anyone in the room.
    socket.on("board:cleared", ({ clearedBy }) => {
      allStrokes = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      showToast(`Board cleared by ${clearedBy}`);
    });

    // Post-undo full-state resync.
    socket.on("board:sync", ({ strokes }) => {
      allStrokes = strokes || [];
      redrawAll();
    });
  }

  // ---------------------------------------------------------------------
  // Drawing input handlers
  // ---------------------------------------------------------------------
  function startStroke(evt) {
    isDrawing = true;
    currentStrokeId = uuid();
    const { x, y } = getCanvasCoords(evt);
    lastX = x;
    lastY = y;
  }

  function moveStroke(evt) {
    const { x, y } = getCanvasCoords(evt);

    // Always stream cursor position (throttled) regardless of drawing state.
    emitCursor(x, y);

    if (!isDrawing) return;

    const stroke = {
      strokeId: currentStrokeId,
      prevX: lastX,
      prevY: lastY,
      currX: x,
      currY: y,
      color: brushColorInput.value,
      size: Number(brushSizeInput.value),
    };

    drawSegment(stroke);
    allStrokes.push({ ...stroke, userId: socket?.id });

    if (socket && boardId) {
      socket.emit("draw:stroke", { boardId, stroke });
    }

    lastX = x;
    lastY = y;
  }

  function endStroke() {
    isDrawing = false;
    currentStrokeId = null;
  }

  function emitCursor(x, y) {
    if (!socket || !boardId) return;
    const now = Date.now();
    if (now - lastCursorSentAt < CURSOR_THROTTLE_MS) return;
    lastCursorSentAt = now;
    socket.emit("cursor:move", { boardId, x, y });
  }

  canvas.addEventListener("mousedown", startStroke);
  canvas.addEventListener("mousemove", moveStroke);
  window.addEventListener("mouseup", endStroke);
  canvas.addEventListener("mouseleave", () => {
    /* keep cursor broadcasting stop when leaving; drawing simply pauses */
  });

  // Touch support
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startStroke(e);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    moveStroke(e);
  });
  canvas.addEventListener("touchend", endStroke);

  window.addEventListener("resize", resizeCanvas);

  // ---------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------
  clearBtn.addEventListener("click", () => {
    if (!socket || !boardId) return;
    if (confirm("Clear the board for everyone?")) {
      socket.emit("board:clear", { boardId });
    }
  });

  undoBtn.addEventListener("click", () => {
    if (!socket || !boardId) return;
    socket.emit("draw:undo", { boardId });
  });
})();
 