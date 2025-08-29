'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Adjustment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Adjustment.hasMany(models.AdjustmentItem,{ 
        foreignKey:'adjustment_id', 
        as:'items' 
      });
    }
  }
  Adjustment.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'company_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // This field is required
      field:'warehouse_id' 
    },
    reason:{ 
      type:DataTypes.STRING(160) 
    },
  }, {
    sequelize,
    modelName: 'Adjustment',
    tableName:'adjustments', 
    underscored:true, 
    timestamps:true
  });
  return Adjustment;
};