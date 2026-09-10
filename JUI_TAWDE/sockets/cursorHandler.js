module.exports = (io, socket, boardRooms) => {
  socket.on('cursor:move', ({ boardId, x, y }) => {
    const board = boardRooms.get(boardId); if (!board) return;
    const user = board.users.get(socket.id); if (!user) return;
    user.cursor = { x:+x || 0, y:+y || 0 };
    socket.to(boardId).emit('cursor:update', { userId:socket.id, x:user.cursor.x, y:user.cursor.y, color:user.color, username:user.username });
  });
};
