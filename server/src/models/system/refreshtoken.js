'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      RefreshToken.belongsTo(models.User, { 
        foreignKey: 'user_id', 
        as: 'user' 
      });
    }
  }
  RefreshToken.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    userId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'user_id' 
    },
    jti: { 
      type: DataTypes.STRING(64), 
      allowNull: false, 
      unique: true 
    },
    revokedAt: { 
      type: DataTypes.DATE, 
      allowNull: true, 
      field: 'revoked_at' 
    },
    replacedBy: { 
      type: DataTypes.STRING(64), 
      allowNull: true, 
      field: 'replaced_by' 
    },
    expiresAt: { 
      type: DataTypes.DATE, 
      allowNull: false, 
      field: 'expires_at' 
    },
    userAgent: { 
      type: DataTypes.STRING(256), 
      allowNull: true, 
      field: 'user_agent' 
    },
    ip: { 
      type: DataTypes.STRING(64), 
      allowNull: true 
    },
    createdAt: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW,
        field:'created_at'
      },
      updatedAt: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW,
        field:'updated_at' 
      },
  }, {
    sequelize,
    modelName: 'RefreshToken',
    tableName: 'refresh_tokens',
    paranoid: true,
    underscored: true,
    timestamps: true
  });
  return RefreshToken;
};