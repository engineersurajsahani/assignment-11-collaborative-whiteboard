/**
 * In-memory Whiteboard Store
 * ---------------------------------
 * boardRooms = {
 *   "<boardId>": {
 *     boardId: "DESIGN_101",
 *     strokes: [ { strokeId, prevX, prevY, currX, currY, color, size, userId }, ... ],
 *     strokeOrder: [ "strokeId1", "strokeId2", ... ],  // chronological order of distinct strokes (for undo)
 *     users: {
 *       "<socketId>": { username, color, cursor: { x, y } }
 *     }
 *   }
 * }
 *
 * NOTE: This is intentionally process-local memory (not a DB / Redis).
 * If you scale this server horizontally you'll need to move this into a
 * shared store (e.g. Redis) and use the socket.io-redis adapter.
 */

const boardRooms = {};

function getOrCreateBoard(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      strokeOrder: [],
      users: {},
    };
  }
  return boardRooms[boardId];
}

function getActiveUsersList(board) {
  return Object.entries(board.users).map(([userId, u]) => ({
    userId,
    username: u.username,
    color: u.color,
  }));
}

function removeUserFromAllBoards(socketId) {
  const affected = [];
  for (const boardId of Object.keys(boardRooms)) {
    const board = boardRooms[boardId];
    if (board.users[socketId]) {
      const { username } = board.users[socketId];
      delete board.users[socketId];
      affected.push({ boardId, username });

      // Clean up empty boards to avoid unbounded memory growth
      if (Object.keys(board.users).length === 0 && board.strokes.length === 0) {
        delete boardRooms[boardId];
      }
    }
  }
  return affected;
}

/**
 * Removes the last continuous stroke action (all segments sharing the
 * most-recently-created strokeId) from a board's history.
 * Returns true if something was removed.
 */
function undoLastStroke(board) {
  if (board.strokeOrder.length === 0) return false;
  const lastStrokeId = board.strokeOrder.pop();
  board.strokes = board.strokes.filter((s) => s.strokeId !== lastStrokeId);
  return true;
}

function clearBoard(board) {
  board.strokes = [];
  board.strokeOrder = [];
}

module.exports = {
  boardRooms,
  getOrCreateBoard,
  getActiveUsersList,
  removeUserFromAllBoards,
  undoLastStroke,
  clearBoard,
};
