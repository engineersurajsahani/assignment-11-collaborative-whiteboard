const socket = io();

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const wrapper = document.getElementById("canvasWrapper");
const cursors = document.getElementById("cursors");

const usernameInput = document.getElementById("username");
const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const sizeValue = document.getElementById("sizeValue");
const joinBtn = document.getElementById("joinBtn");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const status = document.getElementById("status");
const roomLabel = document.getElementById("roomLabel");

const params = new URLSearchParams(window.location.search);
const boardId = params.get("board") || "demo";

let drawing = false;
let lastX = 0;
let lastY = 0;
let joined = false;
let remoteUsers = {};

roomLabel.textContent = `Board: ${boardId}`;

function resizeCanvas() {
  const rect = wrapper.getBoundingClientRect();
  const old = document.createElement("canvas");
  old.width = canvas.width;
  old.height = canvas.height;
  old.getContext("2d").drawImage(canvas, 0, 0);

  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (old.width && old.height) {
    ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, canvas.width, canvas.height);
  }
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

function clearLocalCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function joinBoard() {
  const username = usernameInput.value.trim() || "Anonymous";
  const userColor = colorInput.value;

  socket.emit("board:join", {
    boardId,
    username,
    userColor
  });

  joined = true;
  usernameInput.disabled = true;
  colorInput.disabled = true;
  joinBtn.disabled = true;
  status.textContent = `Connected as ${username}`;
}

canvas.addEventListener("pointerdown", (event) => {
  if (!joined) return;

  drawing = true;
  const pos = getPosition(event);
  lastX = pos.x;
  lastY = pos.y;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!joined) return;

  const pos = getPosition(event);

  socket.emit("cursor:move", {
    boardId,
    x: pos.x,
    y: pos.y
  });

  if (!drawing) return;

  const stroke = {
    prevX: lastX,
    prevY: lastY,
    currX: pos.x,
    currY: pos.y,
    color: colorInput.value,
    size: Number(sizeInput.value)
  };

  drawStroke(stroke);
  socket.emit("draw:stroke", { boardId, stroke });

  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener("pointerup", () => {
  drawing = false;
});

canvas.addEventListener("pointercancel", () => {
  drawing = false;
});

joinBtn.addEventListener("click", joinBoard);

sizeInput.addEventListener("input", () => {
  sizeValue.textContent = `${sizeInput.value}px`;
});

undoBtn.addEventListener("click", () => {
  if (joined) socket.emit("draw:undo", { boardId });
});

clearBtn.addEventListener("click", () => {
  if (joined) socket.emit("board:clear", { boardId });
});

socket.on("connect", () => {
  status.textContent = "Connected — join the board";
});

socket.on("disconnect", () => {
  status.textContent = "Disconnected";
});

socket.on("board:init", ({ strokes, activeUsers }) => {
  clearLocalCanvas();
  strokes.forEach(drawStroke);

  remoteUsers = {};
  activeUsers.forEach((user) => {
    if (user.userId !== socket.id) {
      remoteUsers[user.userId] = user;
    }
  });

  renderCursors();
});

socket.on("draw:broadcast", ({ stroke }) => {
  drawStroke(stroke);
});

socket.on("board:cleared", ({ clearedBy }) => {
  clearLocalCanvas();
  status.textContent = `Canvas cleared by ${clearedBy}`;
});

socket.on("board:sync", ({ strokes }) => {
  clearLocalCanvas();
  strokes.forEach(drawStroke);
});

socket.on("user:joined", (user) => {
  remoteUsers[user.userId] = user;
  renderCursors();
});

socket.on("user:left", ({ userId }) => {
  delete remoteUsers[userId];
  renderCursors();
});

socket.on("cursor:update", ({ userId, x, y }) => {
  if (!remoteUsers[userId]) {
    remoteUsers[userId] = {
      username: "Collaborator",
      color: "#ff5722"
    };
  }

  remoteUsers[userId].x = x;
  remoteUsers[userId].y = y;
  renderCursors();
});

function renderCursors() {
  cursors.innerHTML = "";

  Object.entries(remoteUsers).forEach(([userId, user]) => {
    if (user.x == null || user.y == null) return;

    const cursor = document.createElement("div");
    cursor.className = "remote-cursor";
    cursor.style.left = `${user.x}px`;
    cursor.style.top = `${user.y}px`;
    cursor.innerHTML = `
      <span class="cursor-dot" style="background:${user.color}"></span>
      ${escapeHtml(user.username)}
    `;

    cursors.appendChild(cursor);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
