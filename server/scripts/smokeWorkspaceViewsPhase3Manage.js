'use strict';

// Phase 3 — Manage drawer API contract smoke.
//
// Exercises every action the drawer wires up: pin, unpin, hide, unhide, rename personal,
// delete personal. Also verifies the `includeHidden=true` query the drawer uses (so a
// hidden view stays visible inside the drawer while being filtered out elsewhere) and
// the 403 paths the drawer guards (rename/delete on a system view must be blocked).

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
  const tag = `smoke-wsv3-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${tag}@example.com`;
  const password = 'Smoke123!Phase3';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'Phase3',
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
    // login + company.
    const loginRes = await request(baseUrl, {
      method: 'POST', path: '/api/auth/login', body: { email, password },
    });
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'login token missing');

    const createCompanyRes = await request(baseUrl, {
      method: 'POST', path: '/api/companies', token: loginToken,
      body: { name: `Smoke Phase3 ${tag}` },
    });
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    ensure(companyToken, 'company token missing');
    logPass('auth + company setup');

    // 1) Drawer-style list with includeHidden=true returns every view (system + personal).
    const drawerList0 = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}&includeHidden=true`,
      token: companyToken,
    });
    expectStatus(drawerList0, 200);
    const initialViews = drawerList0.payload?.data || [];
    const systemKeys = initialViews
      .filter((v) => v.scope === 'system')
      .map((v) => v.key)
      .sort();
    ensure(
      JSON.stringify(systemKeys) === JSON.stringify(['all', 'mm', 'posted-today', 'pw', 'pz', 'pzk', 'rw', 'wz', 'wzk']),
      `expected the 9 wms.documents system keys, got ${JSON.stringify(systemKeys)}`
    );
    logPass('drawer GET ?includeHidden=true returns 9 system views (none personal yet)');

    const systemPz = initialViews.find((v) => v.key === 'pz');
    const systemWz = initialViews.find((v) => v.key === 'wz');
    ensure(systemPz && systemWz, 'pz/wz system views not found');

    // 2) PATCH on a system view must be blocked (rename guard).
    const renameSystem = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/workspace-views/${systemPz.id}`,
      token: companyToken,
      body: { name: 'Hijacked' },
    });
    expectErrorCode(renameSystem, 403, 'SYSTEM_VIEW_NOT_EDITABLE');
    logPass('PATCH on system view → 403 SYSTEM_VIEW_NOT_EDITABLE (drawer rename guard)');

    // 3) DELETE on a system view must be blocked.
    const deleteSystem = await request(baseUrl, {
      method: 'DELETE',
      path: `/api/workspace-views/${systemPz.id}`,
      token: companyToken,
    });
    expectErrorCode(deleteSystem, 403, 'SYSTEM_VIEW_NOT_DELETABLE');
    logPass('DELETE on system view → 403 SYSTEM_VIEW_NOT_DELETABLE (drawer delete guard)');

    // 4) Pin/unpin lifecycle.
    const pin = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemPz.id}/actions/pin`,
      token: companyToken,
      body: { pinned: true },
    });
    expectStatus(pin, 200);
    ensure(pin.payload?.prefs?.pinned === true, 'pin → prefs.pinned should be true');
    ensure(
      Number.isInteger(pin.payload?.prefs?.sortOrder),
      'pin → sortOrder should be auto-assigned'
    );

    const unpin = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemPz.id}/actions/pin`,
      token: companyToken,
      body: { pinned: false },
    });
    expectStatus(unpin, 200);
    ensure(unpin.payload?.prefs?.pinned === false, 'unpin → prefs.pinned should be false');
    logPass('pin/unpin lifecycle works on system view');

    // 5) Hide auto-unpins; show un-hides.
    const repin = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemWz.id}/actions/pin`,
      token: companyToken,
      body: { pinned: true },
    });
    expectStatus(repin, 200);

    const hide = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemWz.id}/actions/hide`,
      token: companyToken,
      body: { hidden: true },
    });
    expectStatus(hide, 200);
    ensure(hide.payload?.prefs?.hidden === true, 'hide → prefs.hidden should be true');
    ensure(
      hide.payload?.prefs?.pinned === false,
      'hide → prefs.pinned should auto-flip to false (spec §4)'
    );
    logPass('hide auto-unpins on system view (spec §4)');

    // includeHidden=false → wz absent; includeHidden=true → wz present and hidden=true.
    const visibleOnly = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}`,
      token: companyToken,
    });
    expectStatus(visibleOnly, 200);
    const visibleKeys = (visibleOnly.payload?.data || [])
      .filter((v) => v.scope === 'system')
      .map((v) => v.key);
    ensure(
      !visibleKeys.includes('wz'),
      'default list (picker/sidebar) should exclude hidden wz view'
    );

    const drawerHidden = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}&includeHidden=true`,
      token: companyToken,
    });
    expectStatus(drawerHidden, 200);
    const drawerWz = (drawerHidden.payload?.data || []).find((v) => v.key === 'wz');
    ensure(
      drawerWz && drawerWz.prefs?.hidden === true,
      'drawer ?includeHidden=true must still expose wz with prefs.hidden=true'
    );
    logPass('picker/sidebar list excludes hidden wz; drawer list still shows it');

    // 6) Show (un-hide) flips prefs.hidden back to false.
    const show = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemWz.id}/actions/hide`,
      token: companyToken,
      body: { hidden: false },
    });
    expectStatus(show, 200);
    ensure(show.payload?.prefs?.hidden === false, 'show → prefs.hidden should flip to false');
    logPass('show flips prefs.hidden back to false');

    // 7) Create a personal view, then rename + delete from drawer.
    const createPersonal = await request(baseUrl, {
      method: 'POST',
      path: '/api/workspace-views',
      token: companyToken,
      body: {
        module: MODULE,
        name: 'My drafts',
        icon: 'FileEdit',
        filter: { where: [{ field: 'status', op: 'eq', value: 'draft' }] },
      },
    });
    expectStatus(createPersonal, 201);
    const personal = createPersonal.payload;
    ensure(
      personal.scope === 'personal' && personal.isLocked === false,
      'created personal view must be scope=personal, isLocked=false'
    );

    // rename (drawer flow: PATCH name only).
    const rename = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/workspace-views/${personal.id}`,
      token: companyToken,
      body: { name: 'Renamed via drawer' },
    });
    expectStatus(rename, 200);
    ensure(
      rename.payload?.name === 'Renamed via drawer',
      `rename did not apply, got name=${rename.payload?.name}`
    );
    logPass('PATCH personal view name (drawer inline rename) → 200 with new name');

    // delete (drawer flow: DELETE only owner).
    const del = await request(baseUrl, {
      method: 'DELETE',
      path: `/api/workspace-views/${personal.id}`,
      token: companyToken,
    });
    expectStatus(del, 204);

    const afterDelete = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}&includeHidden=true`,
      token: companyToken,
    });
    expectStatus(afterDelete, 200);
    const stillThere = (afterDelete.payload?.data || []).find((v) => v.id === personal.id);
    ensure(!stillThere, 'deleted personal view should no longer appear in drawer list');
    logPass('DELETE personal view (drawer flow) → 204 and gone from list');

    // eslint-disable-next-line no-console
    console.log('\nSmoke WS Views Phase 3 Manage ALL OK');
  } finally {
    server.close();
    await sequelize.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Smoke WS Views Phase 3 Manage FAILED:', err && err.message);
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
