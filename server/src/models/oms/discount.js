'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Discount extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Discount.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });

      // полиморфная связь по ownerType
      Discount.belongsTo(models.Offer, { 
        as: 'offer', 
        foreignKey: 'ownerId', 
        constraints: false 
      });
      Discount.belongsTo(models.OfferItem, { 
        as: 'offerItem', 
        foreignKey: 'ownerId', 
        constraints: false 
      });
      Discount.belongsTo(models.Order, { 
        as: 'order', 
        foreignKey: 'ownerId', 
        constraints: false 
      });
      Discount.belongsTo(models.OrderItem, { 
        as: 'orderItem', 
        foreignKey: 'ownerId', 
        constraints: false 
      });
    }
  }
  Discount.init({
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
    ownerType: { 
      type: DataTypes.ENUM('offer','offerItem','order','orderItem'), 
      allowNull: false, 
      field: 'owner_type' 
    },
    ownerId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'owner_id' 
    },
    type: { 
      type: DataTypes.ENUM('manual','promotion','coupon'), 
      allowNull: false 
    },
    amountNet: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'amount_net', 
      defaultValue: 0 
    },
    amountGross: { 
      type: DataTypes.DECIMAL(14,2), 
      allowNull: false, 
      field: 'amount_gross', 
      defaultValue: 0 
    },
    metaJson: { 
      type: DataTypes.JSONB, 
      field: 'meta_json' 
    },
  }, {
    sequelize,
    modelName: 'Discount',
    tableName: 'discounts',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Discount;
};