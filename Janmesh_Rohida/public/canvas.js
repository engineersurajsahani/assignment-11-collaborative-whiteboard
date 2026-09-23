/**
 * canvas.js
 * Client-side drawing logic, Socket.io event protocol handling,
 * peer cursor tracking overlay, and responsive UI interactions.
 */

document.addEventListener("DOMContentLoaded", () => {
  // -------------------------------------------------------------------------
  // 1. URL Query Parameter & Identity Initialization
  // -------------------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const boardId = urlParams.get("board") || "DESIGN_101";

  // Generate Guest Username & Random User Color
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const username = `Artist-${randomNum}`;
  const PRESET_USER_COLORS = [
    "#6F4E37", "#A9745B", "#D2B48C", "#4A3222",
    "#C0392B", "#8E44AD", "#2980B9", "#27AE60",
    "#D35400", "#16A085", "#7F8C8D", "#2C3E50"
  ];
  const userColor = PRESET_USER_COLORS[Math.floor(Math.random() * PRESET_USER_COLORS.length)];

  // Update Room Info in Header & Sidebar
  document.getElementById("room-id-display").textContent = boardId;
  document.getElementById("info-board-id").textContent = boardId;
  document.getElementById("current-user-name").textContent = username;
  document.getElementById("current-user-dot").style.backgroundColor = userColor;

  // -------------------------------------------------------------------------
  // 2. DOM Elements & Canvas Context Setup
  // -------------------------------------------------------------------------
  const canvas = document.getElementById("whiteboard");
  const ctx = canvas.getContext("2d");
  const cursorOverlay = document.getElementById("cursor-overlay");
  const usersListEl = document.getElementById("users-list");
  const userCountEl = document.getElementById("user-count");

  let dpr = window.devicePixelRatio || 1;
  let canvasRect = { width: 800, height: 600 };

  // Adjust Canvas Resolution for High-DPI Screens
  function resizeCanvas() {
    const parent = canvas.parentElement;
    canvasRect = parent.getBoundingClientRect();

    dpr = window.devicePixelRatio || 1;
    canvas.width = canvasRect.width * dpr;
    canvas.height = canvasRect.height * dpr;

    // Reset transform to scale for High-DPI sharp crisp lines
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Redraw existing strokes if history is available
    if (strokeHistory && strokeHistory.length > 0) {
      redrawAllStrokes(strokeHistory);
    }
  }

  window.addEventListener("resize", resizeCanvas);

  // -------------------------------------------------------------------------
  // 3. Drawing State & Helper Functions
  // -------------------------------------------------------------------------
  let isDrawing = false;
  let currentTool = "pen"; // 'pen' or 'eraser'
  let currentColor = "#3B2A20";
  let currentSize = 4;
  let currentActionId = null;
  let prevPos = { x: 0, y: 0 };
  let strokeHistory = [];
  let activeUsersMap = new Map(); // socketId -> { username, color }

  // Generate unique actionId for grouped stroke actions
  function generateActionId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "act_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Get pointer coordinates relative to logical canvas bounds
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // Core Vector Stroke Segment Renderer
  function drawSegment(context, stroke) {
    context.save();
    context.beginPath();
    context.moveTo(stroke.prevX, stroke.prevY);
    context.lineTo(stroke.currX, stroke.currY);
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  }

  // Complete Canvas Wipe and History Replay
  function redrawAllStrokes(strokes) {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    strokes.forEach(stroke => drawSegment(ctx, stroke));
  }

  // -------------------------------------------------------------------------
  // 4. Socket.io Connection & Protocol Handlers
  // -------------------------------------------------------------------------
  const socket = io();

  // On Connect -> Emit "board:join"
  socket.on("connect", () => {
    console.log(`[Socket] Connected as ${username} (${socket.id})`);
    socket.emit("board:join", {
      boardId,
      username,
      userColor
    });
  });

  // Event: "board:init" -> Receive full history & active user list
  socket.on("board:init", ({ strokes, activeUsers }) => {
    console.log("[Socket] Initialized board state. Strokes count:", strokes.length);
    strokeHistory = strokes || [];
    redrawAllStrokes(strokeHistory);

    activeUsersMap.clear();
    if (activeUsers && Array.isArray(activeUsers)) {
      activeUsers.forEach(u => activeUsersMap.set(u.userId, u));
    }
    renderUsersList();
  });

  // Event: "user:joined" -> New collaborator joins
  socket.on("user:joined", ({ userId, username: peerName, color: peerColor }) => {
    console.log(`[Socket] User joined: ${peerName} (${userId})`);
    activeUsersMap.set(userId, { userId, username: peerName, color: peerColor });
    renderUsersList();
    showToast(`${peerName} joined the whiteboard`, "info");
  });

  // Event: "user:left" -> Collaborator leaves
  socket.on("user:left", ({ userId, username: peerName }) => {
    console.log(`[Socket] User left: ${peerName} (${userId})`);
    activeUsersMap.delete(userId);
    renderUsersList();
    removePeerCursor(userId);
    showToast(`${peerName || "A collaborator"} left`, "info");
  });

  // Event: "draw:broadcast" -> Remote stroke segment received
  socket.on("draw:broadcast", ({ stroke }) => {
    if (stroke) {
      strokeHistory.push(stroke);
      drawSegment(ctx, stroke);
    }
  });

  // Event: "cursor:update" -> Live peer cursor position update
  socket.on("cursor:update", ({ userId, x, y }) => {
    const user = activeUsersMap.get(userId);
    if (user) {
      updatePeerCursor(userId, x, y, user.username, user.color);
    }
  });

  // Event: "board:cleared" -> Wipes canvas for all participants
  socket.on("board:cleared", ({ clearedBy }) => {
    strokeHistory = [];
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    showToast(`Canvas cleared by ${clearedBy}`, "warning");
  });

  // Event: "board:sync" -> Full state resync (after undo action)
  socket.on("board:sync", ({ strokes }) => {
    console.log("[Socket] Board resynced via board:sync. Strokes remaining:", strokes.length);
    strokeHistory = strokes || [];
    redrawAllStrokes(strokeHistory);
    showToast("Last stroke undone", "info");
  });

  // -------------------------------------------------------------------------
  // 5. Drawing Event Listeners (Mouse & Touch)
  // -------------------------------------------------------------------------
  function startDrawing(e) {
    e.preventDefault();
    isDrawing = true;
    currentActionId = generateActionId();
    prevPos = getCanvasCoords(e);
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();

    const currPos = getCanvasCoords(e);

    // Build stroke object segment
    const stroke = {
      prevX: prevPos.x,
      prevY: prevPos.y,
      currX: currPos.x,
      currY: currPos.y,
      color: currentTool === "eraser" ? "#FFFFFF" : currentColor,
      size: currentTool === "eraser" ? currentSize * 4 : currentSize,
      actionId: currentActionId
    };

    // Draw locally immediately (zero perceived latency)
    strokeHistory.push(stroke);
    drawSegment(ctx, stroke);

    // Emit stroke segment to server
    socket.emit("draw:stroke", {
      boardId,
      stroke
    });

    prevPos = currPos;
  }

  function stopDrawing(e) {
    if (isDrawing) {
      isDrawing = false;
      currentActionId = null;
    }
  }

  // Mouse listeners
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("mouseleave", stopDrawing);

  // Touch support for tablets/mobile
  canvas.addEventListener("touchstart", startDrawing, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stopDrawing);
  canvas.addEventListener("touchcancel", stopDrawing);

  // -------------------------------------------------------------------------
  // 6. Throttled Client-Side Cursor Streaming
  // -------------------------------------------------------------------------
  let lastCursorEmitTime = 0;
  const CURSOR_THROTTLE_MS = 35; // ~30 FPS coordinate updates

  canvas.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - lastCursorEmitTime > CURSOR_THROTTLE_MS) {
      lastCursorEmitTime = now;
      const coords = getCanvasCoords(e);
      socket.emit("cursor:move", {
        boardId,
        x: coords.x,
        y: coords.y
      });
    }
  });

  // -------------------------------------------------------------------------
  // 7. Remote Peer Cursor Tag Rendering
  // -------------------------------------------------------------------------
  function updatePeerCursor(userId, x, y, peerName, peerColor) {
    let cursorEl = document.getElementById(`cursor-${userId}`);

    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.id = `cursor-${userId}`;
      cursorEl.className = "peer-cursor";

      cursorEl.innerHTML = `
        <div class="cursor-pointer-icon" style="background-color: ${peerColor};"></div>
        <div class="cursor-label" style="background-color: ${peerColor};">${peerName}</div>
      `;
      cursorOverlay.appendChild(cursorEl);
    }

    cursorEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  function removePeerCursor(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`);
    if (cursorEl) {
      cursorEl.remove();
    }
  }

  // -------------------------------------------------------------------------
  // 8. Active Users Sidebar List Rendering
  // -------------------------------------------------------------------------
  function renderUsersList() {
    usersListEl.innerHTML = "";
    userCountEl.textContent = activeUsersMap.size;

    activeUsersMap.forEach((user, userId) => {
      const isSelf = userId === socket.id;
      const li = document.createElement("li");
      li.className = "user-item";
      li.innerHTML = `
        <span class="swatch" style="background-color: ${user.color}"></span>
        <span class="name">${user.username}</span>
        ${isSelf ? '<span class="you-badge">You</span>' : ""}
      `;
      usersListEl.appendChild(li);
    });
  }

  // -------------------------------------------------------------------------
  // 9. UI Controls (Tools, Colors, Sizes, Actions)
  // -------------------------------------------------------------------------
  // Tool buttons
  const penBtn = document.getElementById("tool-pen");
  const eraserBtn = document.getElementById("tool-eraser");

  penBtn.addEventListener("click", () => {
    currentTool = "pen";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
  });

  eraserBtn.addEventListener("click", () => {
    currentTool = "eraser";
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
  });

  // Size buttons & slider
  const sizeBtns = document.querySelectorAll(".size-btn");
  const sizeSlider = document.getElementById("brush-size-slider");
  const sizeDisplay = document.getElementById("size-display");

  function setBrushSize(newSize) {
    currentSize = parseInt(newSize, 10);
    sizeSlider.value = currentSize;
    sizeDisplay.textContent = `${currentSize}px`;

    sizeBtns.forEach(btn => {
      if (parseInt(btn.getAttribute("data-size"), 10) === currentSize) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  sizeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      setBrushSize(btn.getAttribute("data-size"));
    });
  });

  sizeSlider.addEventListener("input", (e) => {
    setBrushSize(e.target.value);
  });

  // Color Swatches & Custom Picker
  const swatches = document.querySelectorAll(".color-swatch");
  const customColorPicker = document.getElementById("custom-color-picker");

  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      currentColor = swatch.getAttribute("data-color");
      swatches.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      // If currently using eraser, switch back to pen
      if (currentTool === "eraser") {
        currentTool = "pen";
        penBtn.classList.add("active");
        eraserBtn.classList.remove("active");
      }
    });
  });

  customColorPicker.addEventListener("input", (e) => {
    currentColor = e.target.value;
    swatches.forEach(s => s.classList.remove("active"));
    if (currentTool === "eraser") {
      currentTool = "pen";
      penBtn.classList.add("active");
      eraserBtn.classList.remove("active");
    }
  });

  // Canvas Actions: Undo & Clear
  const btnUndo = document.getElementById("btn-undo");
  const btnClear = document.getElementById("btn-clear");

  btnUndo.addEventListener("click", () => {
    socket.emit("draw:undo", { boardId });
  });

  btnClear.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the entire canvas for all collaborators in this room?")) {
      socket.emit("board:clear", { boardId });
    }
  });

  // Copy Room Link
  const copyRoomBtn = document.getElementById("copy-room-btn");
  copyRoomBtn.addEventListener("click", () => {
    const url = window.location.origin + window.location.pathname + `?board=${boardId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Room URL copied to clipboard!", "info");
    }).catch(() => {
      showToast(`Room URL: ${url}`, "info");
    });
  });

  // -------------------------------------------------------------------------
  // 10. Toast Notification System
  // -------------------------------------------------------------------------
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    
    const iconClass = type === "warning" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-info";
    toast.innerHTML = `<i class="${iconClass}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Initial layout sizing call
  resizeCanvas();
});
