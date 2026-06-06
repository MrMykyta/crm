'use strict';

// HTTP-level smoke for Workspace Views API (Phase 1).
// Spec: WORKSPACE_VIEWS_MVP_SPEC.md §16 Phase 1 acceptance.
//
// Pattern follows other API smokes — spin up an in-process Express server, create a fresh
// User + Company via real endpoints, exercise the /api/workspace-views surface. The 50-limit
// scenario inflates DB rows via the service (faster than 50 sequential HTTP POSTs) and
// verifies only the 51st via HTTP.

const http = require('http');
const { once } = require('events');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');
const { sequelize, User, WorkspaceView } = require('../src/models');
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
  const tag = `smoke-wsv-${smokeId}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${tag}@example.com`;
  const password = 'Smoke123!WsViews';
  const passwordHash = await bcrypt.hash(password, 10);

  await User.create({
    email,
    passwordHash,
    firstName: 'Smoke',
    lastName: 'WorkspaceViews',
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
    // 1) login + create company (gives us companyToken).
    const loginRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email, password },
    });
    expectStatus(loginRes, 200);
    const loginToken = loginRes.payload?.tokens?.accessToken;
    ensure(loginToken, 'Login token missing');
    logPass('Auth login token acquired');

    const createCompanyRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/companies',
      token: loginToken,
      body: { name: `Smoke WS Views Company ${tag}` },
    });
    expectStatus(createCompanyRes, 201);
    const companyToken = createCompanyRes.payload?.tokens?.accessToken;
    const companyId = createCompanyRes.payload?.activeCompanyId;
    ensure(companyToken && companyId, 'Company token/companyId missing');
    logPass('Company created with scoped token');

    const user = await User.findOne({ where: { email } });
    ensure(user, 'User not found after creation');
    const userId = user.id;

    // 2) First GET — ensures 9 system views in DB (idempotent seed).
    const initialList = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}`,
      token: companyToken,
    });
    expectStatus(initialList, 200);
    const initialData = initialList.payload?.data || [];
    ensure(
      initialData.length === 9,
      `Expected 9 system views on first GET, got ${initialData.length}`
    );
    ensure(
      initialData.every((v) => v.scope === 'system' && v.isLocked === true),
      'All initial views must be system + locked'
    );
    const defaultViews = initialData.filter((v) => v.isDefault);
    ensure(
      defaultViews.length === 1 && defaultViews[0].key === 'all',
      `Exactly one default view "all" expected, got ${JSON.stringify(defaultViews.map((v) => v.key))}`
    );
    logPass('First GET ensures 9 system views (locked, exactly one default=all)');

    // 3) Repeated GET — no duplicates (idempotency of ensure).
    const repeatList = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}`,
      token: companyToken,
    });
    expectStatus(repeatList, 200);
    ensure(
      (repeatList.payload?.data || []).length === 9,
      'Repeated GET should still return exactly 9 system views (idempotent ensure)'
    );
    const dbCount = await WorkspaceView.count({ where: { companyId, module: MODULE, scope: 'system' } });
    ensure(dbCount === 9, `DB has ${dbCount} system rows after repeated ensure (expected 9)`);
    logPass('Repeated GET does not duplicate system views');

    // 4) Unknown module — 409.
    const unknownModule = await request(baseUrl, {
      method: 'GET',
      path: '/api/workspace-views?module=does.not.exist',
      token: companyToken,
    });
    expectErrorCode(unknownModule, 409, 'UNKNOWN_MODULE');
    logPass('GET unknown module → 409 UNKNOWN_MODULE');

    // 5) Create personal view via API.
    const createRes = await request(baseUrl, {
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
    expectStatus(createRes, 201);
    const personalView = createRes.payload;
    ensure(
      personalView.scope === 'personal' && personalView.isLocked === false
        && personalView.ownerUserId === userId,
      'Created personal view must be scope=personal, isLocked=false, owned by current user'
    );
    logPass('Create personal view → 201 with correct scope/owner');

    // 6) 51st personal view → 409 PERSONAL_VIEW_LIMIT_EXCEEDED.
    //    Inflate to 50 via service (bypass HTTP for speed), then attempt 51st via API.
    const existingPersonalCount = await WorkspaceView.count({
      where: { companyId, module: MODULE, scope: 'personal', ownerUserId: userId },
    });
    const toFill = workspaceViewsService.PERSONAL_VIEW_LIMIT - existingPersonalCount;
    for (let i = 0; i < toFill; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await workspaceViewsService.createPersonalView(companyId, userId, {
        module: MODULE,
        name: `Filler ${tag}-${i}`,
        filter: { where: [] },
      });
    }
    const limitRes = await request(baseUrl, {
      method: 'POST',
      path: '/api/workspace-views',
      token: companyToken,
      body: { module: MODULE, name: `Overflow ${tag}`, filter: {} },
    });
    expectErrorCode(limitRes, 409, 'PERSONAL_VIEW_LIMIT_EXCEEDED');
    logPass('51st personal view → 409 PERSONAL_VIEW_LIMIT_EXCEEDED');

    // 7) PATCH system view → 403 SYSTEM_VIEW_NOT_EDITABLE.
    const systemPz = initialData.find((v) => v.key === 'pz');
    const patchSystemRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/workspace-views/${systemPz.id}`,
      token: companyToken,
      body: { name: 'Hacked PZ' },
    });
    expectErrorCode(patchSystemRes, 403, 'SYSTEM_VIEW_NOT_EDITABLE');
    logPass('PATCH system view → 403 SYSTEM_VIEW_NOT_EDITABLE');

    // 8) DELETE system view → 403 SYSTEM_VIEW_NOT_DELETABLE.
    const deleteSystemRes = await request(baseUrl, {
      method: 'DELETE',
      path: `/api/workspace-views/${systemPz.id}`,
      token: companyToken,
    });
    expectErrorCode(deleteSystemRes, 403, 'SYSTEM_VIEW_NOT_DELETABLE');
    logPass('DELETE system view → 403 SYSTEM_VIEW_NOT_DELETABLE');

    // 9) PATCH personal view (rename) — should succeed.
    const renameRes = await request(baseUrl, {
      method: 'PATCH',
      path: `/api/workspace-views/${personalView.id}`,
      token: companyToken,
      body: { name: 'My drafts (renamed)' },
    });
    expectStatus(renameRes, 200);
    ensure(renameRes.payload?.name === 'My drafts (renamed)', 'Rename did not apply');
    logPass('PATCH personal view → 200 with new name');

    // 10) pin system view.
    const pinRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemPz.id}/actions/pin`,
      token: companyToken,
      body: { pinned: true },
    });
    expectStatus(pinRes, 200);
    ensure(
      pinRes.payload?.prefs?.pinned === true && Number.isInteger(pinRes.payload?.prefs?.sortOrder),
      'pin response missing prefs.pinned=true / sortOrder'
    );
    logPass('Pin system view → prefs.pinned=true with sortOrder');

    // 11) hide system view.
    const systemWz = initialData.find((v) => v.key === 'wz');
    const hideRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemWz.id}/actions/hide`,
      token: companyToken,
      body: { hidden: true },
    });
    expectStatus(hideRes, 200);
    ensure(hideRes.payload?.prefs?.hidden === true, 'hide response missing prefs.hidden=true');
    logPass('Hide system view → prefs.hidden=true');

    // 12) Default list hides the hidden view.
    const listDefault = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}`,
      token: companyToken,
    });
    expectStatus(listDefault, 200);
    const visibleKeys = (listDefault.payload?.data || []).map((v) => v.key).filter(Boolean);
    ensure(!visibleKeys.includes('wz'), 'Default list still contains hidden "wz" view');
    logPass('Default list excludes hidden view (wz)');

    // 13) includeHidden=true shows the hidden view.
    const listAll = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}&includeHidden=true`,
      token: companyToken,
    });
    expectStatus(listAll, 200);
    const allKeys = (listAll.payload?.data || []).map((v) => v.key).filter(Boolean);
    ensure(allKeys.includes('wz'), 'includeHidden=true should return hidden "wz" view');
    const wzWithPrefs = (listAll.payload?.data || []).find((v) => v.key === 'wz');
    ensure(wzWithPrefs?.prefs?.hidden === true, 'WZ prefs.hidden must be true in includeHidden response');
    logPass('includeHidden=true shows hidden view with prefs.hidden=true');

    // 14) touch updates lastUsedAt.
    const beforeTouch = await request(baseUrl, {
      method: 'GET',
      path: `/api/workspace-views?module=${MODULE}`,
      token: companyToken,
    });
    expectStatus(beforeTouch, 200);
    const pzRowBefore = (beforeTouch.payload?.data || []).find((v) => v.key === 'pz');
    const beforeUsed = pzRowBefore?.prefs?.lastUsedAt || null;

    const touchRes = await request(baseUrl, {
      method: 'POST',
      path: `/api/workspace-views/${systemPz.id}/actions/touch`,
      token: companyToken,
    });
    expectStatus(touchRes, 200);
    const touched = touchRes.payload?.prefs?.lastUsedAt;
    ensure(touched && touched !== beforeUsed, `touch did not change lastUsedAt (before=${beforeUsed}, after=${touched})`);
    logPass('Touch updates lastUsedAt');

    // 15) DELETE personal view succeeds + cascade.
    const deletePersonalRes = await request(baseUrl, {
      method: 'DELETE',
      path: `/api/workspace-views/${personalView.id}`,
      token: companyToken,
    });
    expectStatus(deletePersonalRes, 204);
    const stillThere = await WorkspaceView.findByPk(personalView.id);
    ensure(!stillThere, 'Personal view should be deleted from DB');
    logPass('DELETE personal view → 204 and row is gone');

    // eslint-disable-next-line no-console
    console.log('\nSmoke WS Views API ALL OK');
  } finally {
    server.close();
    await sequelize.close();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Smoke WS Views API FAILED:', err && err.message);
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
