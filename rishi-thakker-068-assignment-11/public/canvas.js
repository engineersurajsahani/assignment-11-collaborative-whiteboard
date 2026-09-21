(() => {
  const params = new URLSearchParams(window.location.search);
  const boardId = params.get("board") || "demo";
  document.getElementById("boardIdLabel").textContent = boardId;

  const PALETTE = ["#4C6FFF", "#E5484D", "#12B76A", "#F79009", "#9B5DE5", "#00B8D9"];
  const myColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const cursorLayer = document.getElementById("cursorLayer");
  const toolbar = document.getElementById("toolbar");
  const joinOverlay = document.getElementById("joinOverlay");
  const usernameInput = document.getElementById("usernameInput");
  const joinButton = document.getElementById("joinButton");
  const colorPicker = document.getElementById("colorPicker");
  const sizePicker = document.getElementById("sizePicker");
  const undoButton = document.getElementById("undoButton");
  const clearButton = document.getElementById("clearButton");
  const statusDot = document.getElementById("statusDot");
  const statusLabel = document.getElementById("statusLabel");
  const userList = document.getElementById("userList");

  let socket = null;
  let username = "";
  let strokes = [];
  let activeUsers = {};
  let cursorEls = {};
  let isDrawing = false;
  let currentGroupId = null;
  let lastPoint = null;
  let lastCursorEmit = 0;

  function resizeCanvas() {
    const prevWidth = canvas.width;
    const prevHeight = canvas.height;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (prevWidth && prevHeight) {
      redrawAll();
    }
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

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
    strokes.forEach(drawSegment);
  }

  joinButton.addEventListener("click", join);
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") join();
  });

  function join() {
    const name = usernameInput.value.trim();
    if (!name) {
      usernameInput.focus();
      return;
    }
    username = name;
    joinOverlay.classList.add("hidden");
    toolbar.classList.remove("hidden");
    connectSocket();
  }

  function connectSocket() {
    socket = io();

    socket.on("connect", () => {
      statusDot.classList.add("online");
      statusLabel.textContent = "Connected";
      socket.emit("board:join", { boardId, username, userColor: myColor });
    });

    socket.on("disconnect", () => {
      statusDot.classList.remove("online");
      statusLabel.textContent = "Reconnecting…";
    });

    socket.on("board:init", ({ strokes: history, activeUsers: users }) => {
      strokes = history || [];
      redrawAll();

      activeUsers = {};
      (users || []).forEach((u) => {
        activeUsers[u.userId] = { username: u.username, color: u.color };
      });
      renderUserList();
    });

    socket.on("user:joined", ({ userId, username: uname, color }) => {
      activeUsers[userId] = { username: uname, color };
      renderUserList();
    });

    socket.on("user:left", ({ userId }) => {
      delete activeUsers[userId];
      renderUserList();
      if (cursorEls[userId]) {
        cursorEls[userId].remove();
        delete cursorEls[userId];
      }
    });

    socket.on("draw:broadcast", ({ stroke }) => {
      strokes.push(stroke);
      drawSegment(stroke);
    });

    socket.on("board:cleared", () => {
      strokes = [];
      redrawAll();
    });

    socket.on("board:sync", ({ strokes: freshStrokes }) => {
      strokes = freshStrokes || [];
      redrawAll();
    });

    socket.on("cursor:update", ({ userId, x, y }) => {
      updateRemoteCursor(userId, x, y);
    });
  }

  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches && e.touches[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startStroke(e) {
    isDrawing = true;
    currentGroupId = `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    lastPoint = getPoint(e);
  }

  function continueStroke(e) {
    const point = getPoint(e);

    if (isDrawing) {
      const stroke = {
        prevX: lastPoint.x,
        prevY: lastPoint.y,
        currX: point.x,
        currY: point.y,
        color: colorPicker.value,
        size: Number(sizePicker.value),
        strokeGroupId: currentGroupId,
      };

      drawSegment(stroke);
      strokes.push(stroke);
      socket.emit("draw:stroke", { boardId, stroke });
      lastPoint = point;
    }

    emitCursor(point);
  }

  function endStroke() {
    isDrawing = false;
    currentGroupId = null;
    lastPoint = null;
  }

  canvas.addEventListener("mousedown", startStroke);
  canvas.addEventListener("mousemove", continueStroke);
  window.addEventListener("mouseup", endStroke);

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startStroke(e);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    continueStroke(e);
  });
  canvas.addEventListener("touchend", endStroke);

  function emitCursor(point) {
    if (!socket) return;
    const now = performance.now();
    if (now - lastCursorEmit < 33) return;
    lastCursorEmit = now;
    socket.emit("cursor:move", { boardId, x: point.x, y: point.y });
  }

  function updateRemoteCursor(userId, x, y) {
    let el = cursorEls[userId];
    const user = activeUsers[userId];
    const color = (user && user.color) || "#8b93a1";
    const label = (user && user.username) || "Peer";

    if (!el) {
      el = document.createElement("div");
      el.className = "remoteCursor";
      el.innerHTML = `<div class="dot" style="background:${color}"></div><div class="label" style="background:${color}">${label}</div>`;
      cursorLayer.appendChild(el);
      cursorEls[userId] = el;
    }

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  undoButton.addEventListener("click", () => {
    socket.emit("draw:undo", { boardId });
  });

  clearButton.addEventListener("click", () => {
    socket.emit("board:clear", { boardId });
  });

  function renderUserList() {
    userList.innerHTML = "";
    Object.values(activeUsers).forEach((u) => {
      const chip = document.createElement("div");
      chip.className = "userChip";
      chip.style.background = u.color;
      chip.title = u.username;
      chip.textContent = (u.username || "?").charAt(0).toUpperCase();
      userList.appendChild(chip);
    });
  }
})();
