const { chromium } = require('@playwright/test');

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractOrderIdFromUrl(url) {
  const m = url.match(/\/main\/oms\/orders\/([^/?#]+)/);
  return m ? m[1] : null;
}

(async () => {
  const baseUrl = 'http://localhost';
  const email = 'mrparnisha@icloud.com';
  const password = 'Saber3173';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const traffic = [];
  const orderResponses = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/orders') || url.includes('/api/counterparties')) {
      traffic.push({
        type: 'request',
        method: req.method(),
        url,
        body: req.postData() || null,
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/orders') || url.includes('/api/counterparties')) {
      const rec = {
        type: 'response',
        status: res.status(),
        method: res.request().method(),
        url,
      };
      traffic.push(rec);
      if (url.includes('/api/orders')) orderResponses.push(rec);
    }
  });

  const checked = {
    endpoints: new Set(),
    problems: [],
  };

  function markEndpoint(name) {
    checked.endpoints.add(name);
  }

  await page.goto(`${baseUrl}/auth`, { waitUntil: 'domcontentloaded' });

  if (page.url().includes('/auth')) {
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    const companyDialog = page.locator('[role="dialog"]');
    if (await companyDialog.count()) {
      const continueBtn = companyDialog.locator('button').first();
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      }
    }

    await page.waitForURL('**/main/**', { timeout: 30000 });
  }

  await page.goto(`${baseUrl}/main/oms/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  markEndpoint('GET /api/orders');

  await page.goto(`${baseUrl}/main/oms/orders/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const counterpartyTrigger = page.getByLabel('Select counterparty').first();
  await counterpartyTrigger.click();
  const options = page.locator('[role="option"]');
  const optionCount = await options.count();
  if (optionCount < 2) {
    checked.problems.push('Counterparty select has no company counterparties to choose');
  } else {
    await options.nth(1).click();
  }

  await page.locator('input[placeholder="Custom line name"]').first().fill(`Smoke line ${Date.now()}`);
  await page.locator('tbody tr').first().locator('input[type="number"]').nth(0).fill('2');
  await page.locator('tbody tr').first().locator('input[type="number"]').nth(1).fill('10.5');
  await page.locator('tbody tr').first().locator('input[type="number"]').nth(2).fill('23');
  await page.locator('tbody tr').first().locator('input[type="number"]').nth(3).fill('0');

  const createPromise = page.waitForResponse((res) => {
    return res.url().includes('/api/orders') && res.request().method() === 'POST';
  }, { timeout: 30000 });

  await page.getByRole('button', { name: 'Save' }).click();
  const createRes = await createPromise;
  markEndpoint('POST /api/orders');

  if (createRes.status() >= 400) {
    checked.problems.push(`Create order failed with status ${createRes.status()}`);
  }

  await page.waitForURL(/\/main\/oms\/orders\/.+/, { timeout: 30000 });
  const createdOrderUrl = page.url();
  const orderId = extractOrderIdFromUrl(createdOrderUrl);
  if (!orderId) checked.problems.push('Could not extract created order id from redirect URL');

  const grossDetailBefore = (await page.locator('aside').first().textContent()) || '';

  const detailRes = await page.waitForResponse((res) => {
    return orderId && res.url().includes(`/api/orders/${orderId}`) && res.request().method() === 'GET';
  }, { timeout: 30000 }).catch(() => null);
  if (detailRes) markEndpoint('GET /api/orders/:id');

  await page.goto(`${baseUrl}/main/oms/orders/${orderId}/edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const notesArea = page.locator('textarea[placeholder="Order notes"]');
  await notesArea.fill(`Updated at ${new Date().toISOString()}`);

  await page.locator('tbody tr').first().locator('input[type="number"]').nth(0).fill('3');
  await page.locator('tbody tr').first().locator('input[type="number"]').nth(1).fill('11.25');

  const patchPromise = page.waitForResponse((res) => {
    return orderId && res.url().includes(`/api/orders/${orderId}`) && res.request().method() === 'PATCH';
  }, { timeout: 30000 });

  const itemsPromise = page.waitForResponse((res) => {
    return orderId && res.url().includes(`/api/orders/${orderId}/items`) && res.request().method() === 'PUT';
  }, { timeout: 30000 });

  await page.getByRole('button', { name: 'Save' }).click();
  const patchRes = await patchPromise;
  const itemsRes = await itemsPromise;
  markEndpoint('PATCH /api/orders/:id');
  markEndpoint('PUT /api/orders/:id/items');

  if (patchRes.status() >= 400) checked.problems.push(`Patch order failed with status ${patchRes.status()}`);
  if (itemsRes.status() >= 400) checked.problems.push(`Save items failed with status ${itemsRes.status()}`);

  await page.waitForURL(`**/main/oms/orders/${orderId}`, { timeout: 30000 });

  await page.waitForTimeout(1500);
  const grossDetailAfter = (await page.locator('aside').first().textContent()) || '';
  if (grossDetailBefore === grossDetailAfter) {
    checked.problems.push('Detail totals/summary did not change after item update (possible cache invalidation issue)');
  }

  // Payload checks
  const createReq = traffic.find((x) => x.type === 'request' && x.url.includes('/api/orders') && x.method === 'POST');
  const patchReq = traffic.find((x) => x.type === 'request' && x.url.includes(`/api/orders/${orderId}`) && x.method === 'PATCH');
  const itemsReq = traffic.find((x) => x.type === 'request' && x.url.includes(`/api/orders/${orderId}/items`) && x.method === 'PUT');

  const createBody = parseJsonSafe(createReq?.body || '');
  const patchBody = parseJsonSafe(patchReq?.body || '');
  const itemsBody = parseJsonSafe(itemsReq?.body || '');

  const payloadChecks = {
    createHasCompanyId: Boolean(createBody && Object.prototype.hasOwnProperty.call(createBody, 'companyId')),
    patchHasCompanyId: Boolean(patchBody && Object.prototype.hasOwnProperty.call(patchBody, 'companyId')),
    itemsHasCompanyId: Boolean(itemsBody && Object.prototype.hasOwnProperty.call(itemsBody, 'companyId')),
    createPlacedAtType: createBody ? typeof createBody.placedAt : 'missing',
    createFirstItem: itemsBody?.items?.[0] || createBody?.items?.[0] || null,
  };

  if (payloadChecks.createHasCompanyId || payloadChecks.patchHasCompanyId || payloadChecks.itemsHasCompanyId) {
    checked.problems.push('Payload contains companyId, should be omitted in frontend payload');
  }

  const firstItem = payloadChecks.createFirstItem;
  if (firstItem) {
    const numericKeys = ['quantity', 'unitPriceNet', 'taxRate', 'vatRate', 'discountValue'];
    for (const key of numericKeys) {
      if (typeof firstItem[key] !== 'number' || Number.isNaN(firstItem[key])) {
        checked.problems.push(`Item field ${key} is not a valid number in payload`);
      }
    }
  }

  // Actions endpoints smoke (confirm/cancel)
  const confirmRes = await page.request.post(`${baseUrl}/api/orders/${orderId}/actions/confirm`, { data: {} });
  markEndpoint('POST /api/orders/:id/actions/confirm');
  if (confirmRes.status() >= 400) checked.problems.push(`Confirm action failed with status ${confirmRes.status()}`);

  const cancelRes = await page.request.post(`${baseUrl}/api/orders/${orderId}/actions/cancel`, { data: {} });
  markEndpoint('POST /api/orders/:id/actions/cancel');
  if (cancelRes.status() >= 400) checked.problems.push(`Cancel action failed with status ${cancelRes.status()}`);

  console.log(JSON.stringify({
    checkedEndpoints: Array.from(checked.endpoints),
    problems: checked.problems,
    createStatus: createRes.status(),
    patchStatus: patchRes.status(),
    itemsStatus: itemsRes.status(),
    confirmStatus: confirmRes.status(),
    cancelStatus: cancelRes.status(),
    createdOrderUrl,
    payloadChecks,
    ordersResponses: orderResponses.slice(-30),
  }, null, 2));

  await browser.close();
})();
