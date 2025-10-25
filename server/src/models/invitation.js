'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Invitation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Invitation.belongsTo(models.Company, { 
        foreignKey: 'company_id', 
        as: 'company' 
      });
      Invitation.belongsTo(models.User, { 
        foreignKey: 'invited_by', 
        as: 'inviter' 
      });
    }
  }
  Invitation.init({
    id:          { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId:   { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    email:       { 
      type: DataTypes.STRING(200), 
      allowNull: false 
    },
    firstName:   { 
      type: DataTypes.STRING(200), 
      field: 'first_name' 
    },
    lastName:    { 
      type: DataTypes.STRING(200), 
      field: 'last_name' 
    },
    role:        { 
      type: DataTypes.ENUM('owner','admin','manager','viewer'), 
      allowNull:false, 
      defaultValue:'viewer' 
    },
    invitedBy:   { 
      type: DataTypes.UUID, 
      allowNull: false,
      field: 'invited_by' 
    },
    token:       { 
      type: DataTypes.STRING(200), 
      allowNull: false,
      unique: true 
    },
    expiresAt:   { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'expires_at' 
    },
    acceptedAt:  { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'accepted_at' 
    },
    status:      { 
      type: DataTypes.ENUM('pending','accepted','revoked','expired'), 
      allowNull:false, 
      defaultValue:'pending' 
    }
  }, {
    sequelize,
    modelName: 'Invitation',
    tableName: 'invitations',
    underscored: true, 
    timestamps: true
  });
  return Invitation;
};