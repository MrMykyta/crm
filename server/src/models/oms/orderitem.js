'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  OrderItem.init({
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
    orderId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'order_id' 
    },
    variantId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'variant_id' 
    },
    uomId: { 
      type: DataTypes.UUID, 
      field: 'uom_id' 
    },
    sku: { 
      type: DataTypes.STRING(64) 
    },
    nameSnapshot: { 
      type: DataTypes.STRING(512), 
      field: 'name_snapshot' 
    },
    qty: { 
      type: DataTypes.DECIMAL(14,3), 
      allowNull: false, 
      defaultValue: 1 
    },
    priceNet: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'price_net' 
    },
    priceGross: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'price_gross' 
    },
    taxRate: { 
      type: DataTypes.DECIMAL(5,2), 
      allowNull: false, 
      field: 'tax_rate', 
      defaultValue: 0 
    },
    discountAmount: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'discount_amount', 
      defaultValue: 0 
    },
    priceListItemId: { 
      type: DataTypes.UUID, 
      field: 'price_list_item_id' 
    },
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'order_items',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return OrderItem;
};