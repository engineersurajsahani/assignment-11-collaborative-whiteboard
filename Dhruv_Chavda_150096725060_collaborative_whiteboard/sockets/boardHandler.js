// In-Memory Whiteboard Store
// Structure:
// {
//   [boardId]: {
//     boardId: string,
//     strokes: Array<{ prevX, prevY, currX, currY, color, size, isEraser, actionId }>,
//     users: { [socketId]: { userId, username, color, cursor: { x, y } } }
//   }
// }
const boardRooms = {};

function getOrCreateRoom(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
}

module.exports = function registerBoardHandlers(io, socket) {
  // 1. Join Whiteboard Room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const safeBoardId = boardId.trim();
    const safeUsername = username ? username.trim() : `User_${socket.id.substring(0, 4)}`;
    const safeColor = userColor || '#3B82F6';

    socket.join(safeBoardId);
    socket.currentBoardId = safeBoardId;
    socket.username = safeUsername;
    socket.userColor = safeColor;

    const room = getOrCreateRoom(safeBoardId);
    room.users[socket.id] = {
      userId: socket.id,
      username: safeUsername,
      color: safeColor,
      cursor: { x: 0, y: 0 }
    };

    // Emit initial stroke history and active participant roster to the newly joined peer
    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    // Notify other room participants
    socket.to(safeBoardId).emit('user:joined', {
      userId: socket.id,
      username: safeUsername,
      color: safeColor
    });

    console.log(`👤 User '${safeUsername}' (${socket.id}) joined board '${safeBoardId}'`);
  });

  // 2. Continuous Stroke Streaming
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    const room = getOrCreateRoom(boardId);

    // Append to server room history buffer
    room.strokes.push(stroke);

    // Broadcast stroke to all other participants in the room
    socket.to(boardId).emit('draw:broadcast', { stroke });
  });

  // 3. Clear Entire Canvas
  socket.on('board:clear', ({ boardId }) => {
    if (!boardId) return;
    const room = getOrCreateRoom(boardId);
    room.strokes = [];

    // Notify all room peers (including sender) to clear local canvas
    io.to(boardId).emit('board:cleared', {
      clearedBy: socket.username || 'Collaborator'
    });

    console.log(`🧹 Board '${boardId}' was cleared by '${socket.username}'`);
  });

  // 4. Undo Last Action
  socket.on('draw:undo', ({ boardId }) => {
    if (!boardId) return;
    const room = getOrCreateRoom(boardId);

    if (room.strokes.length > 0) {
      // If strokes have an actionId, remove all strokes belonging to the last actionId
      const lastStroke = room.strokes[room.strokes.length - 1];
      if (lastStroke.actionId) {
        const lastActionId = lastStroke.actionId;
        room.strokes = room.strokes.filter(s => s.actionId !== lastActionId);
      } else {
        room.strokes.pop();
      }

      // Broadcast full state snapshot to synchronize all clients
      io.to(boardId).emit('board:sync', {
        strokes: room.strokes
      });
    }
  });

  // 5. User Disconnection
  socket.on('disconnect', () => {
    const boardId = socket.currentBoardId;
    if (boardId && boardRooms[boardId]) {
      const room = boardRooms[boardId];
      const departingUser = room.users[socket.id];
      delete room.users[socket.id];

      // Clean up empty room if no users remain
      if (Object.keys(room.users).length === 0) {
        // keep strokes for a while or retain in memory
      }

      socket.to(boardId).emit('user:left', {
        userId: socket.id,
        username: departingUser ? departingUser.username : socket.username
      });

      console.log(`👋 User '${socket.username}' left board '${boardId}'`);
    }
  });
};
