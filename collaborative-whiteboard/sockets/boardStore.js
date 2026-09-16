/**
 * In-memory store of all active whiteboard rooms.
 *
 * boardRooms = {
 *   "DESIGN_101": {
 *     boardId: "DESIGN_101",
 *     strokes: [ { userId, prevX, prevY, currX, currY, color, size, strokeGroupId }, ... ],
 *     users: { [socketId]: { username, color, cursor: { x, y } } }
 *   }
 * }
 *
 * Strokes are stored flat but each carries a `strokeGroupId` so that a full
 * pen-down-to-pen-up gesture (a "stroke") can be undone as a single unit
 * rather than one tiny line segment at a time.
 */
const boardRooms = {};

function getOrCreateBoard(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

function getActiveUsers(board) {
  return Object.entries(board.users).map(([socketId, user]) => ({
    userId: socketId,
    username: user.username,
    color: user.color
  }));
}

module.exports = { boardRooms, getOrCreateBoard, getActiveUsers };
