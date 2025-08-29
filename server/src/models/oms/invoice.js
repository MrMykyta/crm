'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Invoice.init({
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
    number: { 
      type: DataTypes.STRING(64), 
      allowNull: false 
    },
    issueDate: { 
      type: DataTypes.DATE, 
      field: 'issue_date' 
    },
    dueDate: { 
      type: DataTypes.DATE, 
      field: 'due_date' 
    },
    paidDate: { 
      type: DataTypes.DATE, 
      field: 'paid_date' 
    },
    totalNet: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_net', 
      defaultValue: 0 
    },
    totalTax: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_tax', 
      defaultValue: 0 
    },
    totalGross: { 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_gross', 
      defaultValue: 0 
    },
  }, {
    sequelize,
    modelName: 'Invoice',
    tableName: 'invoices',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Invoice;
};