'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Lot extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Lot.init({
    id:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set to false if you want to allow NULL values
      primaryKey:true,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set to false if you want to allow NULL values
      field:'company_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set to false if you want to allow NULL values
      field:'product_id' 
    },
    lotNumber:{ 
      type:DataTypes.STRING(64), 
      allowNull:false, 
      field:'lot_number' 
    },
    mfgDate:{ 
      type:DataTypes.DATE, 
      field:'mfg_date' 
    },
    expDate:{ 
      type:DataTypes.DATE, 
      field:'exp_date' 
    },
  }, {
    sequelize,
    modelName: 'Lot',
    tableName:'lots', 
    underscored:true, 
    timestamps:true
  });
  return Lot;
};