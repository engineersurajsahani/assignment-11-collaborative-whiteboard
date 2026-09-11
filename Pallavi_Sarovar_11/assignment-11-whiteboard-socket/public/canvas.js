const socket = io();

const canvas = document.getElementById("whiteboard");
const ctx = canvas.getContext("2d");
const usernameInput = document.getElementById("username");
const boardInput = document.getElementById("boardId");
const colorPicker = document.getElementById("colorPicker");
const sizePicker = document.getElementById("sizePicker");
const sizeValue = document.getElementById("sizeValue");
const joinBtn = document.getElementById("joinBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const currentBoard = document.getElementById("currentBoard");
const userCount = document.getElementById("userCount");
const usersList = document.getElementById("usersList");
const remoteCursors = document.getElementById("remoteCursors");
const toast = document.getElementById("toast");
const connectionStatus = document.getElementById("connectionStatus");
const statusDot = document.getElementById("statusDot");

let boardId = new URLSearchParams(window.location.search).get("board") || "demo";
let username = localStorage.getItem("whiteboardUsername") || "";
let isDrawing = false;
let lastPoint = null;
let currentStrokeGroupId = null;
let activeUsers = {};
let remoteCursorElements = {};

boardInput.value = boardId;
usernameInput.value = username;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const oldCanvas = document.createElement("canvas");
  oldCanvas.width = canvas.width;
  oldCanvas.height = canvas.height;
  if (oldCanvas.width && oldCanvas.height) {
    oldCanvas.getContext("2d").drawImage(canvas, 0, 0);
  }

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (oldCanvas.width && oldCanvas.height) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(oldCanvas, 0, 0, oldCanvas.width, oldCanvas.height, 0, 0, rect.width, rect.height);
    ctx.restore();
  }
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return {
    x: source.clientX - rect.left,
    y: source.clientY - rect.top
  };
}

function drawStroke(stroke) {
  ctx.beginPath();
  ctx.moveTo(stroke.prevX, stroke.prevY);
  ctx.lineTo(stroke.currX, stroke.currY);
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function redraw(strokes) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  for (const stroke of strokes) drawStroke(stroke);
}

function joinBoard() {
  const requestedBoard = boardInput.value.trim() || "demo";
  username = usernameInput.value.trim() || `User-${socket.id?.slice(0, 5) || "guest"}`;
  boardId = requestedBoard;

  localStorage.setItem("whiteboardUsername", username);
  window.history.replaceState({}, "", `?board=${encodeURIComponent(boardId)}`);

  socket.emit("board:join", {
    boardId,
    username,
    userColor: colorPicker.value
  });

  currentBoard.textContent = boardId;
}

function renderUsers() {
  userCount.textContent = Object.keys(activeUsers).length;
  usersList.innerHTML = "";

  Object.values(activeUsers).forEach((user) => {
    const chip = document.createElement("span");
    chip.className = "user-chip";

    const dot = document.createElement("span");
    dot.className = "user-dot";
    dot.style.background = user.color;

    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(user.username));
    usersList.appendChild(chip);
  });
}

function addOrUpdateCursor(userId, x, y) {
  const user = activeUsers[userId];
  if (!user) return;

  if (!remoteCursorElements[userId]) {
    const cursor = document.createElement("div");
    cursor.className = "remote-cursor";
    cursor.style.color = user.color;
    cursor.textContent = `● ${user.username}`;
    remoteCursors.appendChild(cursor);
    remoteCursorElements[userId] = cursor;
  }

  const cursor = remoteCursorElements[userId];
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
}

function removeCursor(userId) {
  remoteCursorElements[userId]?.remove();
  delete remoteCursorElements[userId];
}

canvas.addEventListener("mousedown", (event) => {
  isDrawing = true;
  lastPoint = getPoint(event);
  currentStrokeGroupId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
});

canvas.addEventListener("mousemove", (event) => {
  const point = getPoint(event);

  socket.emit("cursor:move", {
    boardId,
    x: point.x,
    y: point.y
  });

  if (!isDrawing || !lastPoint) return;

  const stroke = {
    prevX: lastPoint.x,
    prevY: lastPoint.y,
    currX: point.x,
    currY: point.y,
    color: colorPicker.value,
    size: Number(sizePicker.value),
    strokeGroupId: currentStrokeGroupId
  };

  drawStroke(stroke);
  socket.emit("draw:stroke", { boardId, stroke });
  lastPoint = point;
});

window.addEventListener("mouseup", () => {
  isDrawing = false;
  lastPoint = null;
  currentStrokeGroupId = null;
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
  lastPoint = null;
  currentStrokeGroupId = null;
});

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  isDrawing = true;
  lastPoint = getPoint(event);
  currentStrokeGroupId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}, { passive: false });

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  const point = getPoint(event);

  socket.emit("cursor:move", {
    boardId,
    x: point.x,
    y: point.y
  });

  if (!isDrawing || !lastPoint) return;

  const stroke = {
    prevX: lastPoint.x,
    prevY: lastPoint.y,
    currX: point.x,
    currY: point.y,
    color: colorPicker.value,
    size: Number(sizePicker.value),
    strokeGroupId: currentStrokeGroupId
  };

  drawStroke(stroke);
  socket.emit("draw:stroke", { boardId, stroke });
  lastPoint = point;
}, { passive: false });

canvas.addEventListener("touchend", () => {
  isDrawing = false;
  lastPoint = null;
  currentStrokeGroupId = null;
});

sizePicker.addEventListener("input", () => {
  sizeValue.textContent = sizePicker.value;
});

joinBtn.addEventListener("click", joinBoard);

undoBtn.addEventListener("click", () => {
  socket.emit("draw:undo", { boardId });
});

clearBtn.addEventListener("click", () => {
  if (confirm("Clear the entire board for everyone?")) {
    socket.emit("board:clear", { boardId });
  }
});

socket.on("connect", () => {
  connectionStatus.textContent = "Connected";
  statusDot.style.background = "#2e7d32";
  joinBoard();
});

socket.on("disconnect", () => {
  connectionStatus.textContent = "Disconnected";
  statusDot.style.background = "#c62828";
});

socket.on("board:init", ({ strokes, activeUsers: users }) => {
  redraw(strokes || []);

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
});

socket.on("cursor:update", ({ userId, x, y }) => {
  addOrUpdateCursor(userId, x, y);
});

socket.on("board:cleared", ({ clearedBy }) => {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  showToast(`Canvas cleared by ${clearedBy}`);
});

socket.on("board:sync", ({ strokes }) => {
  redraw(strokes || []);
  showToast("Board synchronized after undo");
});

window.addEventListener("resize", resizeCanvas);

resizeCanvas();
