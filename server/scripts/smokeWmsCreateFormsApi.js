'use strict';

// API-level smoke for E4 create forms payload compatibility.
// Verifies PZ/MM/RW-PW flows through REAL HTTP endpoints.
//
// Run:
//   docker compose exec backend node scripts/smokeWmsCreateFormsApi.js

const http = require('http');
const { once } = require('events');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');
const { sequelize, CompanyWarehouseDocumentSetting, User } = require('../src/models');

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

function unwrapData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function findBalanceRow(rows, { warehouseId, productId, variantId = null }) {
  return (rows || []).find((row) => {
    const rowVariant = row?.variantId || null;
    return row?.warehouseId === warehouseId
      && row?.productId === productId
      && rowVariant === variantId;
  });
}

async function run() {
  await sequelize.authenticate();

  const smokeId = Date.now();
  const prefix = `smoke-e4-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${prefix}@example.com`;
  const password = 'Smoke123!E4';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'E4',
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
  const remember = (method, path) => testedEndpoints.push(`${method} ${path}`);

  try {
    // Auth + company scope
    const loginRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password },
    });
    remember('POST', '/api/auth/login');
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'Login token missing');
    logPass('Auth/login acquired');

    const companyRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/companies',
      token: loginToken,
      body: { name: `E4 Company ${prefix}` },
    });
    remember('POST', '/api/companies');
    expectStatus(companyRes, 201);
    const token = companyRes.payload?.tokens?.accessToken;
    const companyId = companyRes.payload?.activeCompanyId;
    ensure(token, 'Company token missing');
    ensure(companyId, 'Company id missing');
    const [wmsSettings] = await CompanyWarehouseDocumentSetting.findOrCreate({
      where: { companyId },
      defaults: {
        companyId,
        inventoryCostMethod: 'FIFO',
        costingInitializedAt: new Date(),
      },
    });
    await wmsSettings.update({
      inventoryCostMethod: 'FIFO',
      costingInitializedAt: wmsSettings.costingInitializedAt || new Date(),
    });
    logPass('Company created');

    // Warehouse + locations
    const whRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/warehouses',
      token,
      body: {
        code: `E4-${smokeId}`.slice(0, 32),
        name: `E4 Warehouse ${prefix}`.slice(0, 120),
        isActive: true,
      },
    });
    remember('POST', '/api/warehouses');
    expectStatus(whRes, 201);
    const warehouseId = whRes.payload?.id;
    ensure(warehouseId, 'warehouseId missing');
    logPass('Warehouse created');

    const locARes = await request(baseUrl, {
      method: 'POST',
      path: '/api/locations',
      token,
      body: {
        warehouseId,
        code: `E4-A-${smokeId}`.slice(0, 32),
        type: 'bulk',
      },
    });
    remember('POST', '/api/locations');
    expectStatus(locARes, 201);
    const locationAId = locARes.payload?.id;
    ensure(locationAId, 'locationAId missing');

    const locBRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/locations',
      token,
      body: {
        warehouseId,
        code: `E4-B-${smokeId}`.slice(0, 32),
        type: 'bulk',
      },
    });
    remember('POST', '/api/locations');
    expectStatus(locBRes, 201);
    const locationBId = locBRes.payload?.id;
    ensure(locationBId, 'locationBId missing');
    logPass('Locations A/B created');

    // Two products for 2-line PZ
    const productARes = await request(baseUrl, {
      method: 'POST',
      path: '/api/products',
      token,
      body: {
        name: `E4 Product A ${prefix}`.slice(0, 200),
        slug: `e4-a-${smokeId}-${crypto.randomUUID().slice(0, 6)}`,
        sku: `E4A-${smokeId}`.slice(0, 64),
        status: 'active',
      },
    });
    remember('POST', '/api/products');
    expectStatus(productARes, 201);
    const productAId = unwrapData(productARes.payload)?.id;
    ensure(productAId, 'productAId missing');

    const productBRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/products',
      token,
      body: {
        name: `E4 Product B ${prefix}`.slice(0, 200),
        slug: `e4-b-${smokeId}-${crypto.randomUUID().slice(0, 6)}`,
        sku: `E4B-${smokeId}`.slice(0, 64),
        status: 'active',
      },
    });
    remember('POST', '/api/products');
    expectStatus(productBRes, 201);
    const productBId = unwrapData(productBRes.payload)?.id;
    ensure(productBId, 'productBId missing');
    logPass('Products A/B created');

    // PZ create (frontend-like payload)
    const createPzRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/receipts',
      token,
      body: {
        warehouseId,
        inboundLocationId: locationAId,
        issueDate: new Date().toISOString().slice(0, 10),
        items: [
          { productId: productAId, variantId: null, lotNumber: null, qtyExpected: 10, unitCost: 20, currency: 'PLN' },
          { productId: productBId, variantId: null, lotNumber: null, qtyExpected: 6, unitCost: 20, currency: 'PLN' },
        ],
      },
    });
    remember('POST', '/api/wms/receipts');
    expectStatus(createPzRes, 201);
    const receiptId = createPzRes.payload?.id;
    const receiptItems = Array.isArray(createPzRes.payload?.items) ? createPzRes.payload.items : [];
    ensure(receiptId && receiptItems.length === 2, 'receipt create response missing id/items');
    logPass('PZ create receipt with 2 lines');

    // receive selected line (first)
    const selectedLine = receiptItems[0];
    const receiveSelectedRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/receipts/item/${selectedLine.id}/receive`,
      token,
      body: {
        qty: 10,
        toLocationId: locationAId,
        lotId: null,
      },
    });
    remember('POST', '/api/wms/receipts/item/:itemId/receive');
    expectStatus(receiveSelectedRes, 200);
    logPass('PZ receive selected line');

    const balancesAfterSelectedRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}`,
      token,
    });
    remember('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesAfterSelectedRes, 200);
    const balancesAfterSelected = balancesAfterSelectedRes.payload?.data || [];
    const rowAAfterSelected = findBalanceRow(balancesAfterSelected, { warehouseId, productId: productAId });
    const rowBAfterSelected = findBalanceRow(balancesAfterSelected, { warehouseId, productId: productBId });
    ensure(rowAAfterSelected && round4(asNumber(rowAAfterSelected.onHand)) === 10, `Expected A onHand=10, got ${rowAAfterSelected?.onHand}`);
    ensure(!rowBAfterSelected || round4(asNumber(rowBAfterSelected.onHand)) === 0, `Expected B onHand=0, got ${rowBAfterSelected?.onHand}`);
    logPass('Stock updated after selected receive');

    // receive all remaining lines
    const receiptDetailRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/receipts/${receiptId}`,
      token,
    });
    remember('GET', '/api/receipts/:id');
    expectStatus(receiptDetailRes, 200);
    const detailItems = Array.isArray(receiptDetailRes.payload?.items) ? receiptDetailRes.payload.items : [];
    for (const line of detailItems) {
      const qtyExpected = asNumber(line?.qtyExpected, 0);
      const qtyReceived = asNumber(line?.qtyReceived, 0);
      const qtyLeft = round4(qtyExpected - qtyReceived);
      if (qtyLeft <= 0) continue;
      // eslint-disable-next-line no-await-in-loop
      const receiveRes = await request(baseUrl, {
        method: 'POST',
        path: `/api/wms/receipts/item/${line.id}/receive`,
        token,
        body: {
          qty: qtyLeft,
          toLocationId: locationAId,
          lotId: null,
        },
      });
      remember('POST', '/api/wms/receipts/item/:itemId/receive');
      expectStatus(receiveRes, 200);
    }
    logPass('PZ receive all remaining lines');

    const balancesAfterAllRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}`,
      token,
    });
    remember('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesAfterAllRes, 200);
    const balancesAfterAll = balancesAfterAllRes.payload?.data || [];
    const rowAAfterAll = findBalanceRow(balancesAfterAll, { warehouseId, productId: productAId });
    const rowBAfterAll = findBalanceRow(balancesAfterAll, { warehouseId, productId: productBId });
    ensure(rowAAfterAll && round4(asNumber(rowAAfterAll.onHand)) === 10, `Expected A onHand=10 after receive-all, got ${rowAAfterAll?.onHand}`);
    ensure(rowBAfterAll && round4(asNumber(rowBAfterAll.onHand)) === 6, `Expected B onHand=6 after receive-all, got ${rowBAfterAll?.onHand}`);
    logPass('Stock updated after receive all');

    // MM create + execute line (frontend-like payload)
    const createMmRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/transfers',
      token,
      body: {
        fromWarehouseId: warehouseId,
        toWarehouseId: warehouseId,
        issueDate: new Date().toISOString().slice(0, 10),
        items: [
          { productId: productAId, variantId: null, qty: 4 },
        ],
      },
    });
    remember('POST', '/api/wms/transfers');
    expectStatus(createMmRes, 201);
    const transferId = createMmRes.payload?.id;
    ensure(transferId, 'transferId missing');
    logPass('MM create transfer');

    const transferDetailRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/transfers/${transferId}`,
      token,
    });
    remember('GET', '/api/transfers/:id');
    expectStatus(transferDetailRes, 200);
    const transferItem = transferDetailRes.payload?.items?.[0];
    ensure(transferItem?.id, 'transfer item id missing');

    const executeLineRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/transfers/item/${transferItem.id}/execute`,
      token,
      body: {
        fromLocationId: locationAId,
        toLocationId: locationBId,
        qty: 4,
      },
    });
    remember('POST', '/api/wms/transfers/item/:itemId/execute');
    expectStatus(executeLineRes, 200);
    logPass('MM execute line');

    const balancesAfterMmRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productAId}`,
      token,
    });
    remember('GET', '/api/wms/inventory/stock-balances?productId=...');
    expectStatus(balancesAfterMmRes, 200);
    const rowAAfterMm = findBalanceRow(balancesAfterMmRes.payload?.data || [], { warehouseId, productId: productAId });
    ensure(rowAAfterMm && round4(asNumber(rowAAfterMm.onHand)) === 10, `Expected A onHand unchanged=10 after MM, got ${rowAAfterMm?.onHand}`);

    const mmMovesRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/transfers/${transferId}/stock-moves?limit=200`,
      token,
    });
    remember('GET', '/api/transfers/:id/stock-moves');
    expectStatus(mmMovesRes, 200);
    const mmMoves = mmMovesRes.payload?.data || [];
    ensure(mmMoves.length === 2, `Expected 2 MM stock moves, got ${mmMoves.length}`);
    ensure(mmMoves.every((move) => String(move?.refType) === 'MM' && String(move?.type) === 'transfer'), 'MM stock moves should have refType=MM and type=transfer');
    logPass('MM stock movement exists and total stock is unchanged');

    // PW draft + post
    const createPwRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token,
      body: {
        documentType: 'PW',
        warehouseId,
        reason: `PW +3 ${prefix}`,
        issueDate: new Date().toISOString().slice(0, 10),
        items: [
          { productId: productAId, variantId: null, locationId: locationAId, qtyDelta: 3, unitCost: 20, currency: 'PLN' },
        ],
      },
    });
    remember('POST', '/api/wms/adjustments');
    expectStatus(createPwRes, 201);
    ensure(String(createPwRes.payload?.status) === 'draft', `Expected PW draft, got ${createPwRes.payload?.status}`);
    const pwId = createPwRes.payload?.id;
    ensure(pwId, 'pwId missing');
    logPass('PW draft created');

    const postPwRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${pwId}/post`,
      token,
      body: {},
    });
    remember('POST', '/api/wms/adjustments/:id/post');
    expectStatus(postPwRes, 200);
    ensure(String(postPwRes.payload?.status) === 'posted', `Expected PW posted, got ${postPwRes.payload?.status}`);
    logPass('PW posted');

    // RW draft + post
    const createRwRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token,
      body: {
        documentType: 'RW',
        warehouseId,
        reason: `RW -2 ${prefix}`,
        issueDate: new Date().toISOString().slice(0, 10),
        items: [
          { productId: productAId, variantId: null, locationId: locationAId, qtyDelta: -2 },
        ],
      },
    });
    remember('POST', '/api/wms/adjustments');
    expectStatus(createRwRes, 201);
    ensure(String(createRwRes.payload?.status) === 'draft', `Expected RW draft, got ${createRwRes.payload?.status}`);
    const rwId = createRwRes.payload?.id;
    ensure(rwId, 'rwId missing');
    logPass('RW draft created');

    const postRwRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${rwId}/post`,
      token,
      body: {},
    });
    remember('POST', '/api/wms/adjustments/:id/post');
    expectStatus(postRwRes, 200);
    ensure(String(postRwRes.payload?.status) === 'posted', `Expected RW posted, got ${postRwRes.payload?.status}`);
    logPass('RW posted');

    const balancesAfterAdjRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productAId}`,
      token,
    });
    remember('GET', '/api/wms/inventory/stock-balances?warehouseId=...&productId=...');
    expectStatus(balancesAfterAdjRes, 200);
    const rowAAfterAdj = findBalanceRow(balancesAfterAdjRes.payload?.data || [], { warehouseId, productId: productAId });
    // Start 10, MM internal unchanged, PW +3, RW -2 => 11
    ensure(rowAAfterAdj && round4(asNumber(rowAAfterAdj.onHand)) === 11, `Expected A onHand=11 after PW/RW, got ${rowAAfterAdj?.onHand}`);
    logPass('RW/PW stock balance updated');

    // eslint-disable-next-line no-console
    console.log('\nE4 API smoke passed.');
    // eslint-disable-next-line no-console
    console.log('\nTested endpoints:');
    testedEndpoints.forEach((item) => {
      // eslint-disable-next-line no-console
      console.log(`- ${item}`);
    });
  } finally {
    server.close();
    await once(server, 'close');
    await sequelize.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('\nE4 API smoke failed:', error?.message || error);
  if (error?.stack) {
    // eslint-disable-next-line no-console
    console.error(error.stack);
  }
  process.exit(1);
});
