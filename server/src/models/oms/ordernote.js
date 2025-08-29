'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderNote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  OrderNote.init({
    orderId: DataTypes.UUID,
    authorId: DataTypes.UUID,
    note: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'OrderNote',
  });
  return OrderNote;
};