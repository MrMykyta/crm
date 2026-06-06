'use strict';

// API-level smoke for D2 (RW/PW adjustments).
// Uses REAL HTTP endpoints and auth flow.
//
// Run:
//   docker compose exec backend node scripts/smokeAdjustmentsRwPwApi.js

const http = require('http');
const { once } = require('events');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');
const {
  sequelize,
  User,
} = require('../src/models');

function parseBody(raw, contentType) {
  if (!raw) return null;
  if (String(contentType || '').includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return raw;
    }
  }
  return raw;
}

async function request(baseUrl, { method = 'GET', path, token, body }) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const options = { method, headers };
  if (typeof body !== 'undefined') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const raw = await response.text();
  const payload = parseBody(raw, response.headers.get('content-type'));

  return { status: response.status, payload, method, path };
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  // eslint-disable-next-line no-console
  console.log(`PASS ${message}`);
}

function getErrorMessage(payload) {
  if (!payload) return 'empty payload';
  if (typeof payload === 'string') return payload;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error === 'string') return payload.error;
  return JSON.stringify(payload);
}

function expectStatus(response, expectedStatus) {
  ensure(
    response.status === expectedStatus,
    `${response.method} ${response.path}: expected ${expectedStatus}, got ${response.status}. ` +
      `Payload: ${getErrorMessage(response.payload)}`
  );
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function findBalanceRow(balanceRows, { warehouseId, productId, variantId = null }) {
  return (balanceRows || []).find((row) => {
    const rowVariant = row?.variantId || null;
    return row?.warehouseId === warehouseId
      && row?.productId === productId
      && rowVariant === variantId;
  });
}

async function run() {
  await sequelize.authenticate();

  const smokeId = Date.now();
  const prefix = `smoke-rwpw-api-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${prefix}@example.com`;
  const password = 'Smoke123!RwPw';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'RwPwApi',
    isActive: true,
    emailVerifiedAt: new Date(),
    createdBy: null,
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const testedEndpoints = [];
  const rememberEndpoint = (method, path) => testedEndpoints.push(`${method} ${path}`);

  try {
    const loginRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password },
    });
    rememberEndpoint('POST', '/api/auth/login');
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'Login token missing');
    logPass('Auth/login acquired token');

    const createCompanyRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/companies',
      token: loginToken,
      body: { name: `Smoke RW/PW Company ${prefix}` },
    });
    rememberEndpoint('POST', '/api/companies');
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    const companyId = createCompanyRes.payload?.activeCompanyId;
    ensure(companyToken && companyId, 'Company token/companyId missing after company create');
    logPass('Company created with scoped token');

    // G1.3 test-only setup: this smoke exercises RW (outgoing FIFO consumption), which is gated
    // by costingInitializedAt. Real customers go through the opening-balance flow; the API smoke
    // skips it by setting the flag directly. The model is the only way to write it (no API).
    {
      const { CompanyWarehouseDocumentSetting } = require('../src/models');
      const [settingsRow] = await CompanyWarehouseDocumentSetting.findOrCreate({
        where: { companyId },
        defaults: { companyId },
      });
      await settingsRow.update({ costingInitializedAt: new Date() });
    }

    const warehouseRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/warehouses',
      token: companyToken,
      body: {
        code: `RWPW-${smokeId}`.slice(0, 32),
        name: `RW/PW Warehouse ${prefix}`.slice(0, 120),
        isActive: true,
      },
    });
    rememberEndpoint('POST', '/api/warehouses');
    expectStatus(warehouseRes, 201);
    const warehouseId = warehouseRes.payload?.id;
    ensure(warehouseId, 'warehouseId missing');
    logPass('Warehouse created');

    const locationRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/locations',
      token: companyToken,
      body: {
        warehouseId,
        code: `A1-${smokeId}`.slice(0, 32),
        type: 'bulk',
      },
    });
    rememberEndpoint('POST', '/api/locations');
    expectStatus(locationRes, 201);
    const locationId = locationRes.payload?.id;
    ensure(locationId, 'locationId missing');
    logPass('Location created');

    const productRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/products',
      token: companyToken,
      body: {
        name: `RW/PW Product ${prefix}`.slice(0, 200),
        slug: `rwpw-${smokeId}-${crypto.randomUUID().slice(0, 6)}`,
        sku: `RWPW-${smokeId}`.slice(0, 64),
        status: 'active',
      },
    });
    rememberEndpoint('POST', '/api/products');
    expectStatus(productRes, 201);
    const productId = productRes.payload?.data?.id || productRes.payload?.id;
    ensure(productId, 'productId missing');
    logPass('Product created');

    const createPwRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token: companyToken,
      body: {
        warehouseId,
        documentType: 'PW',
        reason: `PW +10 ${prefix}`,
        items: [
          {
            productId,
            variantId: null,
            locationId,
            lotId: null,
            qtyDelta: 10,
            unitCost: 20,
            currency: 'PLN',
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/wms/adjustments');
    expectStatus(createPwRes, 201);
    const pwId = createPwRes.payload?.id;
    ensure(pwId, 'PW adjustment id missing');
    ensure(String(createPwRes.payload?.status) === 'draft', `Expected PW status=draft, got ${createPwRes.payload?.status}`);
    logPass('PW draft created');

    const postPwRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${pwId}/post`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/wms/adjustments/:id/post');
    expectStatus(postPwRes, 200);
    ensure(String(postPwRes.payload?.status) === 'posted', `Expected PW posted, got ${postPwRes.payload?.status}`);
    logPass('PW posted');

    const balancesAfterPwRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesAfterPwRes, 200);
    const balanceAfterPw = findBalanceRow(balancesAfterPwRes.payload?.data, {
      warehouseId,
      productId,
      variantId: null,
    });
    ensure(balanceAfterPw, 'Balance row after PW not found');
    ensure(round4(asNumber(balanceAfterPw.onHand)) === 10, `Expected onHand=10 after PW, got ${balanceAfterPw.onHand}`);
    logPass('onHand +10 after PW');

    const pwMovesRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/adjustments/${pwId}/stock-moves?limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments/:id/stock-moves');
    expectStatus(pwMovesRes, 200);
    const pwMoves = pwMovesRes.payload?.data || [];
    ensure(pwMoves.length === 1, `Expected 1 PW stock_move, got ${pwMoves.length}`);
    ensure(pwMoves[0]?.type === 'adjustment', `Expected type=adjustment, got ${pwMoves[0]?.type}`);
    ensure(pwMoves[0]?.refType === 'PW', `Expected refType=PW, got ${pwMoves[0]?.refType}`);
    ensure(Boolean(pwMoves[0]?.refItemId), 'Expected refItemId to be filled for PW');
    logPass('PW stock_move has type/refType/refItemId');

    const repeatPostPwRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${pwId}/post`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/wms/adjustments/:id/post (repeat)');
    expectStatus(repeatPostPwRes, 200);

    const balancesAfterPwRepeatRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/inventory/stock-balances (repeat)');
    expectStatus(balancesAfterPwRepeatRes, 200);
    const balanceAfterPwRepeat = findBalanceRow(balancesAfterPwRepeatRes.payload?.data, {
      warehouseId,
      productId,
      variantId: null,
    });
    ensure(balanceAfterPwRepeat, 'Balance row after repeat PW post not found');
    ensure(round4(asNumber(balanceAfterPwRepeat.onHand)) === 10, `Expected onHand=10 after repeat post, got ${balanceAfterPwRepeat.onHand}`);

    const pwMovesAfterRepeatRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/adjustments/${pwId}/stock-moves?limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments/:id/stock-moves (repeat)');
    expectStatus(pwMovesAfterRepeatRes, 200);
    const pwMovesAfterRepeat = pwMovesAfterRepeatRes.payload?.data || [];
    ensure(pwMovesAfterRepeat.length === 1, `Expected no duplicate PW stock_moves, got ${pwMovesAfterRepeat.length}`);
    logPass('Repeat PW post is idempotent for onHand and stock_moves');

    const createRwRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token: companyToken,
      body: {
        warehouseId,
        documentType: 'RW',
        reason: `RW -3 ${prefix}`,
        items: [
          {
            productId,
            variantId: null,
            locationId,
            lotId: null,
            qtyDelta: -3,
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/wms/adjustments');
    expectStatus(createRwRes, 201);
    const rwId = createRwRes.payload?.id;
    ensure(rwId, 'RW adjustment id missing');
    ensure(String(createRwRes.payload?.status) === 'draft', `Expected RW status=draft, got ${createRwRes.payload?.status}`);
    logPass('RW draft created');

    const postRwRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${rwId}/post`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/wms/adjustments/:id/post');
    expectStatus(postRwRes, 200);
    ensure(String(postRwRes.payload?.status) === 'posted', `Expected RW posted, got ${postRwRes.payload?.status}`);
    logPass('RW posted');

    const balancesAfterRwRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesAfterRwRes, 200);
    const balanceAfterRw = findBalanceRow(balancesAfterRwRes.payload?.data, {
      warehouseId,
      productId,
      variantId: null,
    });
    ensure(balanceAfterRw, 'Balance row after RW not found');
    ensure(round4(asNumber(balanceAfterRw.onHand)) === 7, `Expected onHand=7 after RW, got ${balanceAfterRw.onHand}`);
    logPass('onHand 10 -> 7 after RW');

    const rwMovesRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/adjustments/${rwId}/stock-moves?limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments/:id/stock-moves');
    expectStatus(rwMovesRes, 200);
    const rwMoves = rwMovesRes.payload?.data || [];
    ensure(rwMoves.length === 1, `Expected 1 RW stock_move, got ${rwMoves.length}`);
    ensure(rwMoves[0]?.refType === 'RW', `Expected refType=RW, got ${rwMoves[0]?.refType}`);
    ensure(Boolean(rwMoves[0]?.refItemId), 'Expected refItemId to be filled for RW');
    logPass('RW stock_move has refType/refItemId');

    const listRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/wms/adjustments?page=1&limit=25&sort=createdAt:DESC',
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments');
    expectStatus(listRes, 200);
    const listRows = listRes.payload?.data || [];
    ensure(listRows.some((row) => row?.id === pwId), 'PW not present in adjustments list');
    ensure(listRows.some((row) => row?.id === rwId), 'RW not present in adjustments list');
    logPass('GET /api/wms/adjustments returns created docs');

    const detailPwRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/adjustments/${pwId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments/:id');
    expectStatus(detailPwRes, 200);
    ensure(detailPwRes.payload?.id === pwId, 'PW detail id mismatch');
    ensure(Array.isArray(detailPwRes.payload?.items) && detailPwRes.payload.items.length === 1, 'PW detail items missing');

    const detailRwRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/adjustments/${rwId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/adjustments/:id');
    expectStatus(detailRwRes, 200);
    ensure(detailRwRes.payload?.id === rwId, 'RW detail id mismatch');
    logPass('GET /api/wms/adjustments/:id works');

    const createRwTooBigRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token: companyToken,
      body: {
        warehouseId,
        documentType: 'RW',
        reason: `RW too big ${prefix}`,
        items: [
          {
            productId,
            variantId: null,
            locationId,
            lotId: null,
            qtyDelta: -100,
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/wms/adjustments (RW too big)');
    expectStatus(createRwTooBigRes, 201);
    const rwTooBigId = createRwTooBigRes.payload?.id;
    ensure(rwTooBigId, 'RW too-big draft id missing');

    const postRwTooBigRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${rwTooBigId}/post`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/wms/adjustments/:id/post (insufficient)');
    ensure(
      postRwTooBigRes.status === 409,
      `Expected 409 on RW > available, got ${postRwTooBigRes.status}. Payload: ${getErrorMessage(postRwTooBigRes.payload)}`
    );
    ensure(
      String(postRwTooBigRes.payload?.code || '').toUpperCase() === 'INSUFFICIENT_STOCK',
      `Expected code=INSUFFICIENT_STOCK, got ${postRwTooBigRes.payload?.code}`
    );
    logPass('RW > available returns 409 INSUFFICIENT_STOCK');

    // eslint-disable-next-line no-console
    console.log('\nSmoke RW/PW API scenario passed.');
    // eslint-disable-next-line no-console
    console.log(`Smoke prefix: ${prefix}`);
    // eslint-disable-next-line no-console
    console.log('Endpoints checked:');
    for (const endpoint of testedEndpoints) {
      // eslint-disable-next-line no-console
      console.log(`  - ${endpoint}`);
    }
  } finally {
    server.close();
    await once(server, 'close');
    await sequelize.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Smoke RW/PW API failed:', error);
  process.exitCode = 1;
});
