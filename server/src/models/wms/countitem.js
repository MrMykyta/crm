'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CountItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  CountItem.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    countId:{ 
      type:DataTypes.UUID,
      allowNull:false, 
      field:'count_id' 
    },
    locationId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // This field is required in the database schema
      field:'location_id' 
    },
    productId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // This field is required in the database schema
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
    qtyCounted:{ 
      type:DataTypes.DECIMAL, 
      allowNull:false,  // This field is required in the database schema
      field:'qty_counted' 
    },
  }, {
    sequelize,
    modelName: 'CountItem',
    tableName:'count_items', 
    underscored:true, 
    timestamps:true
  });
  return CountItem;
};