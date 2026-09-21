function handleCursorMove(io, socket, boardRooms) {
  return (data) => {
    const { boardId, x, y } = data;
    
    const room = boardRooms.get(boardId);
    if (!room) return;

    const user = room.users.get(socket.id);
    if (!user) return;

    user.cursor = { x, y };

    socket.to(boardId).emit('cursor:update', {
      userId: socket.id,
      username: user.username,
      color: user.color,
      x,
      y
    });
  };
}

module.exports = {
  handleCursorMove
};
