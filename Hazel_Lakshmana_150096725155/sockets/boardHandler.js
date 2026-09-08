function getOrCreateBoard(boardRooms, boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

function setupBoardHandlers(io, socket, boardRooms) {
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const board = getOrCreateBoard(boardRooms, boardId);

    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = username || "Anonymous";
    socket.data.userColor = userColor || "#2196f3";

    board.users[socket.id] = {
      username: socket.data.username,
      color: socket.data.userColor,
      cursor: { x: 0, y: 0 }
    };

    socket.emit("board:init", {
      strokes: board.strokes,
      activeUsers: Object.entries(board.users).map(([userId, user]) => ({
        userId,
        username: user.username,
        color: user.color,
        cursor: user.cursor
      }))
    });

    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username: socket.data.username,
      color: socket.data.userColor
    });
  });

  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;

    const board = boardRooms[boardId];
    if (!board || !board.users[socket.id]) return;

    board.strokes.push({
      ...stroke,
      userId: socket.id
    });

    socket.to(boardId).emit("draw:broadcast", { stroke });
  });

  socket.on("board:clear", ({ boardId }) => {
    const board = boardRooms[boardId];
    if (!board || !board.users[socket.id]) return;

    board.strokes = [];

    io.to(boardId).emit("board:cleared", {
      clearedBy: board.users[socket.id].username
    });
  });

  socket.on("draw:undo", ({ boardId }) => {
    const board = boardRooms[boardId];
    if (!board || !board.users[socket.id]) return;

    if (board.strokes.length > 0) {
      board.strokes.pop();
    }

    io.to(boardId).emit("board:sync", {
      strokes: board.strokes
    });
  });

  socket.on("disconnect", () => {
    const boardId = socket.data.boardId;
    if (!boardId || !boardRooms[boardId]) return;

    const board = boardRooms[boardId];
    const user = board.users[socket.id];

    if (user) {
      delete board.users[socket.id];

      socket.to(boardId).emit("user:left", {
        userId: socket.id,
        username: user.username
      });
    }

    if (Object.keys(board.users).length === 0) {
      delete boardRooms[boardId];
    }
  });
}

module.exports = { setupBoardHandlers };
