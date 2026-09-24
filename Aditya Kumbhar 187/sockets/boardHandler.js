// Socket handler for board rooms, strokes, clear, undo and disconnect
module.exports = function (io, socket, boardRooms) {

  // Join a board room
  socket.on("board:join", (data) => {
    const { boardId, username, userColor } = data;
    if (!boardId) return;

    socket.join(boardId);
    socket.boardId = boardId;
    socket.username = username || "Anonymous";
    socket.userColor = userColor || "#3b82f6";

    // Initialize board state in memory if it doesn't exist
    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId: boardId,
        strokes: [],
        users: {}
      };
    }

    // Add user to room state
    boardRooms[boardId].users[socket.id] = {
      username: socket.username,
      color: socket.userColor,
      cursor: { x: 0, y: 0 }
    };

    // Send existing strokes and active users list to the new user
    const activeUsers = Object.keys(boardRooms[boardId].users).map((id) => ({
      userId: id,
      username: boardRooms[boardId].users[id].username,
      color: boardRooms[boardId].users[id].color
    }));

    socket.emit("board:init", {
      strokes: boardRooms[boardId].strokes,
      activeUsers: activeUsers
    });

    // Notify other users in the room
    socket.to(boardId).emit("user:joined", {
      userId: socket.id,
      username: socket.username,
      color: socket.userColor
    });
  });

  // Handle new drawing stroke
  socket.on("draw:stroke", (data) => {
    const { boardId, stroke } = data;
    if (!boardId || !stroke) return;

    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId: boardId,
        strokes: [],
        users: {}
      };
    }

    boardRooms[boardId].strokes.push(stroke);

    // Relay stroke to all other users in the room
    socket.to(boardId).emit("draw:broadcast", { stroke });
  });

  // Clear canvas
  socket.on("board:clear", (data) => {
    const { boardId } = data;
    if (!boardId || !boardRooms[boardId]) return;

    boardRooms[boardId].strokes = [];

    // Notify everyone in the room to clear their canvas
    io.to(boardId).emit("board:cleared", {
      clearedBy: socket.username || "User"
    });
  });

  // Undo last continuous stroke
  socket.on("draw:undo", (data) => {
    const { boardId } = data;
    if (!boardId || !boardRooms[boardId]) return;

    const room = boardRooms[boardId];
    if (room.strokes.length > 0) {
      const lastStroke = room.strokes[room.strokes.length - 1];
      if (lastStroke && lastStroke.strokeId) {
        const targetStrokeId = lastStroke.strokeId;
        room.strokes = room.strokes.filter((s) => s.strokeId !== targetStrokeId);
      } else {
        room.strokes.pop();
      }

      // Broadcast updated stroke snapshot
      io.to(boardId).emit("board:sync", {
        strokes: room.strokes
      });
    }
  });

  // Handle user disconnection
  socket.on("disconnect", () => {
    const boardId = socket.boardId;
    if (boardId && boardRooms[boardId] && boardRooms[boardId].users[socket.id]) {
      delete boardRooms[boardId].users[socket.id];

      // Notify others that user left
      socket.to(boardId).emit("user:left", {
        userId: socket.id,
        username: socket.username
      });
    }
  });
};
