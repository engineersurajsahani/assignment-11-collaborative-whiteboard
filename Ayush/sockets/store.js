

const boardRooms = {};

function getOrCreateBoard(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {},
    };
  }
  return boardRooms[boardId];
}

function getActiveUsers(boardId) {
  const board = boardRooms[boardId];
  if (!board) return [];
  return Object.entries(board.users).map(([userId, u]) => ({
    userId,
    username: u.username,
    color: u.color,
  }));
}

function undoLastStroke(boardId) {
  const board = boardRooms[boardId];
  if (!board || board.strokes.length === 0) return board ? board.strokes : [];

  const lastStrokeId = board.strokes[board.strokes.length - 1].strokeId;
  board.strokes = board.strokes.filter((s) => s.strokeId !== lastStrokeId);
  return board.strokes;
}

module.exports = {
  boardRooms,
  getOrCreateBoard,
  getActiveUsers,
  undoLastStroke,
};
