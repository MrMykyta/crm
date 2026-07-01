'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.Company, {
        as: 'company',
        foreignKey: 'companyId',
      });
      Order.belongsTo(models.Offer, {
        as: 'offer',
        foreignKey: 'offerId',
      });
      Order.belongsTo(models.Counterparty, {
        as: 'customer',
        foreignKey: 'customerId',
      });
      Order.belongsTo(models.Counterparty, {
        as: 'counterparty',
        foreignKey: 'customerId',
      });
      Order.belongsTo(models.Contact, {
        as: 'contact',
        foreignKey: 'contactId',
      });
      Order.belongsTo(models.User, {
        as: 'owner',
        foreignKey: 'ownerId',
      });
      Order.belongsTo(models.User, {
        as: 'createdByUser',
        foreignKey: 'createdBy',
      });
      Order.belongsTo(models.User, {
        as: 'updatedByUser',
        foreignKey: 'updatedBy',
      });
      Order.belongsTo(models.Offer, {
        as: 'sourceOffer',
        foreignKey: 'sourceOfferId',
        constraints: false,
      });
      Order.belongsTo(models.ShippingClass, {
        as: 'shippingClass',
        foreignKey: 'shippingClassId',
      });
      Order.belongsTo(models.Channel, {
        as: 'salesChannel',
        foreignKey: 'salesChannelId',
      });

      Order.hasMany(models.OrderItem, {
        as: 'items',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });
      Order.hasMany(models.Payment, {
        as: 'payments',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });
      Order.hasMany(models.Invoice, {
        as: 'invoices',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });
      Order.hasMany(models.Shipment, {
        as: 'shipments',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });
      Order.hasMany(models.OrderEvent, {
        as: 'events',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });
      Order.hasMany(models.OrderNote, {
        as: 'orderNotes',
        foreignKey: 'orderId',
        onDelete: 'CASCADE',
      });

      Order.hasMany(models.Discount, {
        as: 'discounts',
        foreignKey: 'ownerId',
        scope: { ownerType: 'order' },
      });
    }
  }

  Order.init({
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
    number: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    offerId: {
      type: DataTypes.UUID,
      field: 'offer_id',
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'customer_id',
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
    salesChannelId: {
      type: DataTypes.UUID,
      field: 'sales_channel_id',
    },
    shippingClassId: {
      type: DataTypes.UUID,
      field: 'shipping_class_id',
    },
    currencyCode: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'currency_code',
    },
    status: {
      type: DataTypes.ENUM('draft', 'new', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled', 'returned'),
      defaultValue: 'draft',
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'partially_paid', 'paid', 'refunded', 'partially_refunded'),
      field: 'payment_status',
      defaultValue: 'pending',
    },
    fulfillmentStatus: {
      type: DataTypes.ENUM('unfulfilled', 'partial', 'fulfilled'),
      field: 'fulfillment_status',
      defaultValue: 'unfulfilled',
    },
    placedAt: {
      type: DataTypes.DATE,
      field: 'placed_at',
    },
    confirmedAt: {
      type: DataTypes.DATE,
      field: 'confirmed_at',
    },
    shippedAt: {
      type: DataTypes.DATE,
      field: 'shipped_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      field: 'completed_at',
    },
    cancelledAt: {
      type: DataTypes.DATE,
      field: 'cancelled_at',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    sourceOfferId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'source_offer_id',
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
    totalNet: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_net',
      defaultValue: 0,
    },
    totalTax: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_tax',
      defaultValue: 0,
    },
    totalGross: {
      type: DataTypes.DECIMAL(14, 2),
      field: 'total_gross',
      defaultValue: 0,
    },
    counterpartyId: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('customerId');
      },
      set(value) {
        this.setDataValue('customerId', value);
      },
    },
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return Order;
};
