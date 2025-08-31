'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Order.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      Order.belongsTo(models.Offer, { 
        as: 'offer', 
        foreignKey: 'offerId' 
      });
      Order.belongsTo(models.Counterparty, { 
        as: 'customer', 
        foreignKey: 'customerId' 
      });
      Order.belongsTo(models.ShippingClass, { 
        as: 'shippingClass', 
        foreignKey: 'shippingClassId' 
      });
      Order.belongsTo(models.Channel, { 
        as: 'salesChannel', 
        foreignKey: 'salesChannelId' 
      });

      Order.hasMany(models.OrderItem, { 
        as: 'items', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });
      Order.hasMany(models.Payment, { 
        as: 'payments', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });
      Order.hasMany(models.Invoice, { 
        as: 'invoices', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });
      Order.hasMany(models.Shipment, { 
        as: 'shipments', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });
      Order.hasMany(models.OrderEvent, { 
        as: 'events', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });
      Order.hasMany(models.OrderNote, { 
        as: 'notes', 
        foreignKey: 'orderId', 
        onDelete: 'CASCADE' 
      });

      Order.hasMany(models.Discount, { 
        as: 'discounts', 
        foreignKey: 'ownerId', 
        scope: { ownerType: 'order' } 
      });
    }
  }
  Order.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    offerId: { 
      type: DataTypes.UUID, 
      field: 'offer_id' 
    },
    customerId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'customer_id' 
    },
    salesChannelId: { 
      type: DataTypes.UUID, 
      field: 'sales_channel_id' 
    },
    shippingClassId: { 
      type: DataTypes.UUID, 
      field: 'shipping_class_id' 
    },
    currencyCode: { 
      type: DataTypes.STRING(3), 
      allowNull: false, 
      field: 'currency_code' 
    },
    status: { 
      type: DataTypes.ENUM('draft','new','confirmed','paid','shipped','completed','cancelled','returned'), 
      defaultValue: 'draft' 
    },
    paymentStatus: { 
      type: DataTypes.ENUM('pending','paid','refunded','partially_refunded'), 
      field: 'payment_status', 
      defaultValue: 'pending' 
    },
    fulfillmentStatus: { 
      type: DataTypes.ENUM('unfulfilled','partial','fulfilled'), 
      field: 'fulfillment_status', 
      defaultValue: 'unfulfilled' 
    },
    placedAt: { 
      type: DataTypes.DATE, 
      field: 'placed_at' 
    },
    confirmedAt: { 
      type: DataTypes.DATE, 
      field: 'confirmed_at' 
    },
    shippedAt: { 
      type: DataTypes.DATE, 
      field: 'shipped_at' 
    },
    completedAt: { 
      type: DataTypes.DATE, 
      field: 'completed_at' 
    },
    cancelledAt: { 
      type: DataTypes.DATE, 
      field: 'cancelled_at' 
    },
    totalNet: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_net', 
      defaultValue: 0 
    },
    totalTax: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_tax', 
      defaultValue: 0 
    },
    totalGross: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_gross', 
      defaultValue: 0 
    },
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Order;
};