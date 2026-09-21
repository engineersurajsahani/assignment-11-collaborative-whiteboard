
const boardRooms = {};

const getOrCreateBoard = (boardId) => {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {},
    };
  }
  return boardRooms[boardId];
};

const activeUsersList = (board) =>
  Object.entries(board.users).map(([userId, user]) => ({
    userId,
    username: user.username,
    color: user.color,
  }));

const registerBoardHandlers = (io, socket) => {
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId) return;

    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = username || "Anonymous";
    socket.data.color = userColor || "#000000";

    const board = getOrCreateBoard(boardId);
    board.users[socket.id] = {
      username: socket.data.username,
      color: socket.data.color,
      cursor: { x: 0, y: 0 },
    };

    socket.emit("board:init", {
      strokes: board.strokes,
      activeUsers: activeUsersList(board),
    });

    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username: socket.data.username,
      color: socket.data.color,
    });
  });

  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;

    const board = getOrCreateBoard(boardId);
    board.strokes.push(stroke);
    socket.to(boardId).emit("draw:broadcast", { stroke });
  });

  socket.on("board:clear", ({ boardId }) => {
    if (!boardId) return;

    const board = getOrCreateBoard(boardId);
    board.strokes = [];

    io.to(boardId).emit("board:cleared", {
      clearedBy: socket.data.username || "Someone",
    });
  });

  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId) return;

    const board = getOrCreateBoard(boardId);
    if (board.strokes.length === 0) return;

    const lastGroupId = board.strokes[board.strokes.length - 1].strokeGroupId;
    board.strokes = board.strokes.filter((s) => s.strokeGroupId !== lastGroupId);

    io.to(boardId).emit("board:sync", { strokes: board.strokes });
  });

  socket.on("disconnect", () => {
    const { boardId, username } = socket.data;
    if (!boardId) return;

    const board = boardRooms[boardId];
    if (board) {
      delete board.users[socket.id];
    }

    socket.to(boardId).emit("user:left", { userId: socket.id, username });
  });
};

module.exports = { registerBoardHandlers, boardRooms };
