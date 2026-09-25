/**
 * boardHandler.js
 * Manages board rooms, stroke history, undo, clear, and user lifecycle events.
 */

// In-memory store: boardId -> { boardId, strokes: [], users: {} }
const boardRooms = {};

function registerBoardHandlers(io, socket) {
  // 1. Join a whiteboard room
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId || typeof boardId !== 'string') return;
    const sanitizedBoardId = boardId.trim();
    if (!sanitizedBoardId) return;

    const cleanUsername = (username && typeof username === 'string') ? username.trim() : 'Anonymous';
    const cleanColor = (userColor && typeof userColor === 'string') ? userColor : '#6366f1';

    // Initialize room if it doesn't exist
    if (!boardRooms[sanitizedBoardId]) {
      boardRooms[sanitizedBoardId] = {
        boardId: sanitizedBoardId,
        strokes: [],
        users: {}
      };
    }

    // Leave any previous board room before joining new one
    if (socket.boardId && socket.boardId !== sanitizedBoardId) {
      handleUserLeave(io, socket);
    }

    socket.join(sanitizedBoardId);
    socket.boardId = sanitizedBoardId;
    socket.username = cleanUsername;
    socket.userColor = cleanColor;

    // Track user in room state
    boardRooms[sanitizedBoardId].users[socket.id] = {
      username: cleanUsername,
      color: cleanColor,
      cursor: { x: -100, y: -100 }
    };

    // Prepare active users list
    const activeUsers = Object.entries(boardRooms[sanitizedBoardId].users).map(([userId, u]) => ({
      userId,
      username: u.username,
      color: u.color
    }));

    // Send full current room state only to the joining socket
    socket.emit('board:init', {
      strokes: boardRooms[sanitizedBoardId].strokes,
      activeUsers
    });

    // Notify all other members in the room
    socket.to(sanitizedBoardId).emit('user:joined', {
      userId: socket.id,
      username: cleanUsername,
      color: cleanColor
    });
  });

  // 2. Stroke drawn by client
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    if (!boardId || !stroke || !boardRooms[boardId]) return;

    const strokeData = {
      strokeId: stroke.strokeId || `${socket.id}-${Date.now()}`,
      userId: socket.id,
      prevX: stroke.prevX,
      prevY: stroke.prevY,
      currX: stroke.currX,
      currY: stroke.currY,
      color: stroke.color || '#000000',
      size: Number(stroke.size) || 3,
      mode: stroke.mode || 'brush'
    };

    // Store stroke in room buffer
    boardRooms[boardId].strokes.push(strokeData);

    // Relay to all other participants in the room
    socket.to(boardId).emit('draw:broadcast', {
      stroke: strokeData
    });
  });

  // 3. Clear canvas
  socket.on('board:clear', ({ boardId }) => {
    if (!boardId || !boardRooms[boardId]) return;

    boardRooms[boardId].strokes = [];

    // Notify all participants in the room (including sender) to clear
    io.to(boardId).emit('board:cleared', {
      clearedBy: socket.username || 'Collaborator'
    });
  });

  // 4. Undo last continuous stroke
  socket.on('draw:undo', ({ boardId }) => {
    if (!boardId || !boardRooms[boardId]) return;
    const room = boardRooms[boardId];

    if (room.strokes.length === 0) return;

    // Find the strokeId of the last segment
    const lastStroke = room.strokes[room.strokes.length - 1];
    const targetStrokeId = lastStroke.strokeId;

    if (targetStrokeId) {
      // Remove all segments belonging to this continuous stroke action
      room.strokes = room.strokes.filter(s => s.strokeId !== targetStrokeId);
    } else {
      // Fallback: pop last segment
      room.strokes.pop();
    }

    // Broadcast full snapshot to all room peers
    io.to(boardId).emit('board:sync', {
      strokes: room.strokes
    });
  });

  // 5. Handle disconnect
  socket.on('disconnect', () => {
    handleUserLeave(io, socket);
  });
}

function handleUserLeave(io, socket) {
  const boardId = socket.boardId;
  if (!boardId || !boardRooms[boardId]) return;

  const room = boardRooms[boardId];
  const leavingUser = room.users[socket.id];

  if (leavingUser) {
    delete room.users[socket.id];

    // Notify remaining peers
    socket.to(boardId).emit('user:left', {
      userId: socket.id,
      username: leavingUser.username
    });
  }

  // Clean up socket state
  socket.leave(boardId);
  socket.boardId = null;
}

module.exports = {
  boardRooms,
  registerBoardHandlers
};
