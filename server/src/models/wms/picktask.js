'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PickTask extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PickTask.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4
    },
    waveId:{ 
      type:DataTypes.UUID, 
      allowNull:false,
      field:'wave_id' 
    },
    orderId:{ 
      type:DataTypes.UUID, 
      field:'order_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    fromLocationId:{ 
      type:DataTypes.UUID, 
      allowNull:false,
      field:'from_location_id' 
    },
    toLocationId:{ 
      type:DataTypes.UUID, 
      field:'to_location_id' 
    },
    qty:{ 
      type:DataTypes.DECIMAL(14,4), 
      allowNull:false  
    },
    status:{ 
      type:DataTypes.ENUM('new','done','cancelled'), 
      allowNull: false, 
      defaultValue:'new' 
    },
  }, {
    sequelize,
    modelName: 'PickTask',
    tableName:'pick_tasks', 
    underscored:true, 
    timestamps:true
  });
  return PickTask;
};