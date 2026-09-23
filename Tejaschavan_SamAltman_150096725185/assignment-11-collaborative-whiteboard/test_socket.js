const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:5001';
const BOARD_ID = 'test-room-' + Date.now();

async function runIntegrationTest() {
  console.log('--- Starting Socket.io Whiteboard Integration Test ---');

  const client1 = io(SERVER_URL, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });
  const client2 = io(SERVER_URL, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });

  await new Promise((resolve) => client1.on('connect', resolve));
  await new Promise((resolve) => client2.on('connect', resolve));
  console.log('✅ Client 1 and Client 2 connected.');

  // Test 1: Join Room
  const joinPromise = new Promise((resolve) => {
    client2.once('user:joined', (data) => {
      console.log('✅ Client 2 received user:joined for:', data.username);
      assert.strictEqual(data.username, 'Alice');
      resolve();
    });
  });

  client2.emit('board:join', { boardId: BOARD_ID, username: 'Bob', userColor: '#10B981' });
  client1.emit('board:join', { boardId: BOARD_ID, username: 'Alice', userColor: '#3B82F6' });
  await joinPromise;

  // Test 2: Drawing stroke broadcast
  const strokeGroupId = 'grp-test-uuid-123';
  const strokeData = {
    prevX: 10,
    prevY: 10,
    currX: 20,
    currY: 20,
    color: '#3B82F6',
    size: 4,
    strokeGroupId
  };

  const drawPromise = new Promise((resolve) => {
    client2.once('draw:broadcast', ({ stroke }) => {
      console.log('✅ Client 2 received draw:broadcast:', stroke);
      assert.strictEqual(stroke.strokeGroupId, strokeGroupId);
      assert.strictEqual(stroke.currX, 20);
      assert.ok(stroke.timestamp > 0);
      resolve();
    });
  });

  client1.emit('draw:stroke', { boardId: BOARD_ID, stroke: strokeData });
  await drawPromise;

  // Test 3: Late joiner gets full stroke history via board:init
  const client3 = io(SERVER_URL, { reconnectionDelay: 0, forceNew: true, transports: ['websocket'] });
  await new Promise((resolve) => client3.on('connect', resolve));

  const initPromise = new Promise((resolve) => {
    client3.once('board:init', ({ strokes, activeUsers }) => {
      console.log('✅ Client 3 received board:init with strokes length:', strokes.length, 'and activeUsers:', activeUsers.length);
      assert.strictEqual(strokes.length, 1);
      assert.strictEqual(strokes[0].strokeGroupId, strokeGroupId);
      resolve();
    });
  });

  client3.emit('board:join', { boardId: BOARD_ID, username: 'Charlie', userColor: '#EF4444' });
  await initPromise;

  // Test 4: Cursor movement with throttling
  // Wait >50ms to ensure server throttle window is satisfied
  await new Promise((r) => setTimeout(r, 60));

  const cursorPromise = new Promise((resolve) => {
    client2.once('cursor:update', ({ userId, x, y }) => {
      console.log('✅ Client 2 received cursor:update:', { userId, x, y });
      assert.strictEqual(x, 150);
      assert.strictEqual(y, 250);
      resolve();
    });
  });

  client1.emit('cursor:move', { boardId: BOARD_ID, x: 150, y: 250 });
  await cursorPromise;

  // Test 5: Undo removes the whole continuous stroke group
  const undoPromise = new Promise((resolve) => {
    client2.once('board:sync', ({ strokes }) => {
      console.log('✅ Client 2 received board:sync after undo. Remaining strokes:', strokes.length);
      assert.strictEqual(strokes.length, 0);
      resolve();
    });
  });

  client1.emit('draw:undo', { boardId: BOARD_ID });
  await undoPromise;

  // Test 6: Clear board
  const clearPromise = new Promise((resolve) => {
    client2.once('board:cleared', ({ clearedBy }) => {
      console.log('✅ Client 2 received board:cleared by:', clearedBy);
      assert.strictEqual(clearedBy, 'Alice');
      resolve();
    });
  });

  client1.emit('board:clear', { boardId: BOARD_ID });
  await clearPromise;

  // Cleanup
  client1.disconnect();
  client2.disconnect();
  client3.disconnect();

  console.log('🎉 ALL 6 REAL-TIME PROTOCOL TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runIntegrationTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
