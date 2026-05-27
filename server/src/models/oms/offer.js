'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Offer extends Model {
    static associate(models) {
      Offer.belongsTo(models.Company, {
        as: 'company',
        foreignKey: 'companyId',
      });

      Offer.belongsTo(models.Counterparty, {
        as: 'counterparty',
        foreignKey: 'counterpartyId',
      });
      Offer.belongsTo(models.Counterparty, {
        as: 'customer',
        foreignKey: 'counterpartyId',
      });
      Offer.belongsTo(models.Contact, {
        as: 'contact',
        foreignKey: 'contactId',
      });
      Offer.belongsTo(models.User, {
        as: 'owner',
        foreignKey: 'ownerId',
      });
      Offer.belongsTo(models.User, {
        as: 'createdByUser',
        foreignKey: 'createdBy',
      });
      Offer.belongsTo(models.User, {
        as: 'updatedByUser',
        foreignKey: 'updatedBy',
      });
      Offer.belongsTo(models.User, {
        as: 'acceptedByUser',
        foreignKey: 'acceptedBy',
      });
      Offer.belongsTo(models.User, {
        as: 'rejectedByUser',
        foreignKey: 'rejectedBy',
      });
      Offer.belongsTo(models.User, {
        as: 'sentByUser',
        foreignKey: 'sentBy',
      });
      Offer.belongsTo(models.User, {
        as: 'viewedByUser',
        foreignKey: 'viewedBy',
      });
      Offer.belongsTo(models.User, {
        as: 'cancelledByUser',
        foreignKey: 'cancelledBy',
      });
      Offer.belongsTo(models.User, {
        as: 'convertedByUser',
        foreignKey: 'convertedBy',
      });
      Offer.belongsTo(models.User, {
        as: 'lockedByUser',
        foreignKey: 'lockedBy',
      });
      Offer.belongsTo(models.Deal, {
        as: 'deal',
        foreignKey: 'dealId',
      });
      Offer.belongsTo(models.Order, {
        as: 'convertedOrder',
        foreignKey: 'convertedOrderId',
        constraints: false,
      });

      Offer.hasMany(models.OfferItem, {
        as: 'items',
        foreignKey: 'offerId',
        onDelete: 'CASCADE',
      });
      Offer.hasMany(models.Discount, {
        as: 'discounts',
        foreignKey: 'ownerId',
        scope: { ownerType: 'offer' },
      });
      Offer.hasMany(models.Order, {
        as: 'orders',
        foreignKey: 'offerId',
      });
    }
  }

  Offer.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'company_id',
    },
    counterpartyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'counterparty_id',
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'contact_id',
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'owner_id',
    },
    dealId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'deal_id',
    },
    number: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    issueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'issue_date',
    },
    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'valid_until',
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'currency_code',
      defaultValue: 'PLN',
    },
    exchangeRate: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
      field: 'exchange_rate',
    },
    sourceType: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'source_type',
    },
    sourceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'source_id',
    },
    totalNet: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_net',
      allowNull: false,
      defaultValue: 0,
    },
    totalTax: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_tax',
      allowNull: false,
      defaultValue: 0,
    },
    totalGross: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_gross',
      allowNull: false,
      defaultValue: 0,
    },
    discountTotal: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'discount_total',
    },
    roundingTotal: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
      defaultValue: 0,
      field: 'rounding_total',
    },
    itemsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'items_count',
    },
    linesCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'lines_count',
    },
    paymentTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'payment_terms',
    },
    deliveryTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'delivery_terms',
    },
    leadTime: {
      type: DataTypes.STRING(128),
      allowNull: true,
      field: 'lead_time',
    },
    incoterms: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'internal_notes',
    },
    billingAddressSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'billing_address_snapshot',
    },
    shippingAddressSnapshot: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'shipping_address_snapshot',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by',
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by',
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'accepted_at',
    },
    acceptedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'accepted_by',
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'rejected_at',
    },
    rejectedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'rejected_by',
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'sent_at',
    },
    sentBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'sent_by',
    },
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'viewed_at',
    },
    viewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'viewed_by',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cancelled_at',
    },
    cancelledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'cancelled_by',
    },
    convertedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'converted_at',
    },
    convertedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'converted_by',
    },
    convertedOrderId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'converted_order_id',
    },
    lastStatusChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_status_changed_at',
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_at',
    },
    lockedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'locked_by',
    },
    revision: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    customerId: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('counterpartyId');
      },
      set(value) {
        this.setDataValue('counterpartyId', value);
      },
    },
    currencyCode: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('currency');
      },
      set(value) {
        this.setDataValue('currency', value);
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      field: 'updated_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  }, {
    sequelize,
    modelName: 'Offer',
    tableName: 'offers',
    paranoid: true,
    timestamps: true,
    underscored: true,
  });

  return Offer;
};
