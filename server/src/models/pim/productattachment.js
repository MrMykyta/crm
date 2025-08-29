'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ProductAttachment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ProductAttachment.belongsTo(models.Product, { 
        foreignKey: 'product_id' 
      });
      ProductAttachment.belongsTo(models.Attachments, { 
        foreignKey: 'attachment_id' 
      });
    }
  }
  ProductAttachment.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    productId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'product_id' 
    },
    attachmentId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'attachment_id' 
    },
    role: {
      type: DataTypes.ENUM('image','manual','spec','other'), 
      allowNull:false, 
      defaultValue:'image' 
    },
    sortOrder: { 
      type: DataTypes.INTEGER,
      allowNull: false,
      field:'sort_order', 
      defaultValue:0 
    }
  }, {
    sequelize,
    modelName: 'ProductAttachment',
    tableName: 'product_attachments',
    underscored: true,
    timestamps: true
  });
  return ProductAttachment;
};