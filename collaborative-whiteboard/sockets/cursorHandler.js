const { getOrCreateBoard } = require('./boardStore');

/**
 * Registers cursor-tracking events for a socket. Kept separate from
 * boardHandler.js since this is a much higher-frequency, lower-importance
 * event stream (no history buffering needed — only the live position matters).
 */
function registerCursorHandlers(io, socket, socketState) {
  /**
   * cursor:move — Client -> Server
   * { boardId, x, y }
   * Relays the position to everyone else in the room. Not persisted to the
   * stroke history buffer, but we do keep the latest position on the user's
   * in-memory record so a freshly-joined peer could show existing cursors
   * if the UI wants that later.
   */
  socket.on('cursor:move', ({ boardId, x, y }) => {
    if (!boardId || typeof x !== 'number' || typeof y !== 'number') return;

    const board = getOrCreateBoard(boardId);
    if (board.users[socket.id]) {
      board.users[socket.id].cursor = { x, y };
    }

    socket.to(boardId).emit('cursor:update', { userId: socket.id, x, y });
  });
}

module.exports = registerCursorHandlers;
