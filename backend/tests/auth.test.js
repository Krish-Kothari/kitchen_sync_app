const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../src/server');
const {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  sanitizeKitchen,
} = require('../src/utils/auth');
const { isValidCoordinate, haversineMeters, getHubRoomKey } = require('../src/utils/geo');

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('Auth & Geo Utility Unit Tests', () => {
  it('hashes passwords securely and verifies matching/mismatching inputs', async () => {
    const hash = await hashPassword('Kitchen@123');
    assert.notEqual(hash, 'Kitchen@123');
    assert.equal(await comparePassword('Kitchen@123', hash), true);
    assert.equal(await comparePassword('WrongPassword', hash), false);
  });

  it('signs and verifies JWT payloads and rejects tampered tokens', () => {
    const token = signToken({
      id: 'kitchen-uuid-1',
      email: 'chef@cloudpool.dev',
      role: 'KITCHEN_OWNER',
    });

    const decoded = verifyToken(token);
    assert.equal(decoded.sub, 'kitchen-uuid-1');
    assert.equal(decoded.role, 'KITCHEN_OWNER');

    assert.throws(() => verifyToken(`${token}tampered`), /invalid signature/i);
  });

  it('strips passwordHash when sanitizing kitchen profiles', () => {
    const clean = sanitizeKitchen({
      id: 'k-1',
      name: 'SpiceRoute',
      passwordHash: 'secret_hash',
    });
    assert.equal(clean.name, 'SpiceRoute');
    assert.equal('passwordHash' in clean, false);
  });

  it('validates WGS-84 coordinates and computes Haversine distances accurately', () => {
    assert.equal(isValidCoordinate(18.5074, 73.8077), true);
    assert.equal(isValidCoordinate(95.1, 73.8077), false);
    assert.equal(isValidCoordinate(18.5, -181), false);
    assert.equal(isValidCoordinate(NaN, 73.8), false);

    // Kothrud to Karve Nagar (~1.55 km)
    const dist = haversineMeters(18.5074, 73.8077, 18.4962, 73.8165);
    assert.ok(dist > 1300 && dist < 1800, `Expected ~1550m, got ${dist}m`);

    const roomKey = getHubRoomKey(18.5074, 73.8077);
    assert.match(roomKey, /^hub_\d+_\d+$/);
  });
});

describe('Auth & Kitchen HTTP Validation Edge Cases', () => {
  it('GET /api/health returns 200 ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });

  it('POST /api/auth/register rejects invalid email format with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Kitchen',
        ownerName: 'Test Owner',
        email: 'not-an-email',
        phone: '+919800000000',
        password: 'Password123',
        address: 'Paud Road',
        locality: 'Kothrud',
        latitude: 18.5074,
        longitude: 73.8077,
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /invalid email/i);
  });

  it('POST /api/auth/register rejects out-of-range coordinates with 400', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Kitchen',
        ownerName: 'Test Owner',
        email: 'valid@cloudpool.dev',
        phone: '+919800000000',
        password: 'Password123',
        address: 'Paud Road',
        locality: 'Kothrud',
        latitude: 120.5,
        longitude: 73.8077,
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /latitude and longitude/i);
  });

  it('GET /api/kitchens/me blocks unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/kitchens/me`);
    assert.equal(res.status, 401);
  });

  it('PATCH /api/kitchens/me/location rejects malformed coordinates with 400', async () => {
    const token = signToken({
      id: 'kitchen-test-id',
      email: 'chef@cloudpool.dev',
      role: 'KITCHEN_OWNER',
    });

    const res = await fetch(`${baseUrl}/api/kitchens/me/location`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ latitude: 999, longitude: 73.8 }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /latitude and longitude/i);
  });
});
