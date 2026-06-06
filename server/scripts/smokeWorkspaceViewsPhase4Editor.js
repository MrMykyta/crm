'use strict';

// Phase 4 — Save-as-personal-view contract smoke.
//
// Verifies the API the WorkspaceViewEditor calls into:
//   1) POST /api/workspace-views with the canonical filter shape that
//      buildWmsDocumentsFilterFromUrl produces (where:[{field,op,value},...]).
//   2) The created view's `filter` round-trips byte-for-byte (so the picker reads back
//      what the editor sent — Phase 2's mapWmsDocumentsFilter applies it correctly).
//   3) The personal view appears in the next list response, so picker / sidebar /
//      drawer refresh after RTK invalidation.
//   4) PERSONAL_VIEW_LIMIT_EXCEEDED is reachable at the 51st view (editor error path).
//   5) Frontend validation guards trim+max-length before send, but the backend's own
//      VALIDATION_ERROR is still hit on missing name (defence in depth).

const http = require('http');
const { once } = require('events');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');
const { sequelize, User } = require('../src/models');
const workspaceViewsService = require('../src/services/workspaceViews/workspaceViewsService');

function parseBody(raw, contentType) {
  if (!raw) return null;
  if (String(contentType || '').includes('application/json')) {
    try { return JSON.parse(raw); } catch (_) { return raw; }
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

function ensure(cond, msg) {
  if (!cond) throw new Error(msg);
}

function logPass(msg) {
  // eslint-disable-next-line no-console
  console.log(`PASS ${msg}`);
}

function expectStatus(response, expected) {
  const errBody = response.payload && typeof response.payload === 'object'
    ? JSON.stringify(response.payload)
    : String(response.payload);
  ensure(
    response.status === expected,
    `${response.method} ${response.path}: expected ${expected}, got ${response.status}. Payload: ${errBody}`
  );
}

function expectErrorCode(response, expectedStatus, expectedCode) {
  expectStatus(response, expectedStatus);
  ensure(
    response.payload && response.payload.code === expectedCode,
    `${response.method} ${response.path}: expected code=${expectedCode}, got code=${response.payload && response.payload.code}`
  );
}

const MODULE = 'wms.documents';

async function run() {
  await sequelize.authenticate();

  const smokeId = Date.now();
  const tag = `smoke-wsv4-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${tag}@example.com`;
  const password = 'Smoke123!Phase4';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'Phase4',
    isActive: true,
    emailVerifiedAt: new Date(),
    createdBy: null,
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // setup
    const loginRes = await request(baseUrl, {
      method: 'POST', path: '/api/auth/login', body: { email, password },
    });
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;

    const createCompanyRes = await request(baseUrl, {
      method: 'POST', path: '/api/companies', token: loginToken,
      body: { name: `Smoke Phase4 ${tag}` },
    });
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    const companyId = createCompanyRes.payload?.activeCompanyId;
    logPass('auth + company setup');

    // 1) Editor POSTs the canonical filter shape produced by
    //    buildWmsDocumentsFilterFromUrl for ?q=WZ&type=WZ&status=posted&warehouseId=<id>.
    const fakeWarehouseId = crypto.randomUUID();
    const filterFromUrl = {
      where: [
        { field: 'search', op: 'eq', value: 'WZ' },
        { field: 'type', op: 'in', value: ['WZ'] },
        { field: 'status', op: 'eq', value: 'posted' },
        { field: 'warehouseId', op: 'eq', value: fakeWarehouseId },
      ],
    };

    const createRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/workspace-views',
      token: companyToken,
      body: {
        module: MODULE,
        name: 'WZ Łódź posted',
        icon: 'LayoutGrid',
        filter: filterFromUrl,
      },
    });
    expectStatus(createRes, 201);
    const created = createRes.payload;
    ensure(
      created.scope === 'personal' && created.isLocked === false && created.module === MODULE,
      'created view must be scope=personal, not locked, module=wms.documents'
    );
    logPass('POST /api/workspace-views from editor → 201 with personal scope');

    // 2) Filter survives the round-trip semantically. Postgres JSONB doesn't preserve
    //    object-key insertion order, so we compare deeply, not via JSON.stringify.
    const sentWhere = filterFromUrl.where;
    const gotWhere = (created.filter && Array.isArray(created.filter.where)) ? created.filter.where : [];
    ensure(sentWhere.length === gotWhere.length, `where[] length mismatch: sent ${sentWhere.length}, got ${gotWhere.length}`);
    for (let i = 0; i < sentWhere.length; i += 1) {
      const a = sentWhere[i];
      const b = gotWhere[i];
      ensure(a.field === b.field && a.op === b.op, `clause[${i}] field/op drift`);
      const sameValue = Array.isArray(a.value)
        ? Array.isArray(b.value) && a.value.length === b.value.length && a.value.every((v, k) => String(v) === String(b.value[k]))
        : String(a.value) === String(b.value);
      ensure(sameValue, `clause[${i}] value mismatch: sent ${JSON.stringify(a.value)}, got ${JSON.stringify(b.value)}`);
    }
    logPass('filter where[] round-trips semantically (mapper reads what editor sent)');

    // 3) Subsequent list query exposes the new personal view, with prefs.pinned/hidden defaults.
    const listRes = await request(baseUrl, {
      method: 'GET', path: `/api/workspace-views?module=${MODULE}`, token: companyToken,
    });
    expectStatus(listRes, 200);
    const found = (listRes.payload?.data || []).find((v) => v.id === created.id);
    ensure(found, 'newly created personal view must appear in next list response');
    ensure(
      found?.prefs && found.prefs.pinned === false && found.prefs.hidden === false,
      `default prefs for new personal view should be pinned=false hidden=false, got ${JSON.stringify(found?.prefs)}`
    );
    logPass('new personal view appears in LIST (refreshable surface: picker/sidebar/drawer)');

    // 4) Backend validation: empty name → VALIDATION_ERROR.
    //    (Frontend trims+guards but the backend is still the authority.)
    const emptyName = await request(baseUrl, {
      method: 'POST',
      path: '/api/workspace-views',
      token: companyToken,
      body: { module: MODULE, name: '   ', filter: { where: [] } },
    });
    expectErrorCode(emptyName, 400, 'VALIDATION_ERROR');
    logPass('POST with blank name → 400 VALIDATION_ERROR (defence-in-depth check)');

    // 5) Reach the personal-view limit. Fill via service (much faster than 49 HTTP
    //    POSTs), then verify the 51st via HTTP — the editor's error path.
    const usedSoFar = (listRes.payload?.data || [])
      .filter((v) => v.scope === 'personal').length;
    const PERSONAL_LIMIT = workspaceViewsService.PERSONAL_VIEW_LIMIT;
    const toFill = PERSONAL_LIMIT - usedSoFar;
    const userId = (await User.findOne({ where: { email } })).id;
    for (let i = 0; i < toFill; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await workspaceViewsService.createPersonalView(companyId, userId, {
        module: MODULE,
        name: `Limit filler ${tag}-${i}`,
        filter: { where: [] },
      });
    }
    const overflow = await request(baseUrl, {
      method: 'POST',
      path: '/api/workspace-views',
      token: companyToken,
      body: {
        module: MODULE,
        name: 'Overflow attempt',
        filter: { where: [] },
      },
    });
    expectErrorCode(overflow, 409, 'PERSONAL_VIEW_LIMIT_EXCEEDED');
    logPass('51st personal view via editor → 409 PERSONAL_VIEW_LIMIT_EXCEEDED');

    // eslint-disable-next-line no-console
    console.log('\nSmoke WS Views Phase 4 Editor ALL OK');
  } finally {
    server.close();
    await sequelize.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Smoke WS Views Phase 4 Editor FAILED:', err && err.message);
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
