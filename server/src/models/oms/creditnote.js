'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CreditNote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CreditNote.init({
    invoiceId: DataTypes.UUID,
    amountNet: DataTypes.DECIMAL,
    amountTax: DataTypes.DECIMAL,
    amountGross: DataTypes.DECIMAL,
    reason: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'CreditNote',
  });
  return CreditNote;
};