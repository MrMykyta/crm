'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PackagingUnit extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PackagingUnit.belongsTo(models.Product, { 
        foreignKey:'product_id', 
        as:'product' 
      });
      PackagingUnit.belongsTo(models.ProductVariant, { 
        foreignKey:'variant_id', 
        as:'variant' 
      });
      PackagingUnit.belongsTo(models.Uom, { 
        foreignKey:'uom_id', 
        as:'uom' 
      });
    }
  }
  PackagingUnit.init({
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
    productId:{ 
      type:DataTypes.UUID, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    level:{ 
      type:DataTypes.ENUM('unit','inner','case','pallet'),
      allowNull:false, 
    },
    quantity:{
      type:DataTypes.INTEGER,
      allowNull:false,
      defaultValue: 1
    }, 
    gtin14:{
      type: DataTypes.STRING(20)
    },
    weight:{
      type: DataTypes.DECIMAL(12,3)
    }, 
    length:{
      type: DataTypes.DECIMAL(12,3)
    }, 
    width:{
      type: DataTypes.DECIMAL(12,3)
    }, 
    height:{
      type: DataTypes.DECIMAL(12,3)
    },
    uomId:{ 
      type:DataTypes.UUID, 
      field:'uom_id' 
    }
  }, {
    sequelize,
    modelName: 'PackagingUnit',
    tableName: 'packaging_units',
    underscored: true,
    timestamps: true
  });
  return PackagingUnit;
};