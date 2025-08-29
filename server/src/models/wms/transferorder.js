'use strict';
const {
  Model
} = require('sequelize');
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
        foreignKey:'transfer_id', 
        as:'items' 
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