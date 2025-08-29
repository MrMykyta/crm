'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class InventoryItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      InventoryItem.belongsTo(models.Location, { 
        foreignKey:'location_id', 
        as:'location' 
      });
      InventoryItem.belongsTo(models.Warehouse,{ 
        foreignKey:'warehouse_id', 
        as:'warehouse' 
      });
    }
  }
  InventoryItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set the companyId as the foreign key in the 'InventoryItem' table
      field:'company_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set the warehouseId as the foreign key in the 'InventoryItem' table
      field:'warehouse_id' 
    },
    locationId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set the locationId as the foreign key in the 'InventoryItem' table
      field:'location_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Set the productId as the foreign key in the 'InventoryItem' table
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    lotId:{ 
      type:DataTypes.UUID, 
      field:'lot_id' 
    },
    serialId:{ 
      type:DataTypes.UUID, 
      field:'serial_id' 
    },
    qtyOnHand:{ 
      type:DataTypes.DECIMAL,
      allowNull:false,  // Set the qtyOnHand as the default value for the 'qty_on_hand' column in the 'InventoryItem' table
      field:'qty_on_hand', 
      defaultValue:0 
    },
    qtyReserved:{ 
      type:DataTypes.DECIMAL,
      allowNull:false,  // Set the qtyReserved as the default value for the 'qty_reserved' column in the 'InventoryItem' table
      field:'qty_reserved', 
      defaultValue:0 
    },
  }, {
    sequelize,
    modelName: 'InventoryItem',
    tableName:'inventory_items', 
    underscored:true, 
    timestamps:true
  });
  return InventoryItem;
};