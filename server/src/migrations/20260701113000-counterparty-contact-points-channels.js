'use strict';

const CHANNELS = [
  'messenger',
  'instagram',
  'youtube',
  'tiktok',
  'custom',
];

module.exports = {
  async up(queryInterface) {
    for (const channel of CHANNELS) {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          ALTER TYPE "enum_contact_points_channel" ADD VALUE IF NOT EXISTS '${channel}';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  },

  async down() {
    // PostgreSQL enum values cannot be removed safely without rebuilding the type.
  },
};
