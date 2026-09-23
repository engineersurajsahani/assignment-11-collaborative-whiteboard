const { boardRooms, touchBoard } = require("./store");

const setupCursorSocket = (io, socket) => {
  socket.on("cursor:move", (payload) => {
    const boardId = socket.data.boardId || (payload && payload.boardId);
    const board = boardRooms.get(boardId);
    if (!board || !payload || !["x", "y"].every((k) => Number.isFinite(Number(payload[k])))) {
      return;
    }

    const user = board.users[socket.id];
    if (!user) return;

    const cursor = {
      x: Math.round(Number(payload.x)),
      y: Math.round(Number(payload.y)),
    };
    user.cursor = cursor;
    touchBoard(boardId);

    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      x: cursor.x,
      y: cursor.y,
    });
  });
};

module.exports = { setupCursorSocket };