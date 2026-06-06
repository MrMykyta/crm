'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Adjustment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Adjustment.hasMany(models.AdjustmentItem, {
        foreignKey: { name: 'adjustmentId', field: 'adjustment_id' },
        as: 'items',
      });
    }
  }
  Adjustment.init({
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
    warehouseId:{ 
      type:DataTypes.UUID,
      allowNull:false,  // This field is required
      field:'warehouse_id' 
    },
    number: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    documentType: {
      type: DataTypes.ENUM('RW', 'PW'),
      allowNull: false,
      field: 'document_type',
    },
    reason:{ 
      type:DataTypes.STRING(160) 
    },
    status: {
      type: DataTypes.ENUM('draft', 'posted'),
      allowNull: false,
      defaultValue: 'draft',
    },
    postedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'posted_at',
    },
  }, {
    sequelize,
    modelName: 'Adjustment',
    tableName:'adjustments', 
    underscored:true, 
    timestamps:true
  });
  return Adjustment;
};
