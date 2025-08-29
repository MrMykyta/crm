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
    }
  }
  Promotion.init({
    companyId: DataTypes.UUID,
    type: DataTypes.STRING,
    value: DataTypes.DECIMAL,
    conditionsJson: DataTypes.JSON,
    validFrom: DataTypes.DATE,
    validTo: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Promotion',
  });
  return Promotion;
};