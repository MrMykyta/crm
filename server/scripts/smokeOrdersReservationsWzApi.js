'use strict';

// API-level smoke for B3/C1/C2 (Orders -> Reservations -> WZ).
// Uses REAL HTTP endpoints and auth flow.
//
// Run:
//   docker compose exec backend node scripts/smokeOrdersReservationsWzApi.js
// or locally:
//   node server/scripts/smokeOrdersReservationsWzApi.js

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
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (typeof body !== 'undefined') {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  const raw = await response.text();
  const payload = parseBody(raw, response.headers.get('content-type'));

  return {
    status: response.status,
    payload,
    method,
    path,
  };
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function getErrorMessage(payload) {
  if (!payload) return 'empty payload';
  if (typeof payload === 'string') return payload;
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error === 'string') return payload.error;
  return JSON.stringify(payload);
}

function unwrapData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) return payload.data;
  return payload;
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function logPass(message) {
  // eslint-disable-next-line no-console
  console.log(`PASS ${message}`);
}

function expectStatus(response, expectedStatus) {
  ensure(
    response.status === expectedStatus,
    `${response.method} ${response.path}: expected ${expectedStatus}, got ${response.status}. ` +
      `Payload: ${getErrorMessage(response.payload)}`
  );
}

function sumReservationQty(rows, status) {
  return round4(
    (rows || [])
      .filter((row) => String(row?.status || '') === status)
      .reduce((acc, row) => acc + asNumber(row?.qty, 0), 0)
  );
}

function findBalanceRow(balanceRows, { warehouseId, productId, variantId = null }) {
  return (balanceRows || []).find((row) => {
    const rowVariant = row?.variantId || null;
    return (
      row?.warehouseId === warehouseId
      && row?.productId === productId
      && rowVariant === variantId
    );
  });
}

async function run() {
  await sequelize.authenticate();

  const smokeId = Date.now();
  const unique = `smoke-api-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${unique}@example.com`;
  const password = 'Smoke123!Api';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'Api',
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
    // 1) login -> token without company
    const loginRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password },
    });
    rememberEndpoint('POST', '/api/auth/login');
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'Login token is missing');
    logPass('Auth login token acquired');

    // 2) create company -> company-scoped token
    const createCompanyRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/companies',
      token: loginToken,
      body: { name: `Smoke API Company ${unique}` },
    });
    rememberEndpoint('POST', '/api/companies');
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    const companyId = createCompanyRes.payload?.activeCompanyId;
    ensure(companyToken && companyId, 'Company token/companyId missing after company create');
    logPass('Company created with scoped token');

    // G1.3 test-only setup: WZ ship requires the costing init gate. Real customers go
    // through the opening-balance flow; the API smoke flips the flag directly because it
    // tests the order→reservation→WZ surface, not the init UX.
    {
      const { CompanyWarehouseDocumentSetting } = require('../src/models');
      const [settingsRow] = await CompanyWarehouseDocumentSetting.findOrCreate({
        where: { companyId },
        defaults: { companyId },
      });
      await settingsRow.update({ costingInitializedAt: new Date() });
    }

    // 3) create warehouse + location through API
    const warehouseRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/warehouses',
      token: companyToken,
      body: {
        code: `SMK-${smokeId}`.slice(0, 32),
        name: `Smoke Warehouse ${unique}`.slice(0, 120),
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
        code: `A-${smokeId}`.slice(0, 32),
        type: 'bulk',
      },
    });
    rememberEndpoint('POST', '/api/locations');
    expectStatus(locationRes, 201);
    const locationId = locationRes.payload?.id;
    ensure(locationId, 'locationId missing');
    logPass('Location created');

    // 4) create products
    const productARes = await request(baseUrl, {
      method: 'POST',
      path: '/api/products',
      token: companyToken,
      body: {
        name: `Smoke Product A ${unique}`.slice(0, 200),
        slug: `smoke-a-${smokeId}-${crypto.randomUUID().slice(0, 6)}`,
        sku: `SM-A-${smokeId}`.slice(0, 64),
        status: 'active',
        trackInventory: true,
      },
    });
    rememberEndpoint('POST', '/api/products');
    expectStatus(productARes, 201);
    const productAId = unwrapData(productARes.payload)?.id;
    ensure(productAId, 'productAId missing');

    const productBRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/products',
      token: companyToken,
      body: {
        name: `Smoke Product B ${unique}`.slice(0, 200),
        slug: `smoke-b-${smokeId}-${crypto.randomUUID().slice(0, 6)}`,
        sku: `SM-B-${smokeId}`.slice(0, 64),
        status: 'active',
        trackInventory: true,
      },
    });
    rememberEndpoint('POST', '/api/products');
    expectStatus(productBRes, 201);
    const productBId = unwrapData(productBRes.payload)?.id;
    ensure(productBId, 'productBId missing');
    logPass('Products created');

    // 5) create counterparty
    const counterpartyRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/counterparties',
      token: companyToken,
      body: {
        shortName: `Smoke Counterparty ${unique}`.slice(0, 200),
        type: 'client',
        status: 'active',
        isCompany: true,
      },
    });
    rememberEndpoint('POST', '/api/counterparties');
    expectStatus(counterpartyRes, 201);
    const counterpartyId = counterpartyRes.payload?.id;
    ensure(counterpartyId, 'counterpartyId missing');
    logPass('Counterparty created');

    // 6) create PZ + receive 10 of product A
    const receiptRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/receipts',
      token: companyToken,
      body: {
        warehouseId,
        items: [
          {
            productId: productAId,
            qtyExpected: 10,
            unitCost: 20,
            currency: 'PLN',
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/receipts');
    expectStatus(receiptRes, 201);
    const receiptId = receiptRes.payload?.id;
    const receiptItemId = receiptRes.payload?.items?.[0]?.id;
    ensure(receiptId && receiptItemId, 'receiptId/receiptItemId missing');
    logPass('PZ receipt created');

    const receiveRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/receipts/item/${receiptItemId}/receive`,
      token: companyToken,
      body: {
        qty: 10,
        toLocationId: locationId,
      },
    });
    rememberEndpoint('POST', '/api/receipts/item/:itemId/receive');
    expectStatus(receiveRes, 200);
    logPass('PZ line received');

    // 7) create order qty 3 (product A)
    const createOrderRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/orders',
      token: companyToken,
      body: {
        counterpartyId,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: productAId,
            quantity: 3,
            unitPriceNet: 100,
            taxRate: 23,
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/orders');
    expectStatus(createOrderRes, 201);
    const orderId = createOrderRes.payload?.id;
    ensure(orderId, 'orderId missing');
    logPass('Order created');

    // 8) confirm order
    const confirmRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/orders/${orderId}/actions/confirm`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/orders/:id/actions/confirm');
    expectStatus(confirmRes, 200);
    ensure(String(confirmRes.payload?.status || '').toLowerCase() === 'confirmed', 'Order not confirmed');
    logPass('Order confirmed');

    // 9) reservations active qty=3
    const reservationsAfterConfirmRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/reservations?orderId=${orderId}&limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/reservations?orderId=...');
    expectStatus(reservationsAfterConfirmRes, 200);
    const confirmReservations = reservationsAfterConfirmRes.payload?.data || [];
    const activeQtyAfterConfirm = sumReservationQty(confirmReservations, 'active');
    ensure(activeQtyAfterConfirm === 3, `Expected active reservation qty=3, got ${activeQtyAfterConfirm}`);
    logPass('Reservations active qty=3 after confirm');

    // 10) check stock balances before ship
    const balancesBeforeShipRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productAId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesBeforeShipRes, 200);
    const balanceBeforeShip = findBalanceRow(balancesBeforeShipRes.payload?.data, {
      warehouseId,
      productId: productAId,
      variantId: null,
    });
    ensure(balanceBeforeShip, 'Balance row before ship not found');
    ensure(asNumber(balanceBeforeShip.onHand) === 10, `Expected onHand=10, got ${balanceBeforeShip.onHand}`);
    ensure(asNumber(balanceBeforeShip.reserved) === 3, `Expected reserved=3, got ${balanceBeforeShip.reserved}`);
    ensure(asNumber(balanceBeforeShip.available) === 7, `Expected available=7, got ${balanceBeforeShip.available}`);
    logPass('Stock balances before ship are correct');

    // 11) ship order
    const shipRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/orders/${orderId}/actions/ship`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/orders/:id/actions/ship');
    expectStatus(shipRes, 200);
    ensure(String(shipRes.payload?.status || '').toLowerCase() === 'shipped', 'Order not shipped');
    logPass('Order shipped');

    // 12) verify WZ exists
    const shipmentListRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/shipments?limit=200',
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/shipments');
    expectStatus(shipmentListRes, 200);
    const shipment = (shipmentListRes.payload?.data || []).find((row) => row?.orderId === orderId);
    ensure(shipment?.id, 'Shipment/WZ for order not found');
    logPass('Shipment/WZ created from order');

    // 13) verify stock moves by WZ document
    const wzHistoryAfterShipRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/stock-moves/history/document?refType=WZ&refId=${shipment.id}&limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/stock-moves/history/document?refType=WZ&refId=...');
    expectStatus(wzHistoryAfterShipRes, 200);
    const movesAfterShip = wzHistoryAfterShipRes.payload?.data || [];
    ensure(movesAfterShip.length > 0, 'No stock moves found for WZ');
    ensure(
      movesAfterShip.some((move) => String(move?.type || '') === 'ship' && String(move?.refType || '') === 'WZ'),
      'WZ history has no ship move'
    );
    logPass('WZ stock moves exist and type=ship/refType=WZ');

    // 14) verify onHand decreased and reservation fulfilled
    const balancesAfterShipRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${warehouseId}&productId=${productAId}`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/wms/inventory/stock-balances');
    expectStatus(balancesAfterShipRes, 200);
    const balanceAfterShip = findBalanceRow(balancesAfterShipRes.payload?.data, {
      warehouseId,
      productId: productAId,
      variantId: null,
    });
    ensure(balanceAfterShip, 'Balance row after ship not found');
    ensure(asNumber(balanceAfterShip.onHand) === 7, `Expected onHand=7, got ${balanceAfterShip.onHand}`);
    ensure(asNumber(balanceAfterShip.reserved) === 0, `Expected reserved=0, got ${balanceAfterShip.reserved}`);
    ensure(asNumber(balanceAfterShip.available) === 7, `Expected available=7, got ${balanceAfterShip.available}`);
    logPass('Stock balances after ship are correct');

    const reservationsAfterShipRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/reservations?orderId=${orderId}&limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/reservations?orderId=...');
    expectStatus(reservationsAfterShipRes, 200);
    const shipReservations = reservationsAfterShipRes.payload?.data || [];
    const activeQtyAfterShip = sumReservationQty(shipReservations, 'active');
    const fulfilledQtyAfterShip = sumReservationQty(shipReservations, 'fulfilled');
    ensure(activeQtyAfterShip === 0, `Expected active reservation qty=0 after ship, got ${activeQtyAfterShip}`);
    ensure(fulfilledQtyAfterShip === 3, `Expected fulfilled reservation qty=3 after ship, got ${fulfilledQtyAfterShip}`);
    logPass('Reservations fulfilled after ship');

    // 15) complete order and verify no double ship
    const shipMovesCountBeforeComplete = movesAfterShip.length;
    const completeRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/orders/${orderId}/actions/complete`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/orders/:id/actions/complete');
    expectStatus(completeRes, 200);
    ensure(String(completeRes.payload?.status || '').toLowerCase() === 'completed', 'Order not completed');
    logPass('Order completed');

    const wzHistoryAfterCompleteRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/stock-moves/history/document?refType=WZ&refId=${shipment.id}&limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/stock-moves/history/document?refType=WZ&refId=...');
    expectStatus(wzHistoryAfterCompleteRes, 200);
    const shipMovesCountAfterComplete = (wzHistoryAfterCompleteRes.payload?.data || []).length;
    ensure(
      shipMovesCountAfterComplete === shipMovesCountBeforeComplete,
      `Expected no extra ship moves on complete. before=${shipMovesCountBeforeComplete}, after=${shipMovesCountAfterComplete}`
    );
    logPass('No double shipment posting on complete');

    // 16) hard-mode: insufficient stock on confirm -> 409 + no partial active reservations
    const hardOrderRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/orders',
      token: companyToken,
      body: {
        counterpartyId,
        currencyCode: 'PLN',
        status: 'new',
        items: [
          {
            productId: productAId,
            quantity: 1,
            unitPriceNet: 10,
            taxRate: 23,
          },
          {
            productId: productBId,
            quantity: 5,
            unitPriceNet: 10,
            taxRate: 23,
          },
        ],
      },
    });
    rememberEndpoint('POST', '/api/orders');
    expectStatus(hardOrderRes, 201);
    const hardOrderId = hardOrderRes.payload?.id;
    ensure(hardOrderId, 'hardOrderId missing');

    const hardConfirmRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/orders/${hardOrderId}/actions/confirm`,
      token: companyToken,
      body: {},
    });
    rememberEndpoint('POST', '/api/orders/:id/actions/confirm');
    expectStatus(hardConfirmRes, 409);
    ensure(
      String(hardConfirmRes.payload?.code || '') === 'INSUFFICIENT_STOCK',
      `Expected code=INSUFFICIENT_STOCK, got ${hardConfirmRes.payload?.code || 'n/a'}`
    );
    logPass('Hard-mode confirm returns 409 INSUFFICIENT_STOCK');

    const hardReservationsRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/reservations?orderId=${hardOrderId}&limit=200`,
      token: companyToken,
    });
    rememberEndpoint('GET', '/api/reservations?orderId=...');
    expectStatus(hardReservationsRes, 200);
    const hardReservations = hardReservationsRes.payload?.data || [];
    const hardActiveQty = sumReservationQty(hardReservations, 'active');
    ensure(hardActiveQty === 0, `Expected no active reservations for hard-mode failed confirm, got ${hardActiveQty}`);
    logPass('Hard-mode created no partial active reservations');

    // Summary
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Smoke API scenario passed.');
    // eslint-disable-next-line no-console
    console.log(`Smoke prefix: ${unique}`);
    // eslint-disable-next-line no-console
    console.log(`Company: ${companyId}`);
    // eslint-disable-next-line no-console
    console.log('Endpoints checked:');
    testedEndpoints.forEach((endpoint) => {
      // eslint-disable-next-line no-console
      console.log(`  - ${endpoint}`);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Smoke API scenario failed:', error.message);
  process.exit(1);
});
