const {
  boardRooms,
  getOrCreateBoard,
  persistBoard,
  flushPersistBoard,
  touchBoard,
  serializeStrokes,
  serializeUsers,
  INACTIVE_ROOM_TTL,
} = require("./store");

const ACTIVE_PATH_TIMEOUT = 150;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [boardId, board] of boardRooms) {
    if (Object.keys(board.users).length === 0 && now - board._lastActivity > INACTIVE_ROOM_TTL) {
      flushPersistBoard(boardId);
      boardRooms.delete(boardId);
    }
  }
}, 60 * 1000);
cleanupTimer.unref();

const setupBoardSocket = (io, socket) => {
  const startActivePath = (boardId) => {
    const now = Date.now();
    socket.data.activePath = {
      id: `path-${socket.id}-${now}`,
      userId: socket.id,
      username: socket.data.username || "Anonymous",
      color: socket.data.color || "#000000",
      segments: [],
    };
    const board = boardRooms.get(boardId);
    board.strokes.push(socket.data.activePath);
  };

  socket.on("board:join", async (payload) => {
    const boardId = String((payload && payload.boardId) || "").trim();
    const username = String((payload && payload.username) || "Anonymous").trim().slice(0, 24) || "Anonymous";
    const color = String((payload && payload.userColor) || "#000000");

    if (!boardId) {
      socket.emit("board:error", { message: "A boardId is required to join a board." });
      return;
    }

    const board = await getOrCreateBoard(boardId);

    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = username;
    socket.data.color = color;
    socket.data.activePath = null;
    socket.data.lastStrokeAt = 0;

    board.users[socket.id] = {
      username,
      color,
      cursor: { x: 0, y: 0 },
    };
    touchBoard(boardId);

    socket.emit("board:init", {
      strokes: serializeStrokes(board),
      activeUsers: serializeUsers(board),
    });

    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username,
      color,
    });

    console.log(`board:join   [${boardId}] ${username} (${socket.id})`);
  });

  socket.on("draw:stroke", (payload) => {
    const boardId = socket.data.boardId;
    const board = boardRooms.get(boardId);
    if (!board || !payload || !payload.stroke) return;

    const stroke = {
      prevX: Number(payload.stroke.prevX),
      prevY: Number(payload.stroke.prevY),
      currX: Number(payload.stroke.currX),
      currY: Number(payload.stroke.currY),
      color: payload.stroke.color || socket.data.color || "#000000",
      size: Number(payload.stroke.size) || 3,
    };

    if (![stroke.prevX, stroke.prevY, stroke.currX, stroke.currY].every(Number.isFinite)) {
      return;
    }

    const now = Date.now();
    if (!socket.data.activePath || now - socket.data.lastStrokeAt > ACTIVE_PATH_TIMEOUT) {
      startActivePath(boardId);
    }

    socket.data.activePath.segments.push(stroke);
    socket.data.lastStrokeAt = now;
    touchBoard(boardId);

    socket.to(boardId).emit("draw:broadcast", { stroke });
    persistBoard(boardId);
  });

  socket.on("stroke:end", () => {
    socket.data.activePath = null;
    socket.data.lastStrokeAt = 0;
  });

  socket.on("board:clear", async (payload) => {
    const boardId = socket.data.boardId || (payload && payload.boardId);
    const board = boardRooms.get(boardId);
    if (!board) return;

    board.strokes = [];
    socket.data.activePath = null;
    touchBoard(boardId);

    socket.to(boardId).emit("board:cleared", {
      clearedBy: socket.data.username || "Anonymous",
    });
    io.to(boardId).emit("board:sync", { strokes: serializeStrokes(board) });

    await flushPersistBoard(boardId);
    console.log(`board:clear  [${boardId}] cleared by ${socket.data.username}`);
  });

  socket.on("draw:undo", async (payload) => {
    const boardId = socket.data.boardId || (payload && payload.boardId);
    const board = boardRooms.get(boardId);
    if (!board || board.strokes.length === 0) return;

    socket.data.activePath = null;
    socket.data.lastStrokeAt = 0;
    board.strokes.pop();
    touchBoard(boardId);

    io.to(boardId).emit("board:sync", { strokes: serializeStrokes(board) });

    await flushPersistBoard(boardId);
    console.log(`draw:undo    [${boardId}] last stroke removed by ${socket.data.username}`);
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId) return;

    const board = boardRooms.get(boardId);
    if (!board) return;

    const username = (board.users[socket.id] && board.users[socket.id].username) || "Anonymous";
    delete board.users[socket.id];

    socket.to(boardId).emit("user:left", {
      userId: socket.id,
      username,
    });

    console.log(`user:left    [${boardId}] ${username} (${socket.id})`);
  });
};

module.exports = { setupBoardSocket };