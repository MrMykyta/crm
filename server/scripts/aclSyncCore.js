'use strict';

// CLI: безопасный повторный запуск core ACL backfill.
//   npm run acl:sync:core

const { sequelize } = require('../src/models');
const { syncCoreAcl } = require('../src/services/system/aclSyncService');

(async () => {
  try {
    const report = await syncCoreAcl();
    // eslint-disable-next-line no-console
    console.log('[acl:sync:core] OK');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[acl:sync:core] FAILED', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
})();
