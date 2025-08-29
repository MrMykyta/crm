'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const cid = process.env.SEED_COMPANY_ID;
    if (!cid) {
      console.log('ℹ️  SEED_COMPANY_ID is not set. Skip demo fixtures.');
      return;
    }

    const trx = await queryInterface.sequelize.transaction();
    try {
      // 0) проверим, что такая компания есть
      const [[company]] = await queryInterface.sequelize.query(
        `SELECT id FROM companies WHERE id = :cid LIMIT 1`,
        { replacements: { cid }, transaction: trx }
      );
      if (!company) {
        console.log(`ℹ️  Company ${cid} not found. Skip demo fixtures.`);
        await trx.commit();
        return;
      }

      const now = new Date();

      // 1) департаменты
      const salesId = uuidv4();
      const supportId = uuidv4();
      await queryInterface.sequelize.query(
        `INSERT INTO company_departments (id, company_id, name, description, created_at, updated_at)
         VALUES 
           (:salesId,   :cid, 'Sales',   'Sales dept',   :now, :now),
           (:supportId, :cid, 'Support', 'Support dept', :now, :now)`,
        { replacements: { salesId, supportId, cid, now }, transaction: trx }
      );

      // 2) контрагент (ACME)
      const counterpartyId = uuidv4();
      await queryInterface.sequelize.query(
        `INSERT INTO counterparties (id, company_id, full_name, short_name, is_company, city, description, created_at, updated_at)
         VALUES (:id, :cid, 'ACME Sp. z o.o.', 'ACME', true, 'Warszawa', 'Key client for demo', :now, :now)`,
        { replacements: { id: counterpartyId, cid, now }, transaction: trx }
      );

      // 3) контактные точки для контрагента
      await queryInterface.sequelize.query(
        `INSERT INTO contact_points (id, company_id, owner_type, owner_id, channel, value_raw, value_norm, label, is_primary, is_public, created_at, updated_at)
         VALUES 
           (:p1, :cid, 'counterparty', :owner, 'phone', '+48 111 222 333', '+48111222333', 'Main',  true,  true, :now, :now),
           (:p2, :cid, 'counterparty', :owner, 'email', 'contact@acme.pl', 'contact@acme.pl', 'Sales', true,  true, :now, :now)`,
        { replacements: { p1: uuidv4(), p2: uuidv4(), cid, owner: counterpartyId, now }, transaction: trx }
      );

      await trx.commit();
      console.log(`✅ Demo fixtures inserted for company ${cid}.`);
    } catch (e) {
      await trx.rollback();
      console.error('❌ Demo fixtures seed failed:', e);
      throw e;
    }
  },

  async down(queryInterface) {
    const cid = process.env.SEED_COMPANY_ID;
    if (!cid) {
      console.log('ℹ️  SEED_COMPANY_ID is not set. Nothing to undo.');
      return;
    }

    // Удаляем только то, что вставили выше
    await queryInterface.sequelize.query(
      `DELETE FROM contact_points WHERE company_id = :cid AND owner_type = 'counterparty' AND owner_id IN (
         SELECT id FROM counterparties WHERE company_id = :cid AND short_name = 'ACME'
       )`,
      { replacements: { cid } }
    );

    await queryInterface.bulkDelete('counterparties', { company_id: cid, short_name: 'ACME' }, {});
    await queryInterface.bulkDelete('company_departments', { company_id: cid, name: ['Sales','Support'] }, {});

    console.log(`♻️  Demo fixtures removed for company ${cid}.`);
  }
};
