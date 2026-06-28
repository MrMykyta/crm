'use strict';

process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const http = require('http');
const { once } = require('events');
const { v4: uuidv4 } = require('uuid');

const app = require('../app');
const {
  sequelize,
  Company,
  Counterparty,
  User,
  UserCompany,
} = require('../src/models');
const tokenService = require('../src/utils/tokenService');

const results = [];

function log(name, ok, extra = '') {
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function ensure(name, condition, extra = '') {
  log(name, Boolean(condition), extra);
}

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
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return {
    status: response.status,
    payload: parseBody(raw, response.headers.get('content-type')),
  };
}

function registrySnapshot(nip = '7272898154') {
  return {
    country: 'PL',
    legalName: 'Smoke Registry Sp. z o.o.',
    shortName: 'Smoke Registry Sp. z o.o.',
    taxIds: {
      nip,
      regon: '389000099',
      krs: '0000890099',
    },
    address: {
      country: 'PL',
      city: 'Lodz',
      postalCode: '90-001',
      street: 'Piotrkowska 1',
    },
    legalForm: 'Sp. z o.o.',
    pkd: ['62.01.Z'],
    source: ['MOCK_GUS'],
    registryEnv: 'test',
    fetchedAt: new Date().toISOString(),
    mock: true,
    rawSoap: '<secret />',
    sid: 'secret-sid',
    providerSecret: 'never-store',
  };
}

function counterpartyPayload(patch = {}) {
  const snapshot = registrySnapshot(patch.nip || '7272898154');
  return {
    shortName: snapshot.shortName,
    fullName: snapshot.legalName,
    nip: snapshot.taxIds.nip,
    regon: snapshot.taxIds.regon,
    krs: snapshot.taxIds.krs,
    bdo: null,
    type: 'partner',
    status: 'active',
    country: 'PL',
    city: snapshot.address.city,
    postalCode: snapshot.address.postalCode,
    street: snapshot.address.street,
    isCompany: true,
    description: '',
    contacts: [],
    registryVerification: {
      verified: true,
      verifiedAt: new Date().toISOString(),
      source: snapshot.source,
      registryEnv: snapshot.registryEnv,
      mock: true,
      snapshot,
    },
    ...patch,
  };
}

(async () => {
  const created = { userIds: [], companyIds: [], counterpartyIds: [] };
  let apiServer;

  try {
    await sequelize.authenticate();

    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const user = await User.create({
      id: uuidv4(),
      email: `counterparty-registry-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    created.userIds.push(user.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Counterparty Registry Smoke ${suffix}`,
      ownerUserId: user.id,
    });
    created.companyIds.push(company.id);

    await UserCompany.create({
      id: uuidv4(),
      userId: user.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    });

    const token = tokenService.signAccessToken({
      userId: user.id,
      activeCompanyId: company.id,
    });

    apiServer = http.createServer(app);
    apiServer.listen(0, '127.0.0.1');
    await once(apiServer, 'listening');
    const baseUrl = `http://127.0.0.1:${apiServer.address().port}`;

    const createdResponse = await request(baseUrl, {
      method: 'POST',
      path: '/api/counterparties',
      token,
      body: counterpartyPayload(),
    });
    const counterparty = createdResponse.payload;
    if (counterparty?.id) created.counterpartyIds.push(counterparty.id);
    ensure(
      'create counterparty with registryVerification verified true',
      createdResponse.status === 201 && counterparty?.registryVerified === true,
      `status=${createdResponse.status}`
    );

    const detail = await request(baseUrl, {
      path: `/api/counterparties/${counterparty.id}`,
      token,
    });
    ensure(
      'get detail returns registryVerified metadata',
      detail.status === 200 &&
        detail.payload?.registryVerified === true &&
        Boolean(detail.payload?.registryVerifiedAt) &&
        detail.payload?.registryVerifiedSource === 'MOCK_GUS' &&
        detail.payload?.registryVerifiedEnv === 'test' &&
        detail.payload?.registryVerifiedMock === true &&
        detail.payload?.registrySnapshot?.taxIds?.nip === '7272898154',
      `status=${detail.status}`
    );

    const statusUpdatePayload = {
      ...counterpartyPayload(),
      registryVerification: undefined,
      status: 'inactive',
    };
    const statusUpdate = await request(baseUrl, {
      method: 'PUT',
      path: `/api/counterparties/${counterparty.id}`,
      token,
      body: statusUpdatePayload,
    });
    ensure(
      'update non-tracked field/status does not clear verified',
      statusUpdate.status === 200 && statusUpdate.payload?.registryVerified === true && statusUpdate.payload?.status === 'inactive',
      `status=${statusUpdate.status} verified=${statusUpdate.payload?.registryVerified}`
    );

    const trackedUpdate = await request(baseUrl, {
      method: 'PUT',
      path: `/api/counterparties/${counterparty.id}`,
      token,
      body: {
        ...statusUpdatePayload,
        shortName: 'Manual Smoke Name',
      },
    });
    ensure(
      'update tracked field shortName clears verified',
      trackedUpdate.status === 200 &&
        trackedUpdate.payload?.registryVerified === false &&
        trackedUpdate.payload?.registrySnapshot == null,
      `status=${trackedUpdate.status} verified=${trackedUpdate.payload?.registryVerified}`
    );

    const refreshedPayload = counterpartyPayload({ status: 'active' });
    const refreshedUpdate = await request(baseUrl, {
      method: 'PUT',
      path: `/api/counterparties/${counterparty.id}`,
      token,
      body: refreshedPayload,
    });
    ensure(
      'update with new registryVerification sets verified again',
      refreshedUpdate.status === 200 &&
        refreshedUpdate.payload?.registryVerified === true &&
        refreshedUpdate.payload?.shortName === refreshedPayload.shortName,
      `status=${refreshedUpdate.status} verified=${refreshedUpdate.payload?.registryVerified}`
    );

    ensure(
      'create/update sanitizes snapshot fields',
      refreshedUpdate.payload?.registrySnapshot &&
        refreshedUpdate.payload.registrySnapshot.rawSoap === undefined &&
        refreshedUpdate.payload.registrySnapshot.sid === undefined &&
        refreshedUpdate.payload.registrySnapshot.providerSecret === undefined &&
        refreshedUpdate.payload.registrySnapshot.taxIds?.nip === '7272898154' &&
        Boolean(refreshedUpdate.payload.registrySnapshotHash),
      `hash=${refreshedUpdate.payload?.registrySnapshotHash || ''}`
    );

    const plainCreate = await request(baseUrl, {
      method: 'POST',
      path: '/api/counterparties',
      token,
      body: {
        shortName: `Plain Counterparty ${suffix}`,
        fullName: `Plain Counterparty ${suffix}`,
        nip: '7011055830',
        regon: null,
        krs: null,
        bdo: null,
        type: 'partner',
        status: 'active',
        country: 'PL',
        city: 'Warszawa',
        postalCode: '00-001',
        street: 'Marszalkowska 1',
        isCompany: true,
        description: '',
        contacts: [],
      },
    });
    if (plainCreate.payload?.id) created.counterpartyIds.push(plainCreate.payload.id);
    ensure(
      'existing/new counterparty without metadata returns registryVerified=false',
      plainCreate.status === 201 && plainCreate.payload?.registryVerified === false,
      `status=${plainCreate.status} verified=${plainCreate.payload?.registryVerified}`
    );

    const failed = results.filter((item) => !item.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((item) => item.name).join('; '));
      process.exitCode = 1;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('smokeCounterpartyRegistryVerification crashed', err);
    process.exitCode = 1;
  } finally {
    if (apiServer) await new Promise((resolve) => apiServer.close(resolve)).catch(() => {});
    try {
      if (created.counterpartyIds.length) {
        await Counterparty.destroy({ where: { id: created.counterpartyIds }, force: true });
      }
      if (created.companyIds.length) {
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds }, force: true });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error('smokeCounterpartyRegistryVerification cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
