'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_preferences', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'user_id'
      },

      // i18n / theme
      language: { 
        type: Sequelize.STRING, 
        allowNull: false, 
        defaultValue: 'en' 
      },
      // 'system' | 'light' | 'dark' | 'custom'
      themeMode: { 
        type: Sequelize.STRING, 
        allowNull: false, 
        defaultValue: 'system',
        field: 'theme_mode'
      },
      customTheme: { 
        type: Sequelize.JSONB, 
        allowNull: false, 
        defaultValue: {},
        field: 'custom_theme'
      },

      // UI appearance (density, radius, blur, shadows, etc.)
      appearance: { 
        type: Sequelize.JSONB, 
        allowNull: false, 
        defaultValue: {} 
      },

      // background: { url, blur? }
      background: { 
        type: Sequelize.JSONB, 
        allowNull: false, 
        defaultValue: {} 
      },

      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW,
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW,
        field: 'updated_at'
      }
    });

    await queryInterface.addIndex('user_preferences', ['user_id'], { 
      unique: true, 
      name: 'user_preferences_user_id_uindex' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_preferences');
  }
};