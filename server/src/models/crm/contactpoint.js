'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ContactPoint extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      ContactPoint.belongsTo(models.Company, { 
        foreignKey: { 
          name: 'companyId', 
          field: 'company_id' 
        },
        as:'company' 
      });

      ContactPoint.belongsTo(models.User, { 
        foreignKey: { 
          name: 'createdBy', 
          field: 'created_by' 
        }, 
        as:'creator' 
      });
    }
  }
  ContactPoint.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true,
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field: 'company_id' 
    },
    ownerType: { 
      type: DataTypes.ENUM('counterparty','contact','user','company','department'), 
      allowNull:false, 
      field:'owner_type' 
    },
    ownerId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'owner_id' 
    },
    channel: { 
      type: DataTypes.ENUM('phone','email'), 
      allowNull:false 
    },
    valueRaw: { 
      type: DataTypes.STRING(256), 
      allowNull:false, 
      field:'value_raw' 
    },
    valueNorm: { 
      type: DataTypes.STRING(256), 
      allowNull:true,  
      field:'value_norm' 
    },
    label: { 
      type: DataTypes.STRING(64),
      allowNull:true
    },
    isPrimary: { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:false, 
      field:'is_primary' 
    },
    isPublic:  { 
      type: DataTypes.BOOLEAN, 
      allowNull:false, 
      defaultValue:true,  
      field:'is_public' 
    },
    verifiedAt:{ 
      type: DataTypes.DATE, 
      allowNull:true,
      field:'verified_at' 
    },
    notes: { 
      type: DataTypes.TEXT,
      allowNull:true
    },
    createdBy: { 
      type: DataTypes.UUID, 
      allowNull:true,
      field:'created_by' 
    },
    createdAt: { 
      type: DataTypes.DATE, 
      field:'created_at',
      allowNull: false, 
      defaultValue: DataTypes.NOW
    },
    updatedAt: { 
      allowNull: false, 
      type: DataTypes.DATE, 
      field:'updated_at',
      defaultValue: DataTypes.NOW
    },
    deletedAt: { 
      type: DataTypes.DATE, 
      allowNull: true,
      field:'deleted_at' 
    }
  }, {
    sequelize,
    modelName: 'ContactPoint',
    tableName: 'contact_points',
    paranoid: true, 
    underscored: true, 
    timestamps: true
  });
  return ContactPoint;
};