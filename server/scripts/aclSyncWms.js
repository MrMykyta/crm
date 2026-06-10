'use strict';

// CLI: безопасный повторный запуск WMS ACL backfill.
//   npm run acl:sync:wms
//
// Idempotent + additive-only (см. services/system/aclSyncService.js).
// Безопасно запускать многократно: дубликаты не создаются, кастомные права не трогаются.

const { sequelize } = require('../src/models');
const { syncWmsAcl } = require('../src/services/system/aclSyncService');

(async () => {
  try {
    const report = await syncWmsAcl();
    // eslint-disable-next-line no-console
    console.log('[acl:sync:wms] OK');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[acl:sync:wms] FAILED', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
})();
