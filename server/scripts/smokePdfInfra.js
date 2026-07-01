'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
  closeBrowser,
  getBrowserConnectionInfo,
  getExecutablePath,
  htmlToPdf,
} = require('../src/services/documents/render/pdf.service');

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) {
    throw new Error(`PDF infra smoke failed: ${name}`);
  }
}

async function main() {
  let outputPath = null;

  try {
    const target = getBrowserConnectionInfo();
    const executablePath = getExecutablePath();
    // eslint-disable-next-line no-console
    console.log(`Chromium target: ${target.mode} ${target.value}`);
    if (executablePath) {
      // eslint-disable-next-line no-console
      console.log(`Chromium executable: ${executablePath}`);
    }

    const html = `<!doctype html>
      <html lang="pl">
        <head>
          <meta charset="utf-8" />
          <title>Sunset PDF Smoke</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: "Noto Sans", Arial, sans-serif; color: #111827; }
            .paper { border: 1px solid #d1d5db; padding: 24px; }
            h1 { margin: 0 0 12px; font-size: 26px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            .total { text-align: right; font-weight: 700; }
          </style>
        </head>
        <body>
          <main class="paper">
            <h1>Sunset PDF Smoke</h1>
            <p>Zażółć gęślą jaźń · Faktura testowa · 123,45 PLN</p>
            <table>
              <thead><tr><th>Pozycja</th><th>Ilość</th><th>Wartość</th></tr></thead>
              <tbody><tr><td>HTML → Chromium → PDF</td><td>1</td><td>123,45 PLN</td></tr></tbody>
            </table>
            <p class="total">Razem: 123,45 PLN</p>
          </main>
        </body>
      </html>`;

    const buffer = await htmlToPdf(html, {
      format: 'A4',
      printBackground: true,
    });

    check('PDF buffer exists', Buffer.isBuffer(buffer), `type=${typeof buffer}`);
    check('PDF starts with %PDF', buffer.subarray(0, 4).toString('utf8') === '%PDF');
    check('PDF size > 1000 bytes', buffer.length > 1000, `size=${buffer.length}`);

    outputPath = path.join(os.tmpdir(), `sunset-pdf-infra-${Date.now()}.pdf`);
    await fs.writeFile(outputPath, buffer);
    const stat = await fs.stat(outputPath);
    check('Temporary PDF written', stat.size === buffer.length, outputPath);

    await fs.unlink(outputPath);
    outputPath = null;
    check('Temporary PDF removed', true);

    // eslint-disable-next-line no-console
    console.log('PDF infra smoke passed');
  } finally {
    if (outputPath) {
      await fs.unlink(outputPath).catch(() => {});
    }
    await closeBrowser();
  }
}

main().catch(async (error) => {
  await closeBrowser().catch(() => {});
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
