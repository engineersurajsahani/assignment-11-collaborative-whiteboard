module.exports = function (io, socket, boardRooms) {
  // Handle live cursor movement
  socket.on('cursor:move', (data) => {
    try {
      if (!data || !data.boardId || typeof data.x !== 'number' || typeof data.y !== 'number') {
        return;
      }

      const { boardId, x, y } = data;
      if (!boardRooms[boardId] || !boardRooms[boardId].users[socket.id]) {
        return;
      }

      // Update cursor coordinates in memory
      const user = boardRooms[boardId].users[socket.id];
      user.cursor = { x, y };

      // Broadcast cursor update to other users in room
      socket.to(boardId).emit('cursor:update', {
        userId: socket.id,
        username: socket.username || user.username,
        color: socket.userColor || user.color,
        x: x,
        y: y
      });
    } catch (err) {
      console.error('Error handling cursor:move:', err);
    }
  });
};
