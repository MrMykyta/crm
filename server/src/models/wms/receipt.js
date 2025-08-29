'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Receipt extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Receipt.hasMany(models.ReceiptItem,{ 
        foreignKey:'receipt_id', 
        as:'items' 
      });
    }
  }
  Receipt.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'company_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Assuming warehouses are linked to a company
      field:'warehouse_id' 
    },
    number:{ 
      type:DataTypes.STRING(64), 
      allowNull:false 
    },
    status:{ 
      type:DataTypes.ENUM('draft','received','putaway'), 
      allowNull:false,  // Assuming receipts have statuses such as draft, received, putaway
      defaultValue:'draft' 
    },
    inboundLocationId:{ 
      type:DataTypes.UUID, 
      field:'inbound_location_id' 
    },
  }, {
    sequelize,
    modelName: 'Receipt',
    tableName:'receipts', 
    underscored:true, 
    timestamps:true
  });
  return Receipt;
};