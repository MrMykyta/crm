const nodemailer = require('nodemailer');

const baseConfig465 = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  connectionTimeout: 10000, // 10s
  greetingTimeout: 10000,
};

const baseConfig587 = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,        // STARTTLS
  requireTLS: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
};

let transporter = nodemailer.createTransport(baseConfig465);

async function ensureTransport() {
  try {
    await transporter.verify();
    return transporter;
  } catch (e) {
    console.error('[MAIL verify 465 failed]', e.message);
    // fallback на 587
    transporter = nodemailer.createTransport(baseConfig587);
    await transporter.verify(); // если и это упадет — пусть бросит
    console.log('[MAIL] using 587 STARTTLS');
    return transporter;
  }
}

module.exports.sendMail = async ({ to, subject, html }) => {
  console.log(`[MAIL] sending to ${to}, subject "${subject}"`);
  const from = `"${process.env.MAIL_FROM_NAME || 'CRM'}" <${process.env.MAIL_FROM_ADDR || process.env.GMAIL_USER}>`;
  try {
    const t = await ensureTransport();
    return await t.sendMail({ from, to, subject, html });
  } catch (e) {
    console.error('[MAIL send failed]', e);
    // пробрасываем ошибку — выше её обработаем мягко
    throw e;
  }
};