const { getOrCreateBoard, getActiveUsers } = require('./boardStore');

/**
 * Registers all board-lifecycle and drawing event listeners for a single
 * connected socket. `socketState` is a small shared object ({ boardId })
 * so cursorHandler.js can read which board this socket has joined without
 * duplicating join logic.
 */
function registerBoardHandlers(io, socket, socketState) {
  /**
   * board:join — Client -> Server
   * { boardId, username, userColor }
   */
  socket.on('board:join', ({ boardId, username, userColor }) => {
    if (!boardId || !username) {
      socket.emit('board:error', { message: 'boardId and username are required to join a board' });
      return;
    }

    const board = getOrCreateBoard(boardId);

    socket.join(boardId);
    socketState.boardId = boardId;

    board.users[socket.id] = {
      username,
      color: userColor || '#000000',
      cursor: { x: 0, y: 0 }
    };

    // Send the full current state to the newly joined peer only
    socket.emit('board:init', {
      strokes: board.strokes,
      activeUsers: getActiveUsers(board)
    });

    // Notify everyone else already in the room
    socket.to(boardId).emit('user:joined', {
      userId: socket.id,
      username,
      color: board.users[socket.id].color
    });
  });

  /**
   * draw:stroke — Client -> Server
   * { boardId, stroke: { prevX, prevY, currX, currY, color, size, strokeGroupId } }
   * Appends to the room's history buffer and relays to everyone else in the room.
   */
  socket.on('draw:stroke', ({ boardId, stroke }) => {
    if (!boardId || !stroke) return;
    const board = getOrCreateBoard(boardId);

    const storedStroke = {
      ...stroke,
      userId: socket.id,
      // Fall back to a per-request id if the client didn't group strokes,
      // so undo still has something sensible to remove.
      strokeGroupId: stroke.strokeGroupId || `${socket.id}_${Date.now()}`
    };

    board.strokes.push(storedStroke);

    socket.to(boardId).emit('draw:broadcast', { stroke: storedStroke });
  });

  /**
   * board:clear — Client -> Server
   * { boardId }
   * Wipes all strokes for the room and tells every peer (including the
   * requester) to clear their local canvas.
   */
  socket.on('board:clear', ({ boardId }) => {
    if (!boardId) return;
    const board = getOrCreateBoard(boardId);
    const clearedBy = board.users[socket.id]?.username || 'Someone';

    board.strokes = [];

    io.to(boardId).emit('board:cleared', { clearedBy });
  });

  /**
   * draw:undo — Client -> Server
   * { boardId }
   * Removes the last continuous stroke *group* (not just the last tiny
   * segment) so a single pen gesture disappears in one undo. Only the
   * requesting user's own most recent stroke group is removed, so undo
   * doesn't erase a collaborator's work.
   */
  socket.on('draw:undo', ({ boardId }) => {
    if (!boardId) return;
    const board = getOrCreateBoard(boardId);

    let lastGroupId = null;
    for (let i = board.strokes.length - 1; i >= 0; i--) {
      if (board.strokes[i].userId === socket.id) {
        lastGroupId = board.strokes[i].strokeGroupId;
        break;
      }
    }

    if (lastGroupId) {
      board.strokes = board.strokes.filter(
        (s) => !(s.userId === socket.id && s.strokeGroupId === lastGroupId)
      );
    }

    io.to(boardId).emit('board:sync', { strokes: board.strokes });
  });

  /**
   * Cleanup on disconnect: remove the user from their board's user map and
   * notify remaining peers.
   */
  socket.on('disconnect', () => {
    const boardId = socketState.boardId;
    if (!boardId) return;

    const board = getOrCreateBoard(boardId);
    const username = board.users[socket.id]?.username;

    delete board.users[socket.id];

    socket.to(boardId).emit('user:left', {
      userId: socket.id,
      username: username || 'A participant'
    });
  });
}

module.exports = registerBoardHandlers;
