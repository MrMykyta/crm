'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Shipment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Shipment.hasMany(models.ShipmentItem,{
        foreignKey:'shipment_id',
        as:'items'
      });
      Shipment.hasMany(models.Parcel,{
        foreignKey:'shipment_id',
        as:'parcels'
      });
      Shipment.belongsTo(models.Warehouse, {
        as: 'warehouse',
        foreignKey: { name: 'warehouseId', field: 'warehouse_id' },
      });
      Shipment.belongsTo(models.Order, {
        as: 'order',
        foreignKey: { name: 'orderId', field: 'order_id' },
      });
      // K1: self-references for correction documents (WZ_KOREKTA).
      Shipment.belongsTo(models.Shipment, {
        as: 'parentDocument',
        foreignKey: { name: 'parentDocumentId', field: 'parent_document_id' },
      });
      Shipment.belongsTo(models.Shipment, {
        as: 'correctedBy',
        foreignKey: { name: 'correctedById', field: 'corrected_by_id' },
      });
      Shipment.hasMany(models.Shipment, {
        as: 'corrections',
        foreignKey: { name: 'parentDocumentId', field: 'parent_document_id' },
      });
    }
  }
  Shipment.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:{ 
      type:DataTypes.UUID, 
      field:'company_id',
      allowNull:false
    },
    warehouseId:{ 
      type:DataTypes.UUID, 
      field:'warehouse_id',
      allowNull:false 
    },
    orderId:{ 
      type:DataTypes.UUID, 
      field:'order_id',
    },
    number:{
      type:DataTypes.STRING(100),
      allowNull:true,
    },
    status:{
      // K1: 'cancelled' is reserved for packing→cancelled (before posting).
      // After 'shipped', the only way to revert is via WZ_KOREKTA, which sets status to 'corrected'.
      type:DataTypes.ENUM('packing','shipped','cancelled','corrected'),
      allowNull:false,
      defaultValue:'packing'
    },
    parentDocumentId: {
      // K1: link from a correction document (WZ_KOREKTA) back to the original WZ it corrects.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_document_id',
    },
    correctedById: {
      // K1: forward-link on a WZ to the correction (WZ_KOREKTA) that supersedes it.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'corrected_by_id',
    },
  }, {
    sequelize,
    modelName: 'Shipment',
    tableName:'shipments',
    underscored: true, 
    timestamps: true
  });
  return Shipment;
};
