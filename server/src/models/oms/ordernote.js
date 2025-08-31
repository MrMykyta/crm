'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class OrderNote extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });

      this.belongsTo(models.Order, { 
        as: 'order', 
        foreignKey: 'orderId' 
      });
      
      this.belongsTo(models.User, { 
        as: 'author', 
        foreignKey: 'authorId' 
      });
    }
  }
  OrderNote.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    orderId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'order_id' 
    },

    authorId: { 
      type: DataTypes.UUID, 
      field: 'author_id' 
    },
    note: { 
      type: DataTypes.TEXT, 
      allowNull: false 
    },
  }, {
    sequelize,
    modelName: 'OrderNote',
    tableName: 'order_notes',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return OrderNote;
};