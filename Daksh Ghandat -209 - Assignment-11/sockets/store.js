const Board = require("../models/Board");

const boardRooms = new Map();
const saveQueues = new Map();

const PERSIST_DELAY = 300;
const INACTIVE_ROOM_TTL = 30 * 60 * 1000;

const getOrCreateBoard = async (boardId) => {
  if (boardRooms.has(boardId)) return boardRooms.get(boardId);

  const board = {
    boardId,
    strokes: [],
    users: {},
    _lastActivity: Date.now(),
  };

  try {
    const persisted = await Board.findOne({ boardId });
    if (persisted && Array.isArray(persisted.strokes)) {
      board.strokes = persisted.strokes;
    }
  } catch (error) {
    console.error(`[store] Failed to load board "${boardId}" from MongoDB:`, error.message);
  }

  boardRooms.set(boardId, board);
  return board;
};

const persistBoard = (boardId) => {
  const board = boardRooms.get(boardId);
  if (!board) return;

  if (saveQueues.has(boardId)) clearTimeout(saveQueues.get(boardId));

  saveQueues.set(
    boardId,
    setTimeout(async () => {
      saveQueues.delete(boardId);
      await writeBoard(board);
    }, PERSIST_DELAY)
  );

  board._lastActivity = Date.now();
};

const flushPersistBoard = async (boardId) => {
  const board = boardRooms.get(boardId);
  if (!board) return;

  if (saveQueues.has(boardId)) {
    clearTimeout(saveQueues.get(boardId));
    saveQueues.delete(boardId);
  }
  await writeBoard(board);
};

const writeBoard = async (board) => {
  try {
    await Board.updateOne(
      { boardId: board.boardId },
      { $set: { strokes: board.strokes } },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[store] Failed to persist board "${board.boardId}":`, error.message);
  }
};

const touchBoard = (boardId) => {
  const board = boardRooms.get(boardId);
  if (board) board._lastActivity = Date.now();
};

const serializeStrokes = (board) =>
  board.strokes.map((path) => ({
    id: path.id,
    userId: path.userId,
    username: path.username,
    color: path.color,
    segments: path.segments,
  }));

const serializeUsers = (board) =>
  Object.entries(board.users).map(([userId, user]) => ({
    userId,
    username: user.username,
    color: user.color,
    cursor: user.cursor,
  }));

module.exports = {
  boardRooms,
  getOrCreateBoard,
  persistBoard,
  flushPersistBoard,
  touchBoard,
  serializeStrokes,
  serializeUsers,
  INACTIVE_ROOM_TTL,
};