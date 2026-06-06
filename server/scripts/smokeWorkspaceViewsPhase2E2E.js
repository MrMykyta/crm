'use strict';

// Phase 2 runtime smoke — checks the contract that the frontend depends on:
//   1) GET /api/workspace-views?module=wms.documents returns 9 system views.
//   2) Default-view resolution (no ?view= ?viewId=) lands on the `all` view, which has
//      an empty filter → list query is unfiltered.
//   3) `?view=pz` maps to filter { where: [{field:'type',op:'in',value:['PZ']}] } →
//      the frontend filter mapper produces { type: 'PZ' } for the wms documents list
//      endpoint. We verify the endpoint actually returns only PZ rows under that query.
//   4) pin endpoint returns prefs.pinned=true → next list response shows it pinned, so
//      sidebar's `groupViewsForSidebar` would include it.
//
// This does not exercise the React code — there's no headless browser involved — but it
// verifies the API contracts the frontend reads.

const http = require('http');
const { once } = require('events');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');
const { sequelize, User } = require('../src/models');

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

async function run() {
  await sequelize.authenticate();
  const smokeId = Date.now();
  const tag = `smoke-wsv2-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${tag}@example.com`;
  const password = 'Smoke123!Phase2';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'Phase2',
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
    const loginRes = await request(baseUrl, {
      method: 'POST', path: '/api/auth/login', body: { email, password },
    });
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'login token missing');

    const createCompanyRes = await request(baseUrl, {
      method: 'POST', path: '/api/companies', token: loginToken,
      body: { name: `Smoke Phase2 ${tag}` },
    });
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    ensure(companyToken, 'company token missing');
    logPass('auth + company setup');

    // 1) 9 system views.
    const listRes = await request(baseUrl, {
      method: 'GET', path: '/api/workspace-views?module=wms.documents', token: companyToken,
    });
    expectStatus(listRes, 200);
    const views = listRes.payload?.data || [];
    ensure(views.length === 9, `expected 9 system views, got ${views.length}`);
    logPass('GET ?module=wms.documents returns 9 system views');

    // 2) default-view resolution (no URL params).
    const defaults = views.filter((v) => v.isDefault);
    ensure(
      defaults.length === 1 && defaults[0].key === 'all',
      `default view should be 'all', got ${JSON.stringify(defaults.map((v) => v.key))}`
    );
    ensure(
      defaults[0].filter && (Object.keys(defaults[0].filter).length === 0
        || (Array.isArray(defaults[0].filter.where) && defaults[0].filter.where.length === 0)),
      `default 'all' view should have empty filter, got ${JSON.stringify(defaults[0].filter)}`
    );
    logPass('default-view resolution: isDefault=all, empty filter (no extra params)');

    // 3) pz view → filter.where has type=PZ; confirm frontend mapper would produce {type:'PZ'}.
    const pzView = views.find((v) => v.key === 'pz');
    ensure(pzView, 'pz view missing from list');
    const pzWhere = pzView.filter?.where || [];
    const typeClause = pzWhere.find((c) => c && c.field === 'type');
    ensure(
      typeClause && typeClause.op === 'in' && Array.isArray(typeClause.value)
        && typeClause.value.length === 1 && String(typeClause.value[0]).toUpperCase() === 'PZ',
      `pz filter must be where: [{field:'type',op:'in',value:['PZ']}], got ${JSON.stringify(pzWhere)}`
    );
    logPass('?view=pz contract: filter.where[0] = type IN [PZ] (matches frontend mapper)');

    // 4) Apply the mapped query against the unified docs endpoint; should not error and
    //    should return only PZ rows. Empty result is acceptable (no PZ docs exist in this
    //    fresh company), but the response shape must be valid.
    const docsRes = await request(baseUrl, {
      method: 'GET',
      path: '/api/wms/documents?type=PZ&page=1&limit=10',
      token: companyToken,
    });
    expectStatus(docsRes, 200);
    const docs = docsRes.payload?.data || [];
    ensure(
      docs.every((r) => r.type === 'PZ'),
      `expected only PZ rows when ?type=PZ, got types: ${docs.map((r) => r.type).join(',') || '(empty)'}`
    );
    logPass('GET /api/wms/documents?type=PZ accepts mapped query (only PZ rows returned)');

    // 5) pin pz view; subsequent list shows prefs.pinned=true + sortOrder set.
    const pinRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${pzView.id}/actions/pin`,
      token: companyToken,
      body: { pinned: true },
    });
    expectStatus(pinRes, 200);
    ensure(pinRes.payload?.prefs?.pinned === true, 'pin response prefs.pinned should be true');

    const reList = await request(baseUrl, {
      method: 'GET', path: '/api/workspace-views?module=wms.documents', token: companyToken,
    });
    expectStatus(reList, 200);
    const pzAgain = (reList.payload?.data || []).find((v) => v.key === 'pz');
    ensure(
      pzAgain?.prefs?.pinned === true,
      'after pin, list should expose prefs.pinned=true for pz view (sidebar consumes this)'
    );
    logPass('pin pz → list reflects prefs.pinned=true (sidebar groupViewsForSidebar would include it)');

    // 6) touch updates lastUsedAt — picker fires this debounced; verify endpoint contract.
    const touchRes = await request(baseUrl, {
      method: 'POST', path: `/api/workspace-views/${pzView.id}/actions/touch`,
      token: companyToken,
    });
    expectStatus(touchRes, 200);
    ensure(touchRes.payload?.prefs?.lastUsedAt, 'touch should return prefs.lastUsedAt');
    logPass('touch endpoint contract holds (frontend debounced fire)');

    // eslint-disable-next-line no-console
    console.log('\nSmoke WS Views Phase 2 e2e ALL OK');
  } finally {
    server.close();
    await sequelize.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Smoke WS Views Phase 2 e2e FAILED:', err && err.message);
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
