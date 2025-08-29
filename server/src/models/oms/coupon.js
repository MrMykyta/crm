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
    }
  }
  Coupon.init({
    companyId: DataTypes.UUID,
    code: DataTypes.STRING,
    promotionId: DataTypes.UUID,
    usageLimit: DataTypes.INTEGER,
    usedCount: DataTypes.INTEGER,
    validFrom: DataTypes.DATE,
    validTo: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Coupon',
  });
  return Coupon;
};