'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PasswordResetTokens extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PasswordResetTokens.belongsTo(models.User, { 
        as: 'user', 
        foreignKey: 'userId' 
      });
    }
  }
  PasswordResetTokens.init({
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    tokenHash: { 
      type: DataTypes.STRING(128), 
      allowNull: false, 
      unique: true,
      field: 'token_hash'
    },
    expiresAt: { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'expires_at'
    },
    usedAt: { 
      type: DataTypes.DATE, 
      allowNull: true,
      field: 'used_at'
    },
    ip: { 
      type: DataTypes.STRING(64), 
      allowNull: true 
    },
    userAgent: { 
      type: DataTypes.STRING(512), 
      allowNull: true,
      field: 'user_agent'
    },
  }, {
    sequelize,
    modelName: 'PasswordResetTokens',
    tableName: 'password_reset_tokens',
    timestamps: true, 
    underscored: true
  });
  return PasswordResetTokens;
};