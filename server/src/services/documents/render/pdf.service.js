'use strict';

const http = require('http');
const https = require('https');
const puppeteer = require('puppeteer-core');

const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

const DEFAULT_MARGIN = {
  top: '16mm',
  right: '14mm',
  bottom: '16mm',
  left: '14mm',
};

let browserPromise = null;
let browserMode = null;

function getExecutablePath() {
  return process.env.PUPPETEER_EXECUTABLE_PATH || null;
}

function getBrowserConnectionInfo() {
  if (process.env.PUPPETEER_BROWSER_WS_ENDPOINT) {
    return {
      mode: 'remote_ws',
      value: process.env.PUPPETEER_BROWSER_WS_ENDPOINT,
    };
  }

  if (process.env.PUPPETEER_BROWSER_URL) {
    return {
      mode: 'remote_url',
      value: process.env.PUPPETEER_BROWSER_URL,
    };
  }

  return {
    mode: 'local_launch',
    value: getExecutablePath() || '/usr/bin/chromium',
  };
}

function normalizeMargin(margin = {}) {
  return {
    ...DEFAULT_MARGIN,
    ...(margin && typeof margin === 'object' ? margin : {}),
  };
}

function normalizePdfOptions(options = {}) {
  return {
    format: options.format || 'A4',
    printBackground: options.printBackground !== false,
    margin: normalizeMargin(options.margin),
    preferCSSPageSize: options.preferCSSPageSize === true,
    landscape: options.landscape === true,
  };
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.get(target, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} from ${url}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function resolveBrowserWSEndpoint(browserUrl) {
  const base = new URL(browserUrl);
  const versionUrl = new URL('/json/version', base);
  const payload = await fetchJson(versionUrl.toString());
  const rawWs = payload?.webSocketDebuggerUrl;
  if (!rawWs) {
    throw new Error(`Browser endpoint ${versionUrl.toString()} did not return webSocketDebuggerUrl.`);
  }

  const wsUrl = new URL(rawWs);
  wsUrl.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.host = base.host;
  return wsUrl.toString();
}

async function getBrowser() {
  if (!browserPromise) {
    const target = getBrowserConnectionInfo();
    browserMode = target.mode;
    browserPromise = (async () => {
      if (target.mode === 'remote_ws') {
        return puppeteer.connect({
          browserWSEndpoint: target.value,
          protocolTimeout: 60000,
        });
      }

      if (target.mode === 'remote_url') {
        const browserWSEndpoint = await resolveBrowserWSEndpoint(target.value);
        return puppeteer.connect({
          browserWSEndpoint,
          protocolTimeout: 60000,
        });
      }

      return puppeteer.launch({
        executablePath: target.value,
        args: DEFAULT_LAUNCH_ARGS,
        headless: 'new',
      });
    })().catch((error) => {
      browserPromise = null;
      browserMode = null;
      throw error;
    });
  }

  const browser = await browserPromise;
  if (!browser?.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

async function htmlToPdf(html, options = {}) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('htmlToPdf requires a non-empty HTML string.');
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: options.waitUntil || 'networkidle0',
      timeout: options.contentTimeoutMs || 30000,
    });

    const buffer = await page.pdf(normalizePdfOptions(options));
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  } catch (error) {
    error.message = `PDF generation failed: ${error.message}`;
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  const mode = browserMode;
  browserPromise = null;
  browserMode = null;
  if (browser?.connected) {
    if (mode === 'local_launch') {
      await browser.close().catch(() => {});
      return;
    }
    browser.disconnect();
  }
}

/**
 * PDF-1 intentionally does not connect TemplateDefinition rendering yet.
 * PDF-2/PDF-3 will feed render.service HTML into htmlToPdf().
 */
async function renderTemplatePdf() {
  throw new Error('PDF template rendering is not wired yet. Use htmlToPdf(html) for PDF-1 infrastructure.');
}

module.exports = {
  closeBrowser,
  getBrowserConnectionInfo,
  getExecutablePath,
  htmlToPdf,
  renderTemplatePdf,
};
