/**
 * sockets/cursorHandler.js
 * Handles ultra-low-latency real-time cursor coordinate broadcasting.
 */

/**
 * Register cursor event listeners for a socket connection.
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {import('socket.io').Socket} socket - Connected client socket
 * @param {Object} boardRooms - In-memory store of board rooms
 */
function registerCursorHandlers(io, socket, boardRooms) {
  // High-frequency mouse pointer sync
  socket.on('cursor:move', (data) => {
    if (!data || !data.boardId) return;

    const { boardId, x, y } = data;
    const room = boardRooms[boardId];

    if (room && room.users[socket.id]) {
      // Update in-memory user cursor state without object re-allocation
      room.users[socket.id].cursor.x = x;
      room.users[socket.id].cursor.y = y;

      // Broadcast to all other peers in the room (exclude sender)
      socket.to(boardId).emit('cursor:update', {
        userId: socket.id,
        x,
        y
      });
    }
  });
}

module.exports = { registerCursorHandlers };
