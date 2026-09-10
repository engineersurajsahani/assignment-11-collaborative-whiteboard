function getBoard(boardRooms, boardId) {
  if (!boardRooms.has(boardId)) boardRooms.set(boardId, { boardId, strokes: [], users: new Map() });
  return boardRooms.get(boardId);
}

module.exports = (io, socket, boardRooms) => {
  socket.on('board:join', ({ boardId, username, userColor }) => {
    boardId = String(boardId || 'demo').trim().slice(0, 50);
    username = String(username || 'Guest').trim().slice(0, 24) || 'Guest';
    userColor = /^#[0-9a-f]{6}$/i.test(userColor) ? userColor : '#b06ab3';
    const board = getBoard(boardRooms, boardId);
    socket.join(boardId);
    socket.data.boardId = boardId;
    socket.data.username = username;
    socket.data.color = userColor;
    board.users.set(socket.id, { username, color:userColor, cursor:{x:0,y:0} });
    socket.emit('board:init', { strokes: board.strokes, activeUsers: [...board.users.entries()].map(([userId,u]) => ({userId,...u})) });
    socket.to(boardId).emit('user:joined', { userId:socket.id, username, color:userColor });
  });

  socket.on('draw:stroke', ({ boardId, stroke }) => {
    const board = boardRooms.get(boardId);
    if (!board || !stroke) return;
    const safe = { prevX:+stroke.prevX, prevY:+stroke.prevY, currX:+stroke.currX, currY:+stroke.currY, color:stroke.color, size:Math.min(40, Math.max(1, +stroke.size || 3)), userId:socket.id };
    if (![safe.prevX,safe.prevY,safe.currX,safe.currY].every(Number.isFinite)) return;
    board.strokes.push(safe);
    socket.to(boardId).emit('draw:broadcast', { stroke:safe });
  });

  socket.on('board:clear', ({ boardId }) => {
    const board = boardRooms.get(boardId); if (!board) return;
    board.strokes = [];
    io.to(boardId).emit('board:cleared', { clearedBy:socket.data.username || 'Guest' });
  });

  socket.on('draw:undo', ({ boardId }) => {
    const board = boardRooms.get(boardId); if (!board || !board.strokes.length) return;
    // Undo the latest continuous action by the latest drawing user.
    const lastUser = board.strokes[board.strokes.length - 1].userId;
    while (board.strokes.length && board.strokes[board.strokes.length - 1].userId === lastUser) board.strokes.pop();
    io.to(boardId).emit('board:sync', { strokes:board.strokes });
  });

  socket.on('disconnect', () => {
    const boardId = socket.data.boardId; if (!boardId) return;
    const board = boardRooms.get(boardId); if (!board) return;
    board.users.delete(socket.id);
    socket.to(boardId).emit('user:left', { userId:socket.id, username:socket.data.username || 'Guest' });
    if (!board.users.size && !board.strokes.length) boardRooms.delete(boardId);
  });
};
