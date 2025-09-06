// src/boot/cron.js
const cron = require('node-cron');
const purgeUnverified = require('../jobs/purgeUnverifiedUsers');

function initCron() {
  // каждую минуту (для проверки). потом вернёшь обратно на */30
  cron.schedule('*/30 * * * *', async () => {
    console.log('[cron] purgeUnverifiedUsers tick', new Date().toISOString());
    try {
      const res = await purgeUnverified.run();
      console.log('[cron] purgeUnverifiedUsers result:', res);
    } catch (e) {
      console.error('[cron] purgeUnverifiedUsers error:', e);
    }
  });
}

module.exports = { initCron };