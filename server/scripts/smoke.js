'use strict';

const http = require('http');
const { once } = require('events');

process.env.NODE_ENV = process.env.SMOKE_NODE_ENV || 'development';
process.env.SKIP_MONGO_CONNECT = '1';
process.env.SKIP_CRON = '1';

const app = require('../app');

function parseBody(raw, contentType) {
  if (!raw) return null;
  if (String(contentType || '').includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return raw;
    }
  }
  return raw;
}

async function request(baseUrl, method, path, body) {
  const headers = {};
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
  };
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const checks = [
    { method: 'GET', path: '/api/health', expectedStatus: 200, expectData: true },
    { method: 'POST', path: '/api/auth/login', expectedStatus: 400, body: {}, expectMessage: true },
    { method: 'POST', path: '/api/auth/refresh', expectedStatus: 400, body: {}, expectMessage: true },
    { method: 'GET', path: '/api/warehouses', expectedStatus: 401, expectMessage: true },
    { method: 'GET', path: '/api/chat/rooms', expectedStatus: 401, expectMessage: true },
  ];

  const results = [];

  try {
    for (const check of checks) {
      const result = await request(baseUrl, check.method, check.path, check.body);
      ensure(
        result.status === check.expectedStatus,
        `${check.method} ${check.path}: expected ${check.expectedStatus}, got ${result.status}`
      );

      if (check.expectData) {
        ensure(
          result.payload && typeof result.payload === 'object' && 'data' in result.payload,
          `${check.method} ${check.path}: expected response with data envelope`
        );
      }

      if (check.expectMessage) {
        ensure(
          result.payload && typeof result.payload === 'object' && typeof result.payload.message === 'string',
          `${check.method} ${check.path}: expected error payload with message`
        );
      }

      results.push(`${check.method} ${check.path} -> ${result.status}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  results.forEach((line) => console.log(`PASS ${line}`));
  console.log('Smoke checks passed.');
}

run().catch((error) => {
  console.error('Smoke checks failed:', error.message);
  process.exit(1);
});
