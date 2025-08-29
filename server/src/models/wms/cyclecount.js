'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CycleCount extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CycleCount.hasMany(models.CountItem,{ 
        foreignKey:'count_id', 
        as:'items' 
      });
    }
  }
  CycleCount.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Указываем, что поле companyId является первичным ключом
      field:'company_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Указываем, что поле warehouseId является первичным ключом
      field:'warehouse_id' 
    },
    status:{ 
      type:DataTypes.ENUM('planned','counting','reconciled'), 
      allowNull:false,  // Указываем, что поле status является обязательным
      defaultValue:'planned' 
    },
  }, {
    sequelize,
    modelName: 'CycleCount',
    tableName:'cycle_counts', 
    underscored:true, 
    timestamps:true
  });
  return CycleCount;
};