// Socket handler for collaborator cursor movement
module.exports = function (io, socket, boardRooms) {

  // Handle live cursor position
  socket.on("cursor:move", (data) => {
    const { boardId, x, y } = data;
    if (!boardId) return;

    // Update in-memory cursor position
    if (boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
      boardRooms[boardId].users[socket.id].cursor = { x, y };
    }

    // Broadcast cursor position to other users in the same room
    socket.to(boardId).emit("cursor:update", {
      userId: socket.id,
      username: socket.username || "User",
      color: socket.userColor || "#3b82f6",
      x: x,
      y: y
    });
  });
};
