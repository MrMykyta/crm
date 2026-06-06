'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
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
        foreignKey:{ name:'receiptId', field:'receipt_id' },
        as:'items'
      });
      // K1: self-references for correction documents (PZ_KOREKTA).
      Receipt.belongsTo(models.Receipt, {
        as: 'parentDocument',
        foreignKey: { name: 'parentDocumentId', field: 'parent_document_id' },
      });
      Receipt.belongsTo(models.Receipt, {
        as: 'correctedBy',
        foreignKey: { name: 'correctedById', field: 'corrected_by_id' },
      });
      Receipt.hasMany(models.Receipt, {
        as: 'corrections',
        foreignKey: { name: 'parentDocumentId', field: 'parent_document_id' },
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
      // K1: 'corrected' is set when a PZ_KOREKTA supersedes this receipt; the doc becomes immutable.
      type:DataTypes.ENUM('draft','received','putaway','corrected'),
      allowNull:false,
      defaultValue:'draft'
    },
    inboundLocationId:{
      type:DataTypes.UUID,
      field:'inbound_location_id'
    },
    parentDocumentId: {
      // K1: link from a correction document (PZ_KOREKTA) back to the original PZ it corrects.
      // Null on regular PZ. FK ON DELETE RESTRICT — cannot delete a PZ that has a correction.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'parent_document_id',
    },
    correctedById: {
      // K1: forward-link on a PZ to the correction (PZ_KOREKTA) that supersedes it.
      // Set when the correction is posted; ENUM status 'corrected' goes hand-in-hand.
      type: DataTypes.UUID,
      allowNull: true,
      field: 'corrected_by_id',
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
