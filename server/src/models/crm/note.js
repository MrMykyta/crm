'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Note extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Note.belongsTo(models.Company, { 
        foreignKey:'companyId' 
      });
      Note.belongsTo(models.User, { 
        foreignKey:'authorUserId', 
        as:'author' 
      });
    }
  }
  Note.init({
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
    authorUserId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'author_user_id' 
    },
    visibility: { 
      type: DataTypes.ENUM('private','company'), 
      allowNull:false, 
      defaultValue:'company' 
    },
    content: { 
      type: DataTypes.TEXT, 
      allowNull:false 
    },
    pinned: { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:false 
    },
    createdAt: {
      type: DataTypes.DATE, 
      allowNull: false,
      field:'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE, 
      allowNull: false,
      field:'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Note',
    tableName: 'notes',
    underscored: true,
    paranoid: true
  });
  return Note;
};