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
    }
  }
  Discount.init({
    companyId: DataTypes.UUID,
    ownerType: DataTypes.STRING,
    ownerId: DataTypes.UUID,
    type: DataTypes.STRING,
    amountNet: DataTypes.DECIMAL,
    amountGross: DataTypes.DECIMAL,
    metaJson: DataTypes.JSON
  }, {
    sequelize,
    modelName: 'Discount',
  });
  return Discount;
};