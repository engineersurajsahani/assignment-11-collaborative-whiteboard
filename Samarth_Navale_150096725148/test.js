const app = require('./server');
const server = app.server;
const { io: ioClient } = require('socket.io-client');
const request = require('supertest');

const PORT = 5055;

const runTests = async () => {
  let passed = 0;
  let total = 0;

  const assert = (condition, name) => {
    total++;
    if (condition) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name}`);
    }
  };

  await new Promise((resolve) => server.listen(PORT, resolve));

  const clientUrl = `http://localhost:${PORT}`;

  try {
    const statusRes = await request(app).get('/api/status');
    assert(statusRes.status === 200 && statusRes.body.success, 'HTTP - API status endpoint');

    const socket1 = ioClient(clientUrl, { reconnection: false });
    const socket2 = ioClient(clientUrl, { reconnection: false });

    await new Promise((resolve) => socket1.on('connect', resolve));
    await new Promise((resolve) => socket2.on('connect', resolve));
    assert(socket1.connected && socket2.connected, 'Socket.io - Multi-client connection');

    const initPromise = new Promise((resolve) => {
      socket1.on('board:init', (data) => {
        resolve(data);
      });
    });

    socket1.emit('board:join', {
      boardId: 'TEST_ROOM_1',
      username: 'Alice',
      userColor: '#ff5722'
    });

    const initData = await initPromise;
    assert(Array.isArray(initData.strokes), 'Socket.io - board:join and board:init');

    const joinPromise2 = new Promise((resolve) => {
      socket1.on('user:joined', (data) => {
        resolve(data);
      });
    });

    socket2.emit('board:join', {
      boardId: 'TEST_ROOM_1',
      username: 'Bob',
      userColor: '#00bcd4'
    });

    const joinedData = await joinPromise2;
    assert(joinedData.username === 'Bob', 'Socket.io - user:joined event broadcast');

    const drawPromise = new Promise((resolve) => {
      socket2.on('draw:broadcast', (data) => {
        resolve(data);
      });
    });

    const testStroke = {
      prevX: 10,
      prevY: 10,
      currX: 20,
      currY: 20,
      color: '#ff5722',
      size: 3,
      strokeId: 'test_stroke_1'
    };

    socket1.emit('draw:stroke', {
      boardId: 'TEST_ROOM_1',
      stroke: testStroke
    });

    const broadcastedStroke = await drawPromise;
    assert(broadcastedStroke.stroke.currX === 20, 'Socket.io - draw:stroke and draw:broadcast');

    const cursorPromise = new Promise((resolve) => {
      socket2.on('cursor:update', (data) => {
        resolve(data);
      });
    });

    socket1.emit('cursor:move', {
      boardId: 'TEST_ROOM_1',
      x: 150,
      y: 200
    });

    const cursorData = await cursorPromise;
    assert(cursorData.x === 150 && cursorData.y === 200, 'Socket.io - cursor:move and cursor:update');

    const clearPromise = new Promise((resolve) => {
      socket2.on('board:cleared', (data) => {
        resolve(data);
      });
    });

    socket1.emit('board:clear', { boardId: 'TEST_ROOM_1' });
    const clearedData = await clearPromise;
    assert(clearedData.clearedBy === 'Alice', 'Socket.io - board:clear and board:cleared');

    const undoPromise = new Promise((resolve) => {
      socket2.on('board:sync', (data) => {
        resolve(data);
      });
    });

    socket1.emit('draw:undo', { boardId: 'TEST_ROOM_1' });
    const undoData = await undoPromise;
    assert(Array.isArray(undoData.strokes), 'Socket.io - draw:undo and board:sync');

    socket1.disconnect();
    socket2.disconnect();
    server.close();

    console.log(`\nTests completed: ${passed}/${total} passed`);
    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
};

runTests();
