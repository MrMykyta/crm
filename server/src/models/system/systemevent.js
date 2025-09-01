'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SystemEvent extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      SystemEvent.belongsTo(models.Company, {
        foreignKey: 'company_id',
        as: 'company',
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE'
      });
    }
  }
  SystemEvent.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true,
      allowNull:false, 
      defaultValue:DataTypes.UUIDV4  
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    type: { 
      type: DataTypes.STRING(128), 
      allowNull:false 
    },
    entityType: { 
      type: DataTypes.STRING(64), 
      allowNull:true, 
      field:'entity_type' 
    },
    entityId: { 
      type: DataTypes.UUID, 
      allowNull:true, 
      field:'entity_id' 
    },
    payload: { 
      type: DataTypes.JSONB, 
      allowNull:true 
    },
    createdAt: { 
      type: DataTypes.DATE, 
      allowNull:false, 
      field:'created_at' 
    }
  }, {
    sequelize,
    modelName: 'SystemEvent',
    tableName:'system_events',
    underscored: true
  });
  return SystemEvent;
};