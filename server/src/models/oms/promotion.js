'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Promotion extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Promotion.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      Promotion.hasMany(models.Coupon, { 
        as: 'coupons', 
        foreignKey: 'promotionId' 
      });
    }
  }
  Promotion.init({
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
    type: { 
      type: DataTypes.ENUM('percentage','fixed','shipping_free'), 
      allowNull: false 
    },
    value: { 
      type: DataTypes.DECIMAL(12,4) 
    },
    conditionsJson: { 
      type: DataTypes.JSONB, 
      field: 'conditions_json' 
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
    modelName: 'Promotion',
    tableName: 'promotions',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Promotion;
};