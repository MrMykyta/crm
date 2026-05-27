'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DocumentTemplateSetting extends Model {
    static associate(models) {
      DocumentTemplateSetting.belongsTo(models.Company, {
        as: 'company',
        foreignKey: { name: 'companyId', field: 'company_id' },
      });
    }
  }

  DocumentTemplateSetting.init(
    {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
      documentType: { type: DataTypes.STRING(32), allowNull: false, field: 'document_type' },
      templatePreset: { type: DataTypes.STRING(64), allowNull: false, field: 'template_preset' },
      documentTitleOverride: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '', field: 'document_title_override' },
      layoutDensity: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'comfortable', field: 'layout_density' },
      sectionOrder: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'section_order' },
      showLogo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'show_logo' },
      showSellerBlock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_block' },
      showBuyerBlock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_block' },
      showPaymentBlock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'show_payment_block' },
      showNotesBlock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_notes_block' },
      showSourceReference: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'show_source_reference' },
      showVatSummary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_vat_summary' },
      showStatusBadge: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_status_badge' },
      showTermsBlock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_terms_block' },
      showSellerName: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_name' },
      showSellerAddress: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_address' },
      showSellerPostalCity: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'show_seller_postal_city',
      },
      showSellerCountry: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_country' },
      showSellerNip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_nip' },
      showSellerEmail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_email' },
      showSellerPhone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_phone' },
      showSellerBank: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_bank' },
      showSellerBankAccount: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'show_seller_bank_account',
      },
      showSellerWebsite: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_seller_website' },
      showBuyerName: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_name' },
      showBuyerAddress: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_address' },
      showBuyerPostalCity: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'show_buyer_postal_city',
      },
      showBuyerCountry: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_country' },
      showBuyerNip: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_nip' },
      showBuyerEmail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_email' },
      showBuyerPhone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'show_buyer_phone' },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'updated_at' },
    },
    {
      sequelize,
      modelName: 'DocumentTemplateSetting',
      tableName: 'document_template_settings',
      underscored: true,
      timestamps: true,
    }
  );

  return DocumentTemplateSetting;
};
