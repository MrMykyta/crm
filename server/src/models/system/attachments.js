'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Attachments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Attachments.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    ownerType: { 
      type: DataTypes.ENUM('counterparty','deal','task','order','offer','product','contact','user','company','department'),
      allowNull:false, 
      field:'owner_type' 
    },
    ownerId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'owner_id' 
    },
    filename: { 
      type: DataTypes.STRING(255), 
      allowNull:false 
    },
    mime: { 
      type: DataTypes.STRING(128), 
      allowNull:false 
    },
    size: { 
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue:0 
    },
    storagePath: { 
      type: DataTypes.STRING(512), 
      allowNull:false, 
      field:'storage_path' 
    },
    uploadedBy: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'uploaded_by' 
    },
    createdAt: {
      type: DataTypes.DATE, 
      allowNull: false, 
      field:'created_at'
    },
    updatedAt: {
      type: DataTypes.DATE, 
      allowNull: false, 
      field:'updated_at'
    }
  }, {
    sequelize,
    modelName: 'Attachments',
    tableName: 'attachments',
    timestamps: true,
    underscored: true,
    paranoid: true
  });
  return Attachments;
};