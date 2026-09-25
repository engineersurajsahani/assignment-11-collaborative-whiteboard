function getBoard(boardRooms, boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = { boardId, strokes: [], users: {} };
  }
  return boardRooms[boardId];
}

function listActiveUsers(board) {
  return Object.entries(board.users).map(([userId, user]) => ({
    userId,
    username: user.username,
    color: user.color,
  }));
}

function registerBoardHandlers(io, socket, boardRooms) {
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const board = getBoard(boardRooms, boardId);
    const name = username || "Guest";
    const color = userColor || "#000000";

    socket.data.boardId = boardId;
    socket.data.username = name;
    board.users[socket.id] = { username: name, color, cursor: { x: 0, y: 0 } };

    socket.join(boardId);

    socket.emit("board:init", { strokes: board.strokes, activeUsers: listActiveUsers(board) });
    socket.to(boardId).emit("user:joined", { userId: socket.id, username: name, color });
  });

  socket.on("draw:stroke", ({ boardId, stroke }) => {
    const board = boardRooms[boardId];
    if (!board || !stroke) return;

    const record = { ...stroke, userId: socket.id };
    board.strokes.push(record);
    socket.to(boardId).emit("draw:broadcast", { stroke: record });
  });

  socket.on("board:clear", ({ boardId }) => {
    const board = boardRooms[boardId];
    if (!board) return;

    board.strokes = [];
    io.to(boardId).emit("board:cleared", { clearedBy: socket.data.username || "Someone" });
  });

  socket.on("draw:undo", ({ boardId }) => {
    const board = boardRooms[boardId];
    if (!board || board.strokes.length === 0) return;

    const lastStrokeId = board.strokes[board.strokes.length - 1].strokeId;
    board.strokes = board.strokes.filter((stroke) => stroke.strokeId !== lastStrokeId);
    io.to(boardId).emit("board:sync", { strokes: board.strokes });
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    const board = boardRooms[boardId];
    if (!board) return;

    const user = board.users[socket.id];
    delete board.users[socket.id];

    if (user) {
      socket.to(boardId).emit("user:left", { userId: socket.id, username: user.username });
    }
    if (Object.keys(board.users).length === 0) {
      delete boardRooms[boardId];
    }
  });
}

module.exports = registerBoardHandlers;
