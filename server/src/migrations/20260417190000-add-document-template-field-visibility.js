'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'document_template_settings';

    const fields = [
      ['show_seller_name', true],
      ['show_seller_address', true],
      ['show_seller_postal_city', true],
      ['show_seller_country', true],
      ['show_seller_nip', true],
      ['show_seller_email', true],
      ['show_seller_phone', true],
      ['show_seller_bank', true],
      ['show_seller_bank_account', true],
      ['show_seller_website', true],
      ['show_buyer_name', true],
      ['show_buyer_address', true],
      ['show_buyer_postal_city', true],
      ['show_buyer_country', true],
      ['show_buyer_nip', true],
      ['show_buyer_email', true],
      ['show_buyer_phone', true],
    ];

    for (const [columnName, defaultValue] of fields) {
      await queryInterface.addColumn(tableName, columnName, {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'document_template_settings';
    const fields = [
      'show_seller_name',
      'show_seller_address',
      'show_seller_postal_city',
      'show_seller_country',
      'show_seller_nip',
      'show_seller_email',
      'show_seller_phone',
      'show_seller_bank',
      'show_seller_bank_account',
      'show_seller_website',
      'show_buyer_name',
      'show_buyer_address',
      'show_buyer_postal_city',
      'show_buyer_country',
      'show_buyer_nip',
      'show_buyer_email',
      'show_buyer_phone',
    ];

    for (const columnName of fields) {
      await queryInterface.removeColumn(tableName, columnName);
    }
  },
};
