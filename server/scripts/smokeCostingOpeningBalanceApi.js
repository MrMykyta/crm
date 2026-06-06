'use strict';

// API-level smoke for G1.4 opening-balance initialization.
// Uses real HTTP endpoints and auth flow.
//
// Run:
//   docker compose exec backend node scripts/smokeCostingOpeningBalanceApi.js

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
  CostLayer,
  InventoryItem,
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

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function expectStatus(response, expectedStatus) {
  ensure(
    response.status === expectedStatus,
    `${response.method} ${response.path}: expected ${expectedStatus}, got ${response.status}. ` +
      `Payload: ${getErrorMessage(response.payload)}`
  );
}

function findBalanceRow(balanceRows, { warehouseId, productId, variantId = null }) {
  return (balanceRows || []).find((row) => {
    const rowVariant = row?.variantId || null;
    return row?.warehouseId === warehouseId
      && row?.productId === productId
      && rowVariant === variantId;
  });
}

async function createUser(prefix, password) {
  const email = `${prefix}@example.com`;
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'OpeningBalanceApi',
    isActive: true,
    emailVerifiedAt: new Date(),
    createdBy: null,
  });
  return email;
}

async function loginAndCreateCompany(baseUrl, { prefix, password, testedEndpoints, companyName }) {
  const email = await createUser(prefix, password);
  const rememberEndpoint = (method, path) => testedEndpoints.push(`${method} ${path}`);

  const loginRes = await request(baseUrl, {
    method: 'POST',
    path: '/api/auth/login',
    body: { email, password },
  });
  rememberEndpoint('POST', '/api/auth/login');
  expectStatus(loginRes, 200);
  const loginToken = loginRes.payload?.tokens?.accessToken;
  ensure(loginToken, 'Login token missing');

  const companyRes = await request(baseUrl, {
    method: 'POST',
    path: '/api/companies',
    token: loginToken,
    body: { name: companyName },
  });
  rememberEndpoint('POST', '/api/companies');
  expectStatus(companyRes, 201);
  const companyToken = companyRes.payload?.tokens?.accessToken;
  const companyId = companyRes.payload?.activeCompanyId;
  ensure(companyToken && companyId, 'Company token/companyId missing');

  return { companyToken, companyId };
}

async function createWarehouseLocationProduct(baseUrl, { token, prefix, productCost = null, testedEndpoints }) {
  const rememberEndpoint = (method, path) => testedEndpoints.push(`${method} ${path}`);
  const smokeId = Date.now();

  const warehouseRes = await request(baseUrl, {
    method: 'POST',
    path: '/api/warehouses',
    token,
    body: {
      code: `OB-${smokeId}-${crypto.randomUUID().slice(0, 4)}`.slice(0, 32),
      name: `Opening Balance Warehouse ${prefix}`.slice(0, 120),
      isActive: true,
    },
  });
  rememberEndpoint('POST', '/api/warehouses');
  expectStatus(warehouseRes, 201);
  const warehouseId = warehouseRes.payload?.id;
  ensure(warehouseId, 'warehouseId missing');

  const locationRes = await request(baseUrl, {
    method: 'POST',
    path: '/api/locations',
    token,
    body: {
      warehouseId,
      code: `A-${crypto.randomUUID().slice(0, 8)}`.slice(0, 32),
      type: 'bulk',
    },
  });
  rememberEndpoint('POST', '/api/locations');
  expectStatus(locationRes, 201);
  const locationId = locationRes.payload?.id;
  ensure(locationId, 'locationId missing');

  const productBody = {
    name: `Opening Balance Product ${prefix}`.slice(0, 200),
    slug: `opening-balance-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    sku: `OB-${crypto.randomUUID().slice(0, 10)}`.slice(0, 64),
    status: 'active',
    currency: 'PLN',
  };
  if (productCost !== null && productCost !== undefined) productBody.cost = productCost;

  const productRes = await request(baseUrl, {
    method: 'POST',
    path: '/api/products',
    token,
    body: productBody,
  });
  rememberEndpoint('POST', '/api/products');
  expectStatus(productRes, 201);
  const productId = productRes.payload?.data?.id || productRes.payload?.id;
  ensure(productId, 'productId missing');

  return { warehouseId, locationId, productId };
}

async function run() {
  await sequelize.authenticate();

  const smokeId = Date.now();
  const password = 'Smoke123!Opening';
  const prefix = `smoke-opening-api-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const testedEndpoints = [];

  try {
    const main = await loginAndCreateCompany(baseUrl, {
      prefix,
      password,
      testedEndpoints,
      companyName: `Smoke Opening Balance Company ${prefix}`,
    });
    logPass('Auth and company created');

    const setup = await createWarehouseLocationProduct(baseUrl, {
      token: main.companyToken,
      prefix,
      productCost: 12.5,
      testedEndpoints,
    });
    logPass('Warehouse, location and product created through API');

    await InventoryItem.create({
      companyId: main.companyId,
      warehouseId: setup.warehouseId,
      locationId: setup.locationId,
      productId: setup.productId,
      variantId: null,
      lotId: null,
      serialId: null,
      qtyOnHand: 10,
      qtyReserved: 0,
    });
    logPass('Legacy inventory gap created directly');

    const statusBeforeRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/wms/costing/opening-balance/status',
      token: main.companyToken,
    });
    testedEndpoints.push('GET /api/wms/costing/opening-balance/status');
    expectStatus(statusBeforeRes, 200);
    ensure(statusBeforeRes.payload?.initialized === false, 'Expected initialized=false before init');
    ensure(asNumber(statusBeforeRes.payload?.gapItems) === 1, `Expected gapItems=1, got ${statusBeforeRes.payload?.gapItems}`);
    logPass('Status reports one uncovered inventory item');

    const dryRunRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/costing/opening-balance/dry-run',
      token: main.companyToken,
      body: {},
    });
    testedEndpoints.push('POST /api/wms/costing/opening-balance/dry-run');
    expectStatus(dryRunRes, 200);
    ensure(dryRunRes.payload?.dryRun === true, 'Expected dryRun=true');
    ensure(asNumber(dryRunRes.payload?.itemsCount) === 1, `Expected itemsCount=1, got ${dryRunRes.payload?.itemsCount}`);
    ensure(round4(dryRunRes.payload?.totalQty) === 10, `Expected dry-run totalQty=10, got ${dryRunRes.payload?.totalQty}`);
    ensure(round4(dryRunRes.payload?.totalValue) === 125, `Expected dry-run totalValue=125, got ${dryRunRes.payload?.totalValue}`);
    const layersBeforeInit = await CostLayer.count({ where: { companyId: main.companyId, sourceRefType: 'OPENING' } });
    ensure(layersBeforeInit === 0, `Dry-run wrote opening layers: ${layersBeforeInit}`);
    logPass('Dry-run returns layer plan without writes');

    const initRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/costing/opening-balance/initialize',
      token: main.companyToken,
      body: {},
    });
    testedEndpoints.push('POST /api/wms/costing/opening-balance/initialize');
    expectStatus(initRes, 200);
    ensure(initRes.payload?.dryRun === false, 'Expected dryRun=false on initialize');
    ensure(initRes.payload?.initializedAt, 'initializedAt missing');
    ensure(asNumber(initRes.payload?.itemsCount) === 1, `Expected created layers count=1, got ${initRes.payload?.itemsCount}`);
    const layersAfterInit = await CostLayer.count({ where: { companyId: main.companyId, sourceRefType: 'OPENING' } });
    ensure(layersAfterInit === 1, `Expected one opening layer, got ${layersAfterInit}`);
    logPass('Initialize creates opening cost layer and flips flag');

    const statusAfterRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/wms/costing/opening-balance/status',
      token: main.companyToken,
    });
    testedEndpoints.push('GET /api/wms/costing/opening-balance/status (after)');
    expectStatus(statusAfterRes, 200);
    ensure(statusAfterRes.payload?.initialized === true, 'Expected initialized=true after init');
    ensure(asNumber(statusAfterRes.payload?.gapItems) === 0, `Expected gapItems=0, got ${statusAfterRes.payload?.gapItems}`);
    logPass('Status reports initialized with no gaps');

    const rwCreateRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/adjustments',
      token: main.companyToken,
      body: {
        warehouseId: setup.warehouseId,
        documentType: 'RW',
        reason: `Opening balance consume ${prefix}`,
        items: [
          {
            productId: setup.productId,
            variantId: null,
            locationId: setup.locationId,
            lotId: null,
            qtyDelta: -2,
          },
        ],
      },
    });
    testedEndpoints.push('POST /api/wms/adjustments');
    expectStatus(rwCreateRes, 201);
    const rwId = rwCreateRes.payload?.id;
    ensure(rwId, 'RW id missing');

    const rwPostRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/wms/adjustments/${rwId}/post`,
      token: main.companyToken,
      body: {},
    });
    testedEndpoints.push('POST /api/wms/adjustments/:id/post');
    expectStatus(rwPostRes, 200);
    logPass('RW outgoing FIFO consume works after opening init');

    const balanceRes = await request(baseUrl, {
      method: 'GET',
      path: `/api/wms/inventory/stock-balances?warehouseId=${setup.warehouseId}&productId=${setup.productId}`,
      token: main.companyToken,
    });
    testedEndpoints.push('GET /api/wms/inventory/stock-balances');
    expectStatus(balanceRes, 200);
    const balanceRow = findBalanceRow(balanceRes.payload?.data, setup);
    ensure(balanceRow, 'Stock balance row missing after RW');
    ensure(round4(balanceRow.onHand) === 8, `Expected onHand=8 after RW, got ${balanceRow.onHand}`);
    logPass('Stock balance updated after RW consume');

    const missingPrefix = `${prefix}-missing`;
    const missing = await loginAndCreateCompany(baseUrl, {
      prefix: missingPrefix,
      password,
      testedEndpoints,
      companyName: `Smoke Opening Missing Company ${missingPrefix}`,
    });
    const missingSetup = await createWarehouseLocationProduct(baseUrl, {
      token: missing.companyToken,
      prefix: missingPrefix,
      productCost: null,
      testedEndpoints,
    });
    await InventoryItem.create({
      companyId: missing.companyId,
      warehouseId: missingSetup.warehouseId,
      locationId: missingSetup.locationId,
      productId: missingSetup.productId,
      variantId: null,
      lotId: null,
      serialId: null,
      qtyOnHand: 5,
      qtyReserved: 0,
    });

    const missingDryRunRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/costing/opening-balance/dry-run',
      token: missing.companyToken,
      body: {},
    });
    testedEndpoints.push('POST /api/wms/costing/opening-balance/dry-run (missing cost)');
    expectStatus(missingDryRunRes, 409);
    ensure(
      missingDryRunRes.payload?.code === 'OPENING_COST_MISSING',
      `Expected OPENING_COST_MISSING, got ${missingDryRunRes.payload?.code}`
    );
    ensure(
      Array.isArray(missingDryRunRes.payload?.details?.missingCosts)
        && missingDryRunRes.payload.details.missingCosts.length === 1,
      'Expected missingCosts details'
    );
    logPass('Missing product cost returns 409 OPENING_COST_MISSING with details');

    const missingInitRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/wms/costing/opening-balance/initialize',
      token: missing.companyToken,
      body: {},
    });
    testedEndpoints.push('POST /api/wms/costing/opening-balance/initialize (missing cost)');
    expectStatus(missingInitRes, 409);
    ensure(
      missingInitRes.payload?.code === 'OPENING_COST_MISSING',
      `Expected OPENING_COST_MISSING, got ${missingInitRes.payload?.code}`
    );
    logPass('Initialize without cost/fallback returns 409 OPENING_COST_MISSING');

    // eslint-disable-next-line no-console
    console.log('\nSmoke opening-balance API scenario passed.');
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
  console.error('Smoke opening-balance API failed:', error);
  process.exitCode = 1;
});
