'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Counterparty extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Counterparty.belongsTo(models.Company, {
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Counterparty.belongsTo(models.User, { 
        foreignKey: 'main_responsible_user_id', 
        as: 'responsible' 
      });

      // аудит
      Counterparty.belongsTo(models.User, { 
        foreignKey: 'created_by', 
        as: 'creator' 
      });
      Counterparty.belongsTo(models.User, { 
        foreignKey: 'updated_by', 
        as: 'updater' 
      });

      // холдинг (self-reference)
      Counterparty.belongsTo(models.Counterparty, { 
        foreignKey: 'holding_id', 
        as: 'holding' 
      });
      Counterparty.hasMany(models.Counterparty, { 
        foreignKey: 'holding_id', 
        as: 'subsidiaries' 
      });
      
      Counterparty.hasMany(models.ContactPoint, {
        foreignKey: 'owner_id',
        scope: { 
          owner_type: 'counterparty' 
        }, 
        as: 'contacts'
      });


    }
  }
  Counterparty.init({
    id: { 
      type: DataTypes.UUID,
      allowNull: false, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    holdingId: { 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'holding_id' 
    },
    departmentId: { 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'department_id' 
    },
    mainResponsibleUserId: { 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'main_responsible_user_id' 
    },
    fullName:  { 
      type: DataTypes.STRING(200), 
      allowNull: false, 
      field: 'full_name' 
    },
    shortName: { 
      type: DataTypes.STRING(200), 
      allowNull: false, 
      field: 'short_name' 
    },
    nip: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    regon: {
      type: DataTypes.STRING(14),
      allowNull: true
    },
    krs: {
      type: DataTypes.STRING(14),
      allowNull: true,
    },
    bdo: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    type: { 
      type: DataTypes.ENUM('lead','client','partner','supplier','manufacturer'), 
      allowNull: false, 
      defaultValue: 'lead' 
    },
    status: { 
      type: DataTypes.ENUM('potential','active','inactive'), 
      allowNull: false, 
      defaultValue: 'potential' 
    },
    country: { 
      type: DataTypes.STRING(2),
      allowNull: true
    },
    city: { 
      type: DataTypes.STRING(128),
      allowNull: true
    },
    postalCode: { 
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'postal_code' 
    },
    street: { 
      type: DataTypes.STRING(128),
      allowNull: true
    },
    isCompany: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false,
      defaultValue: true, 
      field: 'is_company' 
    },
    description: { 
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: { 
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by' 
    },
    updatedBy: { 
      type: DataTypes.UUID,
      allowNull: true,
      field: 'updated_by' 
    },
    createdAt: { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    },
  }, {
    sequelize,
    modelName: 'Counterparty',
    tableName: 'counterparties',
    paranoid: true,
    underscored: true,
    timestamps: true
  });
  return Counterparty;
};