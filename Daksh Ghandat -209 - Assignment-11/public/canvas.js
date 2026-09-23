/* global io */

const boardId = new URLSearchParams(location.search).get("board") || "demo";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const wrap = document.getElementById("canvasWrap");
const cursorLayer = document.getElementById("cursorLayer");

const usernameInput = document.getElementById("username");
const brushColorInput = document.getElementById("brushColor");
const brushSizeInput = document.getElementById("brushSize");
const brushSizeLabel = document.getElementById("brushSizeLabel");
const undoBtn = document.getElementById("undoBtn");
const clearBtn = document.getElementById("clearBtn");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const userList = document.getElementById("userList");
const userCount = document.getElementById("userCount");
const boardName = document.getElementById("boardName");

const DRAW_WIDTH = 1200;
const DRAW_HEIGHT = 700;

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = DRAW_WIDTH * dpr;
  canvas.height = DRAW_HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function canvasRect() {
  return canvas.getBoundingClientRect();
}

function toCanvasCoords(clientX, clientY) {
  const rect = canvasRect();
  return {
    x: ((clientX - rect.left) * DRAW_WIDTH) / rect.width,
    y: ((clientY - rect.top) * DRAW_HEIGHT) / rect.height,
  };
}

function toScreenCoords(x, y) {
  const rect = canvasRect();
  return {
    x: (x * rect.width) / DRAW_WIDTH,
    y: (y * rect.height) / DRAW_HEIGHT,
  };
}

function clearCanvas() {
  ctx.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
}

function drawSegment(prevX, prevY, currX, currY, color, size) {
  ctx.beginPath();
  ctx.moveTo(prevX, prevY);
  ctx.lineTo(currX, currY);
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.stroke();
}

function redrawStrokes(strokes) {
  clearCanvas();
  for (const path of strokes) {
    for (const seg of path.segments) {
      drawSegment(seg.prevX, seg.prevY, seg.currX, seg.currY, seg.color, seg.size);
    }
  }
}

boardName.textContent = `board: ${boardId}`;

setupCanvas();
window.addEventListener("resize", () => {
  const strokes = getLastStrokes();
  setupCanvas();
  redrawStrokes(strokes);
});

let lastStrokes = [];
function getLastStrokes() {
  return lastStrokes;
}

const roomUsers = new Map();

const socket = io();

let myColor = brushColorInput.value;
let myUsername = usernameInput.value.trim() || "Anonymous";
let isDrawing = false;
let lastPoint = null;
let lastCursorSent = { x: 0, y: 0 };
let cursorFramePending = false;

const remoteCursors = new Map();

function setConnection(state) {
  if (state === "online") {
    connDot.className = "dot online";
    connText.textContent = "connected";
  } else if (state === "offline") {
    connDot.className = "dot offline";
    connText.textContent = "offline";
  } else {
    connDot.className = "dot";
    connText.textContent = "connecting…";
  }
}

setConnection("connecting");
socket.on("connect", () => {
  setConnection("online");
  socket.emit("board:join", {
    boardId,
    username: myUsername,
    userColor: myColor,
  });
});

socket.on("disconnect", () => setConnection("offline"));
socket.on("connect_error", () => setConnection("offline"));

socket.on("board:error", (payload) => {
  console.error("[board:error]", payload && payload.message);
});

socket.on("board:init", (payload) => {
  const strokes = payload.strokes || [];
  lastStrokes = strokes;
  redrawStrokes(strokes);

  const users = payload.activeUsers || [];
  roomUsers.clear();
  for (const u of users) {
    roomUsers.set(u.userId, { username: u.username, color: u.color });
  }
  renderUserList();
  clearRemoteCursors();
  for (const u of users) {
    if (u.userId !== socket.id) upsertRemoteCursor(u);
  }
});

socket.on("draw:broadcast", (payload) => {
  const s = payload.stroke;
  if (!s) return;
  drawSegment(s.prevX, s.prevY, s.currX, s.currY, s.color, s.size);
});

socket.on("board:cleared", (payload) => {
  lastStrokes = [];
  clearCanvas();
  const who = payload.clearedBy || "Someone";
  flashNotice(`${who} cleared the board`);
});

socket.on("board:sync", (payload) => {
  lastStrokes = payload.strokes || [];
  redrawStrokes(lastStrokes);
});

socket.on("user:joined", (payload) => {
  roomUsers.set(payload.userId, {
    username: payload.username,
    color: payload.color,
  });
  renderUserList();
  upsertRemoteCursor(payload);
});

socket.on("user:left", (payload) => {
  roomUsers.delete(payload.userId);
  renderUserList();
  removeRemoteCursor(payload.userId);
});

socket.on("cursor:update", (payload) => {
  const cursor = remoteCursors.get(payload.userId);
  if (cursor) {
    moveCursorElement(cursor, payload.x, payload.y);
  }
});

let noticeTimer = null;
function flashNotice(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function getPointPosition(clientX, clientY) {
  return toCanvasCoords(clientX, clientY);
}

function handlePointerStart(clientX, clientY) {
  if (!socket.connected) return;
  isDrawing = true;
  const p = getPointPosition(clientX, clientY);
  lastPoint = p;
  const size = Number(brushSizeInput.value);
  drawSegment(p.x, p.y, p.x + 0.01, p.y + 0.01, brushColorInput.value, size);
  socket.emit("draw:stroke", {
    boardId,
    stroke: {
      prevX: p.x,
      prevY: p.y,
      currX: p.x + 0.01,
      currY: p.y + 0.01,
      color: brushColorInput.value,
      size,
    },
  });
}

function handlePointerMove(clientX, clientY) {
  const p = getPointPosition(clientX, clientY);

  if (isDrawing && lastPoint) {
    const size = Number(brushSizeInput.value);
    drawSegment(lastPoint.x, lastPoint.y, p.x, p.y, brushColorInput.value, size);
    socket.emit("draw:stroke", {
      boardId,
      stroke: {
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        currX: p.x,
        currY: p.y,
        color: brushColorInput.value,
        size,
      },
    });
  }

  lastPoint = p;
  scheduleCursorSend(p.x, p.y);
}

function handlePointerEnd() {
  if (!isDrawing) return;
  isDrawing = false;
  lastPoint = null;
  socket.emit("stroke:end", { boardId });
}

canvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  handlePointerStart(e.clientX, e.clientY);
});

window.addEventListener("mousemove", (e) => {
  handlePointerMove(e.clientX, e.clientY);
});

window.addEventListener("mouseup", handlePointerEnd);

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const t = e.touches[0];
    handlePointerStart(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const t = e.touches[0];
    handlePointerMove(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  handlePointerEnd();
});

function scheduleCursorSend(x, y) {
  if (cursorFramePending) return;
  cursorFramePending = true;
  requestAnimationFrame(() => {
    cursorFramePending = false;
    lastCursorSent.x = x;
    lastCursorSent.y = y;
    socket.emit("cursor:move", { boardId, x, y });
  });
}

undoBtn.addEventListener("click", () => socket.emit("draw:undo", { boardId }));
clearBtn.addEventListener("click", () => socket.emit("board:clear", { boardId }));

brushColorInput.addEventListener("input", () => {
  myColor = brushColorInput.value;
});

brushSizeInput.addEventListener("input", () => {
  brushSizeLabel.textContent = brushSizeInput.value;
});

usernameInput.addEventListener("change", () => {
  myUsername = usernameInput.value.trim() || "Anonymous";
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    socket.emit("draw:undo", { boardId });
  }
});

function upsertRemoteCursor(user) {
  if (user.userId === socket.id) return;

  let el = remoteCursors.get(user.userId);
  if (!el) {
    el = document.createElement("div");
    el.className = "remote-cursor";
    el.innerHTML =
      '<span class="cursor-head"></span><span class="cursor-name"></span>';
    cursorLayer.appendChild(el);
    remoteCursors.set(user.userId, el);
  }

  el.querySelector(".cursor-head").style.background = user.color;
  el.querySelector(".cursor-name").style.background = user.color;
  el.querySelector(".cursor-name").textContent = user.username;

  if (user.cursor && user.cursor.x != null) {
    moveCursorElement(el, user.cursor.x, user.cursor.y);
  }
}

function moveCursorElement(el, x, y) {
  const p = toScreenCoords(x, y);
  el.style.left = p.x + "px";
  el.style.top = p.y + "px";
}

function removeRemoteCursor(userId) {
  const el = remoteCursors.get(userId);
  if (el) {
    el.remove();
    remoteCursors.delete(userId);
  }
}

function clearRemoteCursors() {
  for (const el of remoteCursors.values()) el.remove();
  remoteCursors.clear();
}

function renderUserList() {
  userList.innerHTML = "";

  if (roomUsers.size === 0) {
    userCount.textContent = "(0)";
    const li = document.createElement("li");
    li.textContent = "No other collaborators yet.";
    li.style.color = "var(--muted)";
    li.style.background = "transparent";
    userList.appendChild(li);
    return;
  }

  userCount.textContent = `(${roomUsers.size})`;

  for (const [userId, u] of roomUsers) {
    const li = document.createElement("li");
    li.setAttribute("data-user", userId);

    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.background = u.color;
    avatar.textContent = (u.username || "?").charAt(0).toUpperCase();

    const name = document.createElement("span");
    name.className = "uname";
    name.textContent = u.username;

    li.appendChild(avatar);
    li.appendChild(name);

    if (userId === socket.id) {
      const you = document.createElement("span");
      you.className = "you-tag";
      you.textContent = "you";
      li.appendChild(you);
    }

    userList.appendChild(li);
  }
}