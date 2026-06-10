'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class TransferOrder extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      TransferOrder.hasMany(models.TransferItem,{ 
        foreignKey:{ name:'transferId', field:'transfer_id' }, 
        as:'items' 
      });
      TransferOrder.belongsTo(models.Warehouse, {
        as: 'sourceWarehouse',
        foreignKey: { name: 'fromWarehouseId', field: 'from_warehouse_id' },
      });
      TransferOrder.belongsTo(models.Warehouse, {
        as: 'targetWarehouse',
        foreignKey: { name: 'toWarehouseId', field: 'to_warehouse_id' },
      });
      TransferOrder.belongsTo(models.Location, {
        as: 'sourceLocation',
        foreignKey: { name: 'sourceLocationId', field: 'source_location_id' },
      });
      TransferOrder.belongsTo(models.Location, {
        as: 'targetLocation',
        foreignKey: { name: 'targetLocationId', field: 'target_location_id' },
      });
    }
  }
  TransferOrder.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull: false,  // required
      field:'company_id' 
    },
    number:{ 
      type:DataTypes.STRING(64), 
      allowNull:false 
    },
    fromWarehouseId:{ 
      type:DataTypes.UUID, 
      field:'from_warehouse_id',
      allowNull:false 
    },
    toWarehouseId:{
      type:DataTypes.UUID,
      field:'to_warehouse_id',
      allowNull:false
    },
    sourceLocationId:{
      type:DataTypes.UUID,
      field:'source_location_id',
      allowNull:true
    },
    targetLocationId:{
      type:DataTypes.UUID,
      field:'target_location_id',
      allowNull:true
    },
    status:{
      type:DataTypes.ENUM('draft','in_transit','received'), 
      allowNull: false,  // required, default value is 'draft' 
      defaultValue:'draft' 
    },
  }, {
    sequelize,
    modelName: 'TransferOrder',
    tableName:'transfer_orders', 
    underscored:true, 
    timestamps:true
  });
  return TransferOrder;
};
