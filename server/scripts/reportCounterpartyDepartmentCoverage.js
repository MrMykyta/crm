'use strict';

const { sequelize } = require('../src/models');
const {
  analyzeAllCompanies,
  printBackfillReport,
} = require('./backfillCounterpartyDepartments');

async function main() {
  const coverage = await analyzeAllCompanies();
  printBackfillReport({
    runId: `coverage-${Date.now()}`,
    timestamp: new Date().toISOString(),
    dryRun: true,
    execute: false,
    updatedRows: 0,
    skippedRows: coverage.alreadyTagged,
    stillNullRows: coverage.total - coverage.alreadyTagged,
    before: coverage,
    after: coverage,
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('reportCounterpartyDepartmentCoverage failed', error);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close().catch(() => {}));
}
