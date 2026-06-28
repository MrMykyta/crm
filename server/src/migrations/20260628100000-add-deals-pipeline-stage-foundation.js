'use strict';

const { v4: uuidv4 } = require('uuid');

async function addColumnIfMissing(queryInterface, Sequelize, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipelines', 'color', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipelines', 'order', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipelines', 'archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipelines', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'order', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'is_won', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'is_lost', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'archived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'is_default_entry', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnIfMissing(queryInterface, Sequelize, 'crm_pipeline_stages', 'wip_limit', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    const [pipelines] = await queryInterface.sequelize.query(`
      SELECT id, company_id, created_at
      FROM crm_pipelines
      WHERE deleted_at IS NULL
      ORDER BY company_id ASC, created_at ASC, id ASC
    `);

    const pipelineOrderByCompany = new Map();
    for (const pipeline of pipelines) {
      const companyId = pipeline.company_id;
      const nextOrder = pipelineOrderByCompany.get(companyId) || 0;
      await queryInterface.sequelize.query(
        'UPDATE crm_pipelines SET "order" = :order, archived = false WHERE id = :id',
        { replacements: { id: pipeline.id, order: nextOrder } }
      );
      pipelineOrderByCompany.set(companyId, nextOrder + 1);
    }

    const [stages] = await queryInterface.sequelize.query(`
      SELECT id, company_id, pipeline_id, created_at, position
      FROM crm_pipeline_stages
      ORDER BY pipeline_id ASC, COALESCE(position, 0) ASC, created_at ASC, id ASC
    `);

    const stageOrderByPipeline = new Map();
    for (const stage of stages) {
      const pipelineId = stage.pipeline_id;
      const nextOrder = stageOrderByPipeline.get(pipelineId) || 0;
      await queryInterface.sequelize.query(
        `UPDATE crm_pipeline_stages
         SET "order" = :order,
             archived = false,
             hidden = false,
             is_won = false,
             is_lost = false,
             is_default_entry = false
         WHERE id = :id`,
        { replacements: { id: stage.id, order: nextOrder } }
      );
      stageOrderByPipeline.set(pipelineId, nextOrder + 1);
    }

    for (const pipeline of pipelines) {
      const [activeStages] = await queryInterface.sequelize.query(`
        SELECT id
        FROM crm_pipeline_stages
        WHERE pipeline_id = :pipelineId
          AND archived = false
          AND COALESCE(is_won, false) = false
          AND COALESCE(is_lost, false) = false
        ORDER BY "order" ASC, created_at ASC, id ASC
        LIMIT 1
      `, { replacements: { pipelineId: pipeline.id } });

      if (activeStages[0]?.id) {
        await queryInterface.sequelize.query(
          'UPDATE crm_pipeline_stages SET is_default_entry = true WHERE id = :id',
          { replacements: { id: activeStages[0].id } }
        );
      }

      const [terminalRows] = await queryInterface.sequelize.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_won = true) AS won_count,
          COUNT(*) FILTER (WHERE is_lost = true) AS lost_count,
          COALESCE(MAX("order"), -1) AS max_order
        FROM crm_pipeline_stages
        WHERE pipeline_id = :pipelineId
          AND archived = false
      `, { replacements: { pipelineId: pipeline.id } });

      let nextOrder = Number(terminalRows[0]?.max_order ?? -1) + 1;
      if (Number(terminalRows[0]?.won_count || 0) === 0) {
        await queryInterface.bulkInsert('crm_pipeline_stages', [{
          id: uuidv4(),
          company_id: pipeline.company_id,
          pipeline_id: pipeline.id,
          name: 'Won',
          probability: 100,
          position: nextOrder,
          order: nextOrder,
          color: '#22c55e',
          is_won: true,
          is_lost: false,
          hidden: false,
          archived: false,
          is_default_entry: false,
          wip_limit: null,
          created_at: new Date(),
          updated_at: new Date(),
        }]);
        nextOrder += 1;
      }

      if (Number(terminalRows[0]?.lost_count || 0) === 0) {
        await queryInterface.bulkInsert('crm_pipeline_stages', [{
          id: uuidv4(),
          company_id: pipeline.company_id,
          pipeline_id: pipeline.id,
          name: 'Lost',
          probability: 0,
          position: nextOrder,
          order: nextOrder,
          color: '#ef4444',
          is_won: false,
          is_lost: true,
          hidden: false,
          archived: false,
          is_default_entry: false,
          wip_limit: null,
          created_at: new Date(),
          updated_at: new Date(),
        }]);
      }
    }

    await queryInterface.addIndex('crm_pipelines', ['company_id', 'order'], {
      name: 'idx_crm_pipelines_company_order',
    }).catch(() => {});
    await queryInterface.addIndex('crm_pipeline_stages', ['company_id', 'pipeline_id', 'order'], {
      name: 'idx_crm_stages_company_pipeline_order',
    }).catch(() => {});
    await queryInterface.addIndex('crm_pipeline_stages', ['pipeline_id', 'is_default_entry'], {
      name: 'idx_crm_stages_pipeline_default_entry',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('crm_pipeline_stages', 'idx_crm_stages_pipeline_default_entry').catch(() => {});
    await queryInterface.removeIndex('crm_pipeline_stages', 'idx_crm_stages_company_pipeline_order').catch(() => {});
    await queryInterface.removeIndex('crm_pipelines', 'idx_crm_pipelines_company_order').catch(() => {});

    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'wip_limit');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'is_default_entry');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'archived');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'hidden');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'is_lost');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'is_won');
    await removeColumnIfExists(queryInterface, 'crm_pipeline_stages', 'order');

    await removeColumnIfExists(queryInterface, 'crm_pipelines', 'archived');
    await removeColumnIfExists(queryInterface, 'crm_pipelines', 'order');
    await removeColumnIfExists(queryInterface, 'crm_pipelines', 'color');
  },
};
