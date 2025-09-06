'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserPreferences extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      UserPreferences.belongsTo(models.User, { 
        as: 'user', 
        foreignKey: 'userId' 
      });
    }
  }
  UserPreferences.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      defaultValue: DataTypes.UUIDV4 
    },
    userId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      unique: true, 
      field: 'user_id' 
    },

    language: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      defaultValue: 'en' 
    },
    themeMode: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      defaultValue: 'system', 
      field: 'theme_mode' 
    },
    customTheme: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {}, 
      field: 'custom_theme' 
    },

    appearance: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {} 
    },
    background: { 
      type: DataTypes.JSONB, 
      allowNull: false, 
      defaultValue: {} 
    }
  }, {
    sequelize,
    modelName: 'UserPreferences',
    tableName: 'user_preferences',
    underscored: true, 
    timestamps: true
  });
  return UserPreferences;
};