'use strict';

process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const { v4: uuidv4 } = require('uuid');

process.env.FILES_STORAGE_ROOT = path.join(process.cwd(), '.tmp-registry-smoke');
fs.mkdirSync(process.env.FILES_STORAGE_ROOT, { recursive: true });

const app = require('../app');
const {
  sequelize,
  Company,
  User,
  UserCompany,
} = require('../src/models');
const tokenService = require('../src/utils/tokenService');
const registryCache = require('../src/services/registry/registryCache');
const {
  OFFICIAL_PROD_ENDPOINT,
  OFFICIAL_TEST_ENDPOINT,
  getRegistryConfig,
  resolveGusBirEndpoint,
} = require('../src/config/registry');

const results = [];

function log(name, ok, extra = '') {
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function skip(name, reason) {
  // eslint-disable-next-line no-console
  console.log(`SKIP - ${name}${reason ? ` :: ${reason}` : ''}`);
}

function ensure(name, condition, extra = '') {
  log(name, Boolean(condition), extra);
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function setOptionalEnv(name, value) {
  if (typeof value === 'undefined') delete process.env[name];
  else process.env[name] = value;
}

function parseBody(raw, contentType) {
  if (!raw) return null;
  if (String(contentType || '').includes('application/json')) {
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }
  return raw;
}

async function request(baseUrl, { path, token }) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
  const raw = await response.text();
  return {
    status: response.status,
    payload: parseBody(raw, response.headers.get('content-type')),
  };
}

function soapEnvelope(body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>${body}</s:Body>
</s:Envelope>`;
}

function startFakeGusServer() {
  let searchCount = 0;
  let mode = 'ok';

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (mode === 'error') {
        res.writeHead(502, { 'content-type': 'text/xml' });
        res.end('provider down');
        return;
      }

      res.writeHead(200, { 'content-type': 'application/soap+xml; charset=utf-8' });
      if (body.includes('Zaloguj')) {
        res.end(soapEnvelope('<ZalogujResponse><ZalogujResult>fake-sid</ZalogujResult></ZalogujResponse>'));
        return;
      }
      if (body.includes('Wyloguj')) {
        res.end(soapEnvelope('<WylogujResponse><WylogujResult>true</WylogujResult></WylogujResponse>'));
        return;
      }
      if (body.includes('DaneSzukajPodmioty')) {
        searchCount += 1;
        const payload = [
          '<root><dane>',
          '<Regon>101010101</Regon>',
          '<Nip>7272898154</Nip>',
          '<Nazwa>Smoke Registry Sp. z o.o.</Nazwa>',
          '<Krs>0000123456</Krs>',
          '<Miejscowosc>Lodz</Miejscowosc>',
          '<KodPocztowy>90-001</KodPocztowy>',
          '<Ulica>Piotrkowska</Ulica>',
          '<NrNieruchomosci>1</NrNieruchomosci>',
          '<NrLokalu>2</NrLokalu>',
          '<FormaPrawna>Sp. z o.o.</FormaPrawna>',
          '<DataPowstania>20200102</DataPowstania>',
          '</dane></root>',
        ].join('');
        res.end(soapEnvelope(`<DaneSzukajPodmiotyResponse><DaneSzukajPodmiotyResult>${payload.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</DaneSzukajPodmiotyResult></DaneSzukajPodmiotyResponse>`));
        return;
      }
      res.end(soapEnvelope('<UnknownResponse />'));
    });
  });

  return {
    listen: async () => {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      return `http://127.0.0.1:${server.address().port}`;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
    setMode: (nextMode) => { mode = nextMode; },
    getSearchCount: () => searchCount,
  };
}

(async () => {
  const created = { userIds: [], companyIds: [] };
  const originalEnv = {
    env: process.env.GUS_BIR_ENV,
    key: process.env.GUS_BIR_API_KEY,
    endpoint: process.env.GUS_BIR_ENDPOINT,
    timeout: process.env.GUS_BIR_TIMEOUT_MS,
    registryMockEnabled: process.env.REGISTRY_MOCK_ENABLED,
    registryMockOnlyInTest: process.env.REGISTRY_MOCK_ONLY_IN_TEST,
    nodeEnv: process.env.NODE_ENV,
  };
  const liveNip = process.env.GUS_BIR_LIVE_NIP || '5261040828';
  let apiServer;
  let fakeGus;

  try {
    await sequelize.authenticate();

    delete process.env.GUS_BIR_ENV;
    delete process.env.GUS_BIR_ENDPOINT;
    ensure(
      'default GUS_BIR_ENV resolves test endpoint',
      getRegistryConfig().gusBirEnv === 'test' &&
        getRegistryConfig().gusBirEndpoint === OFFICIAL_TEST_ENDPOINT,
      `endpoint=${getRegistryConfig().gusBirEndpoint}`
    );

    process.env.GUS_BIR_ENV = 'production';
    delete process.env.GUS_BIR_ENDPOINT;
    ensure(
      'production GUS_BIR_ENV resolves production endpoint',
      getRegistryConfig().gusBirEnv === 'production' &&
        getRegistryConfig().gusBirEndpoint === OFFICIAL_PROD_ENDPOINT,
      `endpoint=${getRegistryConfig().gusBirEndpoint}`
    );

    process.env.GUS_BIR_ENV = 'test';
    process.env.GUS_BIR_ENDPOINT = 'http://127.0.0.1:65535/override';
    ensure(
      'explicit GUS_BIR_ENDPOINT override wins',
      resolveGusBirEndpoint({
        endpoint: process.env.GUS_BIR_ENDPOINT,
        env: process.env.GUS_BIR_ENV,
      }) === process.env.GUS_BIR_ENDPOINT &&
        getRegistryConfig().gusBirEndpoint === process.env.GUS_BIR_ENDPOINT,
      `endpoint=${getRegistryConfig().gusBirEndpoint}`
    );

    setOptionalEnv('GUS_BIR_ENV', originalEnv.env);
    setOptionalEnv('GUS_BIR_ENDPOINT', originalEnv.endpoint);

    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const user = await User.create({
      id: uuidv4(),
      email: `registry-smoke-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
      isActive: true,
    });
    created.userIds.push(user.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Registry Smoke ${suffix}`,
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

    const missingAuth = await request(baseUrl, {
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154',
    });
    ensure('missing auth rejected', missingAuth.status === 401, `status=${missingAuth.status}`);

    const missingQuery = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip',
    });
    ensure('missing query rejected', missingQuery.status === 400, `status=${missingQuery.status}`);

    const unsupportedCountry = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=DE&kind=nip&value=7272898154',
    });
    ensure(
      'unsupported country rejected',
      unsupportedCountry.status === 400 && unsupportedCountry.payload?.code === 'UNSUPPORTED_COUNTRY',
      `status=${unsupportedCountry.status} code=${unsupportedCountry.payload?.code}`
    );

    const unsupportedKind = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=regon&value=7272898154',
    });
    ensure(
      'unsupported kind rejected',
      unsupportedKind.status === 400 && unsupportedKind.payload?.code === 'UNSUPPORTED_KIND',
      `status=${unsupportedKind.status} code=${unsupportedKind.payload?.code}`
    );

    const invalidNip = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=1234567890',
    });
    ensure(
      'invalid PL NIP checksum rejected',
      invalidNip.status === 400 && invalidNip.payload?.code === 'INVALID_TAX_ID',
      `status=${invalidNip.status} code=${invalidNip.payload?.code}`
    );

    delete process.env.GUS_BIR_API_KEY;
    delete process.env.GUS_BIR_ENDPOINT;
    process.env.GUS_BIR_ENV = 'test';
    delete process.env.REGISTRY_MOCK_ENABLED;
    delete process.env.REGISTRY_MOCK_ONLY_IN_TEST;
    registryCache.clear();
    const missingConfig = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154',
    });
    ensure(
      'missing GUS key returns CONFIG_MISSING',
      missingConfig.status === 503 && missingConfig.payload?.code === 'CONFIG_MISSING',
      `status=${missingConfig.status} code=${missingConfig.payload?.code}`
    );

    if (!originalEnv.key) {
      skip('live known NIP lookup', 'GUS_BIR_API_KEY unset');
    } else {
      process.env.GUS_BIR_API_KEY = originalEnv.key;
      if (originalEnv.env) process.env.GUS_BIR_ENV = originalEnv.env;
      if (originalEnv.endpoint) process.env.GUS_BIR_ENDPOINT = originalEnv.endpoint;
      if (originalEnv.timeout) process.env.GUS_BIR_TIMEOUT_MS = originalEnv.timeout;
      registryCache.clear();
      const live = await request(baseUrl, {
        token,
        path: `/api/registry/lookup?country=PL&kind=nip&value=${liveNip}`,
      });
      ensure(
        'live known NIP returns clean DTO',
        live.status === 200 &&
          typeof live.payload?.found === 'boolean' &&
          live.payload?.country === 'PL' &&
          live.payload?.registryEnv === getRegistryConfig().gusBirEnv,
        `status=${live.status} found=${live.payload?.found} env=${live.payload?.registryEnv} code=${live.payload?.code}`
      );
      const liveCached = await request(baseUrl, {
        token,
        path: `/api/registry/lookup?country=PL&kind=nip&value=${liveNip}`,
      });
      ensure(
        'live known NIP cache hit works',
        liveCached.status === 200 && liveCached.payload?.cache?.hit === true,
        `status=${liveCached.status} hit=${liveCached.payload?.cache?.hit}`
      );
      const liveForced = await request(baseUrl, {
        token,
        path: `/api/registry/lookup?country=PL&kind=nip&value=${liveNip}&forceRefresh=true`,
      });
      ensure(
        'live known NIP forceRefresh bypasses cache',
        liveForced.status === 200 && liveForced.payload?.cache?.hit === false,
        `status=${liveForced.status} hit=${liveForced.payload?.cache?.hit}`
      );
    }

    const originalGusEnv = String(originalEnv.env || '').trim().toLowerCase();
    const originalMockEnabled = isTruthy(originalEnv.registryMockEnabled);
    const runDemoMockCases = originalMockEnabled && originalGusEnv === 'test';

    if (runDemoMockCases) {
      process.env.REGISTRY_MOCK_ENABLED = 'true';
      process.env.REGISTRY_MOCK_ONLY_IN_TEST = 'true';
      process.env.NODE_ENV = 'development';
      process.env.GUS_BIR_ENV = 'test';
      delete process.env.GUS_BIR_API_KEY;
      delete process.env.GUS_BIR_ENDPOINT;
      registryCache.clear();

      const mockNips = [
        ['7272898154', 'DriveSafe Sp. z o.o.'],
        ['7011055830', 'AutoParts Demo Sp. z o.o.'],
        ['5261040828', 'ServiceFleet Demo Sp. z o.o.'],
      ];

      for (const [mockNip, expectedName] of mockNips) {
        const mockResponse = await request(baseUrl, {
          token,
          path: `/api/registry/lookup?country=PL&kind=nip&value=${mockNip}`,
        });
        ensure(
          `mock registry returns ${expectedName}`,
          mockResponse.status === 200 &&
            mockResponse.payload?.found === true &&
            mockResponse.payload?.legalName === expectedName &&
            mockResponse.payload?.taxIds?.nip === mockNip &&
            mockResponse.payload?.source?.includes('MOCK_GUS') &&
            mockResponse.payload?.mock === true &&
            mockResponse.payload?.registryEnv === 'test' &&
            mockResponse.payload?.cache?.hit === false &&
            Boolean(mockResponse.payload?.fetchedAt),
          `status=${mockResponse.status} found=${mockResponse.payload?.found} source=${mockResponse.payload?.source?.join(',')}`
        );
      }
    }

    if (originalMockEnabled) {
      process.env.REGISTRY_MOCK_ENABLED = 'true';
      process.env.REGISTRY_MOCK_ONLY_IN_TEST = 'true';
      process.env.NODE_ENV = 'production';
      process.env.GUS_BIR_ENV = 'production';
      delete process.env.GUS_BIR_API_KEY;
      delete process.env.GUS_BIR_ENDPOINT;
      registryCache.clear();
      const productionMock = await request(baseUrl, {
        token,
        path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154',
      });
      ensure(
        'production GUS env ignores registry mock',
        productionMock.status === 503 && productionMock.payload?.code === 'CONFIG_MISSING',
        `status=${productionMock.status} code=${productionMock.payload?.code}`
      );
    }

    fakeGus = startFakeGusServer();
    delete process.env.REGISTRY_MOCK_ENABLED;
    delete process.env.REGISTRY_MOCK_ONLY_IN_TEST;
    process.env.GUS_BIR_ENV = 'test';
    process.env.GUS_BIR_API_KEY = 'smoke-fake-key';
    process.env.GUS_BIR_ENDPOINT = await fakeGus.listen();
    process.env.GUS_BIR_TIMEOUT_MS = '1000';
    registryCache.clear();

    const first = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154',
    });
    ensure(
      'fake provider returns normalized DTO',
      first.status === 200 &&
        first.payload?.found === true &&
        first.payload?.legalName === 'Smoke Registry Sp. z o.o.' &&
        first.payload?.cache?.hit === false,
      `status=${first.status}`
    );

    const second = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154',
    });
    ensure(
      'cache hit on second identical lookup',
      second.status === 200 && second.payload?.cache?.hit === true && fakeGus.getSearchCount() === 1,
      `status=${second.status} searches=${fakeGus.getSearchCount()}`
    );

    const forced = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154&forceRefresh=true',
    });
    ensure(
      'forceRefresh bypasses cache',
      forced.status === 200 && forced.payload?.cache?.hit === false && fakeGus.getSearchCount() === 2,
      `status=${forced.status} searches=${fakeGus.getSearchCount()}`
    );

    fakeGus.setMode('error');
    const stale = await request(baseUrl, {
      token,
      path: '/api/registry/lookup?country=PL&kind=nip&value=7272898154&forceRefresh=true',
    });
    ensure(
      'provider error returns stale cache fallback',
      stale.status === 200 && stale.payload?.cache?.stale === true,
      `status=${stale.status} code=${stale.payload?.code}`
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
    console.error('smokeRegistryLookup crashed', err);
    process.exitCode = 1;
  } finally {
    setOptionalEnv('GUS_BIR_ENV', originalEnv.env);
    setOptionalEnv('GUS_BIR_API_KEY', originalEnv.key);
    setOptionalEnv('GUS_BIR_ENDPOINT', originalEnv.endpoint);
    setOptionalEnv('GUS_BIR_TIMEOUT_MS', originalEnv.timeout);
    setOptionalEnv('REGISTRY_MOCK_ENABLED', originalEnv.registryMockEnabled);
    setOptionalEnv('REGISTRY_MOCK_ONLY_IN_TEST', originalEnv.registryMockOnlyInTest);
    setOptionalEnv('NODE_ENV', originalEnv.nodeEnv);

    if (fakeGus) await fakeGus.close().catch(() => {});
    if (apiServer) await new Promise((resolve) => apiServer.close(resolve)).catch(() => {});
    try {
      if (created.companyIds.length) {
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds }, force: true });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error('smokeRegistryLookup cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
