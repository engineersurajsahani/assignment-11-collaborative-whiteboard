// In-Memory Whiteboard Store
const boardRooms = {};

/**
 * Get or initialize room object
 * @param {string} boardId 
 */
function getOrCreateRoom(boardId) {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [], // Array of stroke objects
      users: {}    // Map of socketId -> { userId, username, color, cursor: { x, y } }
    };
  }
  return boardRooms[boardId];
}

module.exports = function registerBoardHandlers(io, socket) {
  // Join Collaborative Canvas Room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId) return;

    const roomId = String(boardId).trim();
    const name = username || `User_${socket.id.substring(0, 4)}`;
    const color = userColor || '#ff5722';

    // Store session info on socket
    socket.data.boardId = roomId;
    socket.data.username = name;
    socket.data.userColor = color;

    // Join Socket.io Room Partition
    socket.join(roomId);

    const room = getOrCreateRoom(roomId);

    // Register active user
    room.users[socket.id] = {
      userId: socket.id,
      username: name,
      color: color,
      cursor: { x: 0, y: 0 }
    };

    // 1. Send complete stroke history & active users to newly joined peer
    socket.emit('board:init', {
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    // 2. Notify other participants in the board room
    socket.to(roomId).emit('user:joined', {
      userId: socket.id,
      username: name,
      color: color
    });
  });

  // Handle Vector Stroke Drawing
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const roomId = boardId || socket.data.boardId;
    if (!roomId || !stroke) return;

    const room = getOrCreateRoom(roomId);

    // Append stroke segment to room history
    room.strokes.push(stroke);

    // Relay drawing stroke to all other participants in the room
    socket.to(roomId).emit('draw:broadcast', { stroke });
  });

  // Handle Canvas Clear Action
  socket.on('board:clear', ({ boardId }) => {
    const roomId = boardId || socket.data.boardId;
    if (!roomId) return;

    const room = getOrCreateRoom(roomId);
    room.strokes = [];

    const clearedBy = socket.data.username || 'Collaborator';

    // Notify all room peers to wipe their local canvas
    io.in(roomId).emit('board:cleared', { clearedBy });
  });

  // Handle Stroke Undo Action
  socket.on('draw:undo', ({ boardId }) => {
    const roomId = boardId || socket.data.boardId;
    if (!roomId) return;

    const room = getOrCreateRoom(roomId);
    if (room.strokes.length === 0) return;

    // Undo last continuous stroke
    // If strokes have strokeId, remove all segments matching the last strokeId
    const lastStroke = room.strokes[room.strokes.length - 1];
    if (lastStroke && lastStroke.strokeId) {
      const targetStrokeId = lastStroke.strokeId;
      while (
        room.strokes.length > 0 && 
        room.strokes[room.strokes.length - 1].strokeId === targetStrokeId
      ) {
        room.strokes.pop();
      }
    } else {
      // Fallback: pop single stroke object
      room.strokes.pop();
    }

    // Broadcast new state snapshot after undo to all peers in room
    io.in(roomId).emit('board:sync', { strokes: room.strokes });
  });

  // Handle Disconnect & User Left Event
  socket.on('disconnect', () => {
    const roomId = socket.data.boardId;
    if (roomId && boardRooms[roomId]) {
      const room = boardRooms[roomId];
      delete room.users[socket.id];

      // Broadcast user left event to remaining room peers
      socket.to(roomId).emit('user:left', {
        userId: socket.id,
        username: socket.data.username || 'Collaborator'
      });

      // Cleanup room memory if no active users
      if (Object.keys(room.users).length === 0) {
        delete boardRooms[roomId];
      }
    }
  });
};
