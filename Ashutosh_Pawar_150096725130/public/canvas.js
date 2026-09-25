const socket = io();

const canvas = document.getElementById("board");
const context = canvas.getContext("2d");
const cursorsLayer = document.getElementById("cursors");
const userList = document.getElementById("user-list");
const statusEl = document.getElementById("status");

const params = new URLSearchParams(location.search);
const boardId = params.get("board") || "demo";
document.getElementById("board-name").textContent = boardId;

const palette = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#008080", "#f032e6", "#9a6324"];
const userColor = palette[Math.floor(Math.random() * palette.length)];

let username = "Guest";
let hasName = false;
const peers = {};

let drawing = false;
let last = { x: 0, y: 0 };
let currentStrokeId = null;
let lastCursorSent = 0;

function newStrokeId() {
  return `${socket.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function drawSegment(stroke) {
  context.beginPath();
  context.moveTo(stroke.prevX, stroke.prevY);
  context.lineTo(stroke.currX, stroke.currY);
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function redraw(strokes) {
  clearCanvas();
  strokes.forEach(drawSegment);
}

function renderUsers() {
  userList.innerHTML = "";
  const you = document.createElement("li");
  you.innerHTML = `<span class="swatch" style="background:${userColor}"></span>${username} (you)`;
  userList.appendChild(you);

  Object.values(peers).forEach((peer) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="swatch" style="background:${peer.color}"></span>${peer.username}`;
    userList.appendChild(li);
  });
}

function moveCursor(userId, x, y) {
  const peer = peers[userId];
  if (!peer) return;

  let node = document.getElementById(`cursor-${userId}`);
  if (!node) {
    node = document.createElement("div");
    node.id = `cursor-${userId}`;
    node.className = "remote-cursor";
    node.innerHTML = `<div class="dot" style="background:${peer.color}"></div>
      <div class="label" style="background:${peer.color}">${peer.username}</div>`;
    cursorsLayer.appendChild(node);
  }

  node.style.left = `${(x / canvas.width) * 100}%`;
  node.style.top = `${(y / canvas.height) * 100}%`;
}

function removeCursor(userId) {
  const node = document.getElementById(`cursor-${userId}`);
  if (node) node.remove();
}

socket.on("connect", () => {
  statusEl.textContent = "online";
  statusEl.className = "status online";
  if (hasName) socket.emit("board:join", { boardId, username, userColor });
});

socket.on("disconnect", () => {
  statusEl.textContent = "offline";
  statusEl.className = "status offline";
});

socket.on("board:init", ({ strokes, activeUsers }) => {
  redraw(strokes);
  activeUsers.forEach((user) => {
    if (user.userId !== socket.id) {
      peers[user.userId] = { username: user.username, color: user.color };
    }
  });
  renderUsers();
});

socket.on("user:joined", ({ userId, username: name, color }) => {
  peers[userId] = { username: name, color };
  renderUsers();
});

socket.on("user:left", ({ userId }) => {
  delete peers[userId];
  removeCursor(userId);
  renderUsers();
});

socket.on("draw:broadcast", ({ stroke }) => {
  drawSegment(stroke);
});

socket.on("cursor:update", ({ userId, x, y }) => {
  moveCursor(userId, x, y);
});

socket.on("board:cleared", ({ clearedBy }) => {
  clearCanvas();
  Swal.fire({ toast: true, position: "top", icon: "info", title: `${clearedBy} cleared the board`, showConfirmButton: false, timer: 1800 });
});

socket.on("board:sync", ({ strokes }) => {
  redraw(strokes);
});

canvas.addEventListener("pointerdown", (event) => {
  drawing = true;
  currentStrokeId = newStrokeId();
  last = pointerPosition(event);
});

canvas.addEventListener("pointermove", (event) => {
  const point = pointerPosition(event);

  const now = Date.now();
  if (now - lastCursorSent > 30) {
    socket.emit("cursor:move", { boardId, x: point.x, y: point.y });
    lastCursorSent = now;
  }

  if (!drawing) return;

  const stroke = {
    prevX: last.x,
    prevY: last.y,
    currX: point.x,
    currY: point.y,
    color: document.getElementById("color").value,
    size: Number(document.getElementById("size").value),
    strokeId: currentStrokeId,
  };

  drawSegment(stroke);
  socket.emit("draw:stroke", { boardId, stroke });
  last = point;
});

function stopDrawing() {
  drawing = false;
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

document.getElementById("size").addEventListener("input", (event) => {
  document.getElementById("size-value").textContent = event.target.value;
});

document.getElementById("undo").addEventListener("click", () => {
  socket.emit("draw:undo", { boardId });
});

document.getElementById("clear").addEventListener("click", () => {
  Swal.fire({
    icon: "warning",
    title: "Clear the whole board?",
    text: "This wipes the canvas for everyone in the room.",
    showCancelButton: true,
    confirmButtonText: "Clear",
  }).then((result) => {
    if (result.isConfirmed) socket.emit("board:clear", { boardId });
  });
});

async function askName() {
  const result = await Swal.fire({
    title: "Enter your name",
    input: "text",
    inputValue: "Guest",
    inputPlaceholder: "Your display name",
    allowOutsideClick: false,
    confirmButtonText: "Join board",
  });
  username = (result.value || "Guest").trim() || "Guest";
  hasName = true;
  renderUsers();
  socket.emit("board:join", { boardId, username, userColor });
}

askName();
