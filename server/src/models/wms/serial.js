'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Serial extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Serial.init({
    id:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      primaryKey:true,
      defaultValue: DataTypes.UUIDV4,
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'company_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'product_id' 
    },
    serialNumber:{ 
      type:DataTypes.STRING,
      allowNull:false,
      field:'serial_number' 
    }
  }, {
    sequelize,
    modelName: 'Serial',
    tableName:'serials', 
    underscored:true, 
    timestamps:true
  });
  return Serial;
};