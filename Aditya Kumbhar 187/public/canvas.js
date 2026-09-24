// Client-side Whiteboard & Socket.io logic

// Initialize Socket.io connection
const socket = io();

// DOM Elements
const canvas = document.getElementById("paintCanvas");
const ctx = canvas.getContext("2d");
const cursorOverlay = document.getElementById("cursorOverlay");
const currentRoomText = document.getElementById("currentRoomText");
const userCountEl = document.getElementById("userCount");
const usersListEl = document.getElementById("usersList");
const toastContainer = document.getElementById("toastContainer");

// Controls
const toolBrush = document.getElementById("toolBrush");
const toolEraser = document.getElementById("toolEraser");
const colorSwatches = document.querySelectorAll(".color-swatch");
const customColorPicker = document.getElementById("customColorPicker");
const brushSizeInput = document.getElementById("brushSize");
const sizePreview = document.getElementById("sizePreview");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

// State
let isDrawing = false;
let currentTool = "brush"; // "brush" | "eraser"
let currentColor = "#000000";
let currentSize = 4;
let prevX = 0;
let prevY = 0;
let currentStrokeId = null;
let strokesHistory = [];

// Room and User details
const urlParams = new URLSearchParams(window.location.search);
let boardId = urlParams.get("board") || "demo";
let username = urlParams.get("user") || "User_" + Math.floor(1000 + Math.random() * 9000);
let userColor = urlParams.get("color") || getRandomColor();
let activeUsers = {};

// Helper: Random user color generator
function getRandomColor() {
  const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Show toast notifications
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Update room info UI
currentRoomText.textContent = boardId;

// Resize canvas to full parent container width & height
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Store existing canvas content before resizing
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (canvas.width > 0 && canvas.height > 0) {
    tempCtx.drawImage(canvas, 0, 0);
  }

  canvas.width = rect.width;
  canvas.height = rect.height;

  // Restore drawing style settings
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Redraw strokes from history
  redrawAllStrokes(strokesHistory);
}

window.addEventListener("resize", resizeCanvas);

// Draw a single line segment
function drawLine(x1, y1, x2, y2, color, size, isEraser = false) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = isEraser ? "#ffffff" : color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.closePath();
}

// Redraw all strokes from server history snapshot
function redrawAllStrokes(strokes) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (Array.isArray(strokes)) {
    strokes.forEach((s) => {
      drawLine(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, s.isEraser);
    });
  }
}

// Get canvas relative mouse / touch coordinates
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: Math.round(clientX - rect.left),
    y: Math.round(clientY - rect.top)
  };
}

// Drawing Event Listeners
function startDrawing(e) {
  isDrawing = true;
  const coords = getCanvasCoords(e);
  prevX = coords.x;
  prevY = coords.y;

  // Generate unique strokeId for grouping continuous drag line segments
  currentStrokeId = `${socket.id || "local"}_${Date.now()}_${Math.random()}`;

  // Draw tiny starting point
  const isEraser = currentTool === "eraser";
  const strokeColor = isEraser ? "#ffffff" : currentColor;
  drawLine(prevX, prevY, prevX + 0.1, prevY + 0.1, strokeColor, currentSize, isEraser);

  const stroke = {
    prevX: prevX,
    prevY: prevY,
    currX: prevX + 0.1,
    currY: prevY + 0.1,
    color: strokeColor,
    size: currentSize,
    strokeId: currentStrokeId,
    isEraser: isEraser
  };

  strokesHistory.push(stroke);
  socket.emit("draw:stroke", { boardId, stroke });
}

let lastCursorEmit = 0;

function draw(e) {
  const coords = getCanvasCoords(e);
  const currX = coords.x;
  const currY = coords.y;

  // Stream live collaborator cursor (throttled to ~30fps)
  const now = Date.now();
  if (now - lastCursorEmit > 30) {
    socket.emit("cursor:move", { boardId, x: currX, y: currY });
    lastCursorEmit = now;
  }

  if (!isDrawing) return;

  const isEraser = currentTool === "eraser";
  const strokeColor = isEraser ? "#ffffff" : currentColor;

  drawLine(prevX, prevY, currX, currY, strokeColor, currentSize, isEraser);

  const stroke = {
    prevX: prevX,
    prevY: prevY,
    currX: currX,
    currY: currY,
    color: strokeColor,
    size: currentSize,
    strokeId: currentStrokeId,
    isEraser: isEraser
  };

  strokesHistory.push(stroke);
  socket.emit("draw:stroke", { boardId, stroke });

  prevX = currX;
  prevY = currY;
}

function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    currentStrokeId = null;
  }
}

// Mouse events
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

// Touch events for mobile/tablets
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startDrawing(e);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  draw(e);
}, { passive: false });

canvas.addEventListener("touchend", stopDrawing);

// Tool buttons: Brush & Eraser
toolBrush.addEventListener("click", () => {
  currentTool = "brush";
  toolBrush.classList.add("active");
  toolEraser.classList.remove("active");
  updateSizePreview();
});

toolEraser.addEventListener("click", () => {
  currentTool = "eraser";
  toolEraser.classList.add("active");
  toolBrush.classList.remove("active");
  updateSizePreview();
});

// Color swatch selections
colorSwatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    colorSwatches.forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
    currentColor = swatch.getAttribute("data-color");
    customColorPicker.value = currentColor;
    if (currentTool === "eraser") {
      toolBrush.click();
    }
    updateSizePreview();
  });
});

customColorPicker.addEventListener("input", (e) => {
  currentColor = e.target.value;
  colorSwatches.forEach((s) => s.classList.remove("active"));
  if (currentTool === "eraser") {
    toolBrush.click();
  }
  updateSizePreview();
});

// Size slider
brushSizeInput.addEventListener("input", (e) => {
  currentSize = parseInt(e.target.value, 10);
  updateSizePreview();
});

function updateSizePreview() {
  sizePreview.style.width = `${Math.min(currentSize, 24)}px`;
  sizePreview.style.height = `${Math.min(currentSize, 24)}px`;
  sizePreview.style.background = currentTool === "eraser" ? "#cbd5e1" : currentColor;
}
updateSizePreview();

// Clear canvas action
clearBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the entire whiteboard?")) {
    socket.emit("board:clear", { boardId });
  }
});

// Undo stroke action
undoBtn.addEventListener("click", () => {
  socket.emit("draw:undo", { boardId });
});

// Download canvas as image
downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `whiteboard-${boardId}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Copy invite link
copyLinkBtn.addEventListener("click", () => {
  const inviteUrl = `${window.location.origin}?board=${encodeURIComponent(boardId)}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast("Invite link copied to clipboard!");
  }).catch(() => {
    prompt("Copy this invite link:", inviteUrl);
  });
});

// Render Active Collaborators
function updateUsersList(users) {
  usersListEl.innerHTML = "";
  userCountEl.textContent = users.length;

  users.forEach((u) => {
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    avatar.style.backgroundColor = u.color || "#3b82f6";
    avatar.textContent = (u.username || "U").charAt(0).toUpperCase();
    avatar.title = u.username;
    usersListEl.appendChild(avatar);
  });
}

// Manage Collaborator Cursors
function updatePeerCursor(userId, username, color, x, y) {
  let cursorEl = document.getElementById(`cursor-${userId}`);
  if (!cursorEl) {
    cursorEl = document.createElement("div");
    cursorEl.id = `cursor-${userId}`;
    cursorEl.className = "peer-cursor";
    cursorEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="${color || "#3b82f6"}">
        <path d="M4 0l16 12.279-6.951 1.17 4.325 8.817-3.596 1.734-4.35-8.879-5.428 5.429v-20.55z" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
      <div class="peer-cursor-label" style="background-color: ${color || "#3b82f6"};">${username}</div>
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

// ----------------- Socket.io Event Listeners ----------------- //

// 1. Connection established -> Join board room
socket.on("connect", () => {
  resizeCanvas();
  socket.emit("board:join", {
    boardId: boardId,
    username: username,
    userColor: userColor
  });
});

// 2. Initial state received from server
socket.on("board:init", (data) => {
  strokesHistory = data.strokes || [];
  redrawAllStrokes(strokesHistory);
  if (data.activeUsers) {
    updateUsersList(data.activeUsers);
  }
});

// 3. New user joined room
socket.on("user:joined", (data) => {
  showToast(`${data.username} joined the board`);
  // Add to active users list if not already present
  const existing = document.querySelector(`.user-avatar[title="${data.username}"]`);
  if (!existing) {
    const currentCount = parseInt(userCountEl.textContent, 10) || 1;
    userCountEl.textContent = currentCount + 1;
    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    avatar.style.backgroundColor = data.color || "#3b82f6";
    avatar.textContent = (data.username || "U").charAt(0).toUpperCase();
    avatar.title = data.username;
    usersListEl.appendChild(avatar);
  }
});

// 4. User left room
socket.on("user:left", (data) => {
  showToast(`${data.username || "A user"} left`);
  removePeerCursor(data.userId);
  const avatars = document.querySelectorAll(".user-avatar");
  avatars.forEach((av) => {
    if (av.title === data.username) {
      av.remove();
      const currentCount = parseInt(userCountEl.textContent, 10) || 2;
      userCountEl.textContent = Math.max(1, currentCount - 1);
    }
  });
});

// 5. Drawing stroke broadcast from peer
socket.on("draw:broadcast", (data) => {
  const s = data.stroke;
  if (!s) return;
  strokesHistory.push(s);
  drawLine(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size, s.isEraser);
});

// 6. Live collaborator cursor movement
socket.on("cursor:update", (data) => {
  updatePeerCursor(data.userId, data.username, data.color, data.x, data.y);
});

// 7. Canvas cleared by someone
socket.on("board:cleared", (data) => {
  strokesHistory = [];
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  showToast(`Canvas was cleared by ${data.clearedBy || "a user"}`);
});

// 8. Board synced after undo
socket.on("board:sync", (data) => {
  strokesHistory = data.strokes || [];
  redrawAllStrokes(strokesHistory);
  showToast("Undo action synced");
});

// Initial canvas setup
resizeCanvas();
