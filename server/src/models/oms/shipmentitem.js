'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ShipmentItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ShipmentItem.init({
    shipmentId: DataTypes.UUID,
    orderItemId: DataTypes.UUID,
    qty: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'ShipmentItem',
  });
  return ShipmentItem;
};