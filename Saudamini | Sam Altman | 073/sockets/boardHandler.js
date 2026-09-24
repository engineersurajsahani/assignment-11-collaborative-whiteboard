// sockets/boardHandler.js

// In-Memory Whiteboard Store
// boardId -> { boardId, strokes: [], users: { socketId: { username, color, cursor } } }
const boardRooms = {};

const getOrCreateRoom = (boardId) => {
  if (!boardRooms[boardId]) {
    boardRooms[boardId] = {
      boardId,
      strokes: [],
      users: {}
    };
  }
  return boardRooms[boardId];
};

module.exports = (io, socket) => {
  // Join a collaborative whiteboard room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    const roomKey = boardId || 'MAIN_ROOM';
    socket.join(roomKey);
    socket.currentBoardId = roomKey;

    const room = getOrCreateRoom(roomKey);

    const userObj = {
      userId: socket.id,
      username: username || `User_${socket.id.slice(0, 4)}`,
      color: userColor || '#3b82f6',
      cursor: { x: 0, y: 0 }
    };

    room.users[socket.id] = userObj;

    // Send full stroke history and active users to the newly joined peer
    socket.emit('board:init', {
      boardId: roomKey,
      strokes: room.strokes,
      activeUsers: Object.values(room.users)
    });

    // Notify other participants in the board room
    socket.to(roomKey).emit('user:joined', userObj);
  });

  // Client draws a continuous stroke
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const roomKey = boardId || socket.currentBoardId;
    if (!roomKey) return;

    const room = getOrCreateRoom(roomKey);
    room.strokes.push(stroke);

    // Relay drawing stroke to all other participants in the room
    socket.to(roomKey).emit('draw:broadcast', { stroke });
  });

  // Undo the last stroke action
  socket.on('draw:undo', ({ boardId }) => {
    const roomKey = boardId || socket.currentBoardId;
    if (!roomKey) return;

    const room = getOrCreateRoom(roomKey);
    if (room.strokes.length > 0) {
      room.strokes.pop();
      // Broadcast new state snapshot after undo
      io.to(roomKey).emit('board:sync', { strokes: room.strokes });
    }
  });

  // Clear all strokes for this room
  socket.on('board:clear', ({ boardId }) => {
    const roomKey = boardId || socket.currentBoardId;
    if (!roomKey) return;

    const room = getOrCreateRoom(roomKey);
    room.strokes = [];

    const username = room.users[socket.id]?.username || 'A collaborator';
    io.to(roomKey).emit('board:cleared', { clearedBy: username });
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const roomKey = socket.currentBoardId;
    if (roomKey && boardRooms[roomKey]) {
      const room = boardRooms[roomKey];
      const departingUser = room.users[socket.id];
      delete room.users[socket.id];

      if (departingUser) {
        io.to(roomKey).emit('user:left', {
          userId: socket.id,
          username: departingUser.username
        });
      }
    }
  });
};
