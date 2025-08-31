'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Coupon extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Coupon.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      Coupon.belongsTo(models.Promotion, { 
        as: 'promotion', 
        foreignKey: 'promotionId' 
      });
    }
  }
  Coupon.init({
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
    code: { 
      type: DataTypes.STRING(64), 
      allowNull: false 
    },
    promotionId: { 
      type: DataTypes.UUID, 
      field: 'promotion_id' 
    },
    usageLimit: { 
      type: DataTypes.INTEGER, 
      field: 'usage_limit' 
    },
    usedCount: { 
      type: DataTypes.INTEGER, 
      field: 'used_count', 
      defaultValue: 0 
    },
    validFrom: { 
      type: DataTypes.DATE, 
      field: 'valid_from' 
    },
    validTo: { 
      type: DataTypes.DATE, 
      field: 'valid_to' 
    },
  }, {
    sequelize,
    modelName: 'Coupon',
    tableName: 'coupons',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Coupon;
};