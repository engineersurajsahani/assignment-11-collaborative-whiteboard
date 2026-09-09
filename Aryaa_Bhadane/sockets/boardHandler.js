/**
 * sockets/boardHandler.js
 * Handles room lifecycle, stroke streaming, canvas state synchronization,
 * undo state rollbacks, and canvas clearing.
 */

/**
 * Register board and drawing event listeners for a socket connection.
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @param {import('socket.io').Socket} socket - Connected client socket
 * @param {Object} boardRooms - In-memory store of board rooms
 */
function registerBoardHandlers(io, socket, boardRooms) {
  // Join a collaborative canvas room
  socket.on('board:join', (payload) => {
    if (!payload || !payload.boardId) return;

    const boardId = String(payload.boardId).trim();
    const username = (payload.username && String(payload.username).trim()) || `User_${socket.id.slice(0, 4)}`;
    const userColor = payload.userColor || '#3b82f6';

    // Store room details on socket session for rapid reference
    socket.data.boardId = boardId;
    socket.data.username = username;
    socket.data.userColor = userColor;

    // Join Socket.io room channel
    socket.join(boardId);

    // Initialize in-memory room store if not already present
    if (!boardRooms[boardId]) {
      boardRooms[boardId] = {
        boardId,
        strokes: [], // Array of stroke objects
        users: {}    // Map of socketId -> { username, color, cursor: { x, y } }
      };
    }

    // Register active user in room store
    boardRooms[boardId].users[socket.id] = {
      username,
      color: userColor,
      cursor: { x: 0, y: 0 }
    };

    // Format activeUsers list for the newcomer
    const activeUsers = Object.entries(boardRooms[boardId].users).map(([userId, u]) => ({
      userId,
      username: u.username,
      color: u.color,
      cursor: u.cursor
    }));

    // Emit initial board state & active user list to the joining peer ONLY
    socket.emit('board:init', {
      strokes: boardRooms[boardId].strokes,
      activeUsers
    });

    // Broadcast new user arrival to existing peers in the room
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: userColor
    });

    console.log(`[board:join] User "${username}" (${socket.id}) joined board "${boardId}". Active in room: ${Object.keys(boardRooms[boardId].users).length}`);
  });

  // Client draws a stroke segment; append to history and broadcast to peers
  socket.on('draw:stroke', (data) => {
    if (!data || !data.boardId || !data.stroke) return;

    const { boardId, stroke } = data;
    const room = boardRooms[boardId];

    if (room) {
      // Append stroke segment to in-memory history buffer
      room.strokes.push(stroke);

      // Relay drawing stroke to all other participants in the room
      socket.to(boardId).emit('draw:broadcast', { stroke });
    }
  });

  // Clear all strokes for the room
  socket.on('board:clear', (data) => {
    if (!data || !data.boardId) return;

    const { boardId } = data;
    const room = boardRooms[boardId];

    if (room) {
      // Wipe the stroke history buffer
      room.strokes = [];

      const clearedBy = room.users[socket.id]?.username || socket.data.username || 'A collaborator';

      // Notify all room peers (including sender) to wipe their local canvas
      io.to(boardId).emit('board:cleared', { clearedBy });

      console.log(`[board:clear] Board "${boardId}" cleared by "${clearedBy}".`);
    }
  });

  // Rollback last continuous stroke action and sync full state
  socket.on('draw:undo', (data) => {
    if (!data || !data.boardId) return;

    const { boardId } = data;
    const room = boardRooms[boardId];

    if (room && room.strokes.length > 0) {
      const lastStroke = room.strokes[room.strokes.length - 1];

      // If stroke is tagged with a continuous actionId, remove all segments of that action
      if (lastStroke && lastStroke.actionId) {
        const targetActionId = lastStroke.actionId;
        room.strokes = room.strokes.filter((s) => s.actionId !== targetActionId);
      } else {
        // Fallback: pop single stroke element
        room.strokes.pop();
      }

      // Broadcast authoritative state snapshot to all room participants
      io.to(boardId).emit('board:sync', {
        strokes: room.strokes
      });

      console.log(`[draw:undo] Undo performed on board "${boardId}". Remaining segments: ${room.strokes.length}`);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const boardId = socket.data.boardId;
    const username = socket.data.username || 'Anonymous';

    if (boardId && boardRooms[boardId]) {
      // Remove from room's active user map
      delete boardRooms[boardId].users[socket.id];

      // Broadcast user departure to other peers
      socket.to(boardId).emit('user:left', {
        userId: socket.id,
        username
      });

      console.log(`[disconnect] User "${username}" (${socket.id}) disconnected from board "${boardId}". Remaining in room: ${Object.keys(boardRooms[boardId].users).length}`);
      // Note: Stroke history buffer is preserved in boardRooms[boardId]
      // so future or reconnecting peers can resume seamlessly.
    }
  });
}

module.exports = { registerBoardHandlers };
