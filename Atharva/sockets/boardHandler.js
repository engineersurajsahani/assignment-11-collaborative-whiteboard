const {
  getOrCreateBoard,
  getActiveUsersList,
  undoLastStroke,
  clearBoard,
} = require("./store");

/**
 * Registers all board / drawing related event listeners for a single socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerBoardHandlers(io, socket) {
  // Track which board this socket currently belongs to, for cleanup on disconnect.
  socket.data.boardId = null;

  // ---- board:join ------------------------------------------------------
  socket.on("board:join", ({ boardId, username, userColor }) => {
    if (!boardId || typeof boardId !== "string") return;

    const safeUsername = (username || "Guest").toString().slice(0, 40);
    const safeColor = (userColor || "#000000").toString().slice(0, 20);

    // Leave any previously joined board first (defensive, e.g. board switch).
    if (socket.data.boardId && socket.data.boardId !== boardId) {
      const prevBoard = getOrCreateBoard(socket.data.boardId);
      delete prevBoard.users[socket.id];
      socket.leave(socket.data.boardId);
      socket.to(socket.data.boardId).emit("user:left", {
        userId: socket.id,
        username: prevBoard.users[socket.id]?.username,
      });
    }

    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = safeUsername;
    socket.data.color = safeColor;

    const board = getOrCreateBoard(boardId);
    board.users[socket.id] = {
      username: safeUsername,
      color: safeColor,
      cursor: { x: 0, y: 0 },
    };

    // 1) Send full current state to the newly joined peer only.
    socket.emit("board:init", {
      strokes: board.strokes,
      activeUsers: getActiveUsersList(board),
    });

    // 2) Notify everyone else already in the room.
    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username: safeUsername,
      color: safeColor,
    });
  });

  // ---- draw:stroke -------------------------------------------------------
  socket.on("draw:stroke", ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    const board = getOrCreateBoard(boardId);

    const enrichedStroke = {
      strokeId: stroke.strokeId,
      prevX: stroke.prevX,
      prevY: stroke.prevY,
      currX: stroke.currX,
      currY: stroke.currY,
      color: stroke.color || "#000000",
      size: stroke.size || 3,
      userId: socket.id,
    };

    // Append to in-memory history buffer.
    board.strokes.push(enrichedStroke);

    // Track distinct stroke actions in chronological order (for undo).
    if (
      enrichedStroke.strokeId &&
      board.strokeOrder[board.strokeOrder.length - 1] !== enrichedStroke.strokeId
    ) {
      board.strokeOrder.push(enrichedStroke.strokeId);
    }

    // Relay to every other participant in the room (not back to sender).
    socket.to(boardId).emit("draw:broadcast", { stroke: enrichedStroke });
  });

  // ---- board:clear ---------------------------------------------------
  socket.on("board:clear", ({ boardId }) => {
    if (!boardId) return;
    const board = getOrCreateBoard(boardId);
    clearBoard(board);

    io.to(boardId).emit("board:cleared", {
      clearedBy: socket.data.username || "Someone",
    });
  });

  // ---- draw:undo -------------------------------------------------------
  socket.on("draw:undo", ({ boardId }) => {
    if (!boardId) return;
    const board = getOrCreateBoard(boardId);
    const didUndo = undoLastStroke(board);

    if (didUndo) {
      io.to(boardId).emit("board:sync", { strokes: board.strokes });
    }
  });
}

module.exports = { registerBoardHandlers };
