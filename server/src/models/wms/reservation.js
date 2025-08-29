'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Reservation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Reservation.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Assuming companyId is unique per company
      field:'company_id' 
    },
    orderId:{ 
      type:DataTypes.UUID, 
      allowNull:false,  // Assuming orderId is unique per order
      field:'order_id' 
    },
    orderItemId:{ 
      type:DataTypes.UUID, 
      allowNull:false,  // Assuming orderItemId is unique per order item
      field:'order_item_id' 
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      allowNull:false,  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId is unique per warehouse and per product variant combination  // Assuming warehouseId
      field:'warehouse_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per product variant combination  // Assuming productId is unique per
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    qty:{ 
      type:DataTypes.DECIMAL,
      allowNull:false,
      defaultValue:0 
    },
    status:{ 
      type:DataTypes.ENUM('active','fulfilled','cancelled'), 
      allowNull: false,  // Assuming status is unique per reservation  // Assuming status is unique per reservation  // Assuming status is unique per reservation  // Assuming status is unique per reservation 
      defaultValue:'active' 
    },
  }, {
    sequelize,
    modelName: 'Reservation',
    tableName:'reservations', 
    underscored:true, 
    timestamps:true
  });
  return Reservation;
};