(() => {
  const joinScreen = document.getElementById("join-screen");
  const app = document.getElementById("app");
  const usernameInput = document.getElementById("username-input");
  const boardInput = document.getElementById("board-input");
  const joinBtn = document.getElementById("join-btn");
  const boardNameEl = document.getElementById("board-name");
  const canvas = document.getElementById("board-canvas");
  const ctx = canvas.getContext("2d");
  const cursorLayer = document.getElementById("cursor-layer");
  const colorPicker = document.getElementById("color-picker");
  const sizePicker = document.getElementById("size-picker");
  const sizeLabel = document.getElementById("size-label");
  const undoBtn = document.getElementById("undo-btn");
  const clearBtn = document.getElementById("clear-btn");
  const usersList = document.getElementById("users-list");
  const toast = document.getElementById("toast");

  const USER_COLORS = ["#ff5722", "#3f51b5", "#00bcd4", "#8bc34a", "#e91e63", "#ff9800", "#9c27b0", "#009688"];

  let socket = null;
  let boardId = "";
  let username = "";
  let userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentStrokeId = null;
  let allStrokes = [];
  const peers = {};
  const peerCursorEls = {};

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const prev = canvas.toDataURL ? redrawSnapshot() : null;
    canvas.width = rect.width;
    canvas.height = rect.height;
    redrawAll();
  }

  function redrawSnapshot() {
    return null;
  }

  function getBoardUrlParam() {
    const params = new URLSearchParams(window.location.search);
    return params.get("board") || "";
  }


  boardInput.value = getBoardUrlParam();

  function showToast(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add("hidden"), 2500);
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

  function genStrokeId() {
    return `${socket.id || "local"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    };
  }

  function startDraw(e) {
    drawing = true;
    currentStrokeId = genStrokeId();
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
  }

  function moveDraw(e) {
    const pos = getPos(e);


    socket.emit("cursor:move", { boardId, x: pos.x, y: pos.y });

    if (!drawing) return;

    const stroke = {
      strokeId: currentStrokeId,
      prevX: lastX,
      prevY: lastY,
      currX: pos.x,
      currY: pos.y,
      color: colorPicker.value,
      size: Number(sizePicker.value),
    };

    allStrokes.push(stroke);
    drawSegment(stroke);
    socket.emit("draw:stroke", { boardId, stroke });

    lastX = pos.x;
    lastY = pos.y;
  }

  function endDraw() {
    drawing = false;
    currentStrokeId = null;
  }

  function renderUsersList() {
    usersList.innerHTML = "";
    Object.entries(peers).forEach(([id, p]) => {
      const chip = document.createElement("div");
      chip.className = "user-chip";
      chip.innerHTML = `<span class="user-dot" style="background:${p.color}"></span>${p.username}${id === socket.id ? " (you)" : ""}`;
      usersList.appendChild(chip);
    });
  }

  function upsertPeerCursor(userId, x, y) {
    const peer = peers[userId];
    if (!peer) return;

    let el = peerCursorEls[userId];
    if (!el) {
      el = document.createElement("div");
      el.className = "peer-cursor";
      el.innerHTML = `<span class="peer-cursor-dot" style="background:${peer.color}"></span><span class="peer-cursor-label" style="background:${peer.color}">${peer.username}</span>`;
      cursorLayer.appendChild(el);
      peerCursorEls[userId] = el;
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  function removePeerCursor(userId) {
    const el = peerCursorEls[userId];
    if (el) {
      el.remove();
      delete peerCursorEls[userId];
    }
  }

  function connectSocket() {
    socket = io();

    socket.on("connect", () => {
      socket.emit("board:join", { boardId, username, userColor });
    });


    socket.on("board:init", ({ strokes, activeUsers }) => {
      allStrokes = strokes || [];
      redrawAll();

      peers[socket.id] = { username, color: userColor };
      (activeUsers || []).forEach((u) => {
        peers[u.userId] = { username: u.username, color: u.color };
      });
      renderUsersList();
    });

    socket.on("user:joined", ({ userId, username: uname, color }) => {
      peers[userId] = { username: uname, color };
      renderUsersList();
      showToast(`${uname} joined the board`);
    });

    socket.on("user:left", ({ userId, username: uname }) => {
      delete peers[userId];
      removePeerCursor(userId);
      renderUsersList();
      if (uname) showToast(`${uname} left the board`);
    });

    socket.on("draw:broadcast", ({ stroke }) => {
      allStrokes.push(stroke);
      drawSegment(stroke);
    });

    socket.on("cursor:update", ({ userId, x, y }) => {
      upsertPeerCursor(userId, x, y);
    });

    socket.on("board:cleared", ({ clearedBy }) => {
      allStrokes = [];
      redrawAll();
      showToast(`${clearedBy} cleared the board`);
    });

    socket.on("board:sync", ({ strokes }) => {
      allStrokes = strokes || [];
      redrawAll();
    });
  }

  function joinBoard() {
    const uname = usernameInput.value.trim();
    const bid = boardInput.value.trim();
    if (!uname || !bid) {
      showToast("Please enter both your name and a board ID");
      return;
    }
    username = uname;
    boardId = bid;
    boardNameEl.textContent = boardId;

    joinScreen.classList.add("hidden");
    app.classList.remove("hidden");

    resizeCanvas();
    connectSocket();
  }

  joinBtn.addEventListener("click", joinBoard);
  usernameInput.addEventListener("keydown", (e) => e.key === "Enter" && joinBoard());
  boardInput.addEventListener("keydown", (e) => e.key === "Enter" && joinBoard());

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", moveDraw);
  window.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", () => {

  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDraw(e);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    moveDraw(e);
  });
  canvas.addEventListener("touchend", endDraw);

  sizePicker.addEventListener("input", () => {
    sizeLabel.textContent = `${sizePicker.value}px`;
  });

  undoBtn.addEventListener("click", () => {
    socket.emit("draw:undo", { boardId });
  });

  clearBtn.addEventListener("click", () => {
    socket.emit("board:clear", { boardId });
  });

  window.addEventListener("resize", resizeCanvas);
})();
