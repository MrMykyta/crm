'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductSupplier extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductSupplier.belongsTo(models.Product, { 
        foreignKey:'product_id', 
        as:'product' 
      });
      ProductSupplier.belongsTo(models.ProductVariant, { 
        foreignKey:'variant_id', 
        as:'variant' 
      });
      ProductSupplier.belongsTo(models.Counterparty, { 
        foreignKey:'supplier_id', 
        as:'supplier' 
      }); // из CRM
    }
  }
  ProductSupplier.init({
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
    productId:{ 
      type:DataTypes.UUID, 
      field:'product_id' 
    },
    variantId:{ 
      type:DataTypes.UUID, 
      field:'variant_id' 
    },
    supplierId:{ 
      type:DataTypes.UUID, 
      allowNull:false, 
      field:'supplier_id' 
    },
    supplierSku:{ 
      type:DataTypes.STRING(128), 
      field:'supplier_sku' 
    },
    currency:{
      type: DataTypes.STRING(3),
      defaultValue: 'PLN' 
    }, 
    price:{
      type: DataTypes.DECIMAL(14,2),
      defaultValue: 0
    },
    moq:{
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    leadTimeDays:{ 
      type:DataTypes.INTEGER, 
      field:'lead_time_days',
      defaultValue: 0
    },
    packSize:{ 
      type:DataTypes.INTEGER, 
      field:'pack_size',
      defaultValue: 1
    }, 
    url:{
      type: DataTypes.STRING(512)
    }
  }, {
    sequelize,
    modelName: 'ProductSupplier',
    tableName: 'product_suppliers',
    underscored: true, 
    timestamps: true
  });
  return ProductSupplier;
};