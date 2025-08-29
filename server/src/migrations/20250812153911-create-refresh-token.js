'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('refresh_tokens', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true, 
        defaultValue: Sequelize.UUIDV4, 
        allowNull: false 
      },
      userId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'user_id'
      },
      jti: { 
        type: Sequelize.STRING(64), 
        allowNull: false, 
        unique: true 
      }, // ID рефреша
      revokedAt: { 
        type: Sequelize.DATE, 
        allowNull: true,
        field:'revoked_at'
      },
      replacedBy: { 
        type: Sequelize.STRING(64), 
        allowNull: true,
        field:'replaced_by'
      }, // jti нового токена
      expiresAt: { 
        type: Sequelize.DATE, 
        allowNull: false,
        field:'expires_at'
      },
      userAgent: { 
        type: Sequelize.STRING(256), 
        allowNull: true,
        field:'user_agent'
      },
      ip: { 
        type: Sequelize.STRING(64), 
        allowNull: true 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW,
        field:'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.NOW,
        field:'updated_at' 
      },
      deletedAt: { 
        type: Sequelize.DATE, 
        allowNull: true,
        field:'deleted_at'
      }
    });

    await queryInterface.addIndex('refresh_tokens', ['user_id'], { 
      name: 'rt_user_idx' 
    });
    await queryInterface.addIndex('refresh_tokens', ['expires_at'], { 
      name: 'rt_expires_idx' 
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id', 'jti'], { 
      name: 'rt_user_jti_idx', 
      unique: true 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('refresh_tokens', 'rt_user_idx');
    await queryInterface.removeIndex('refresh_tokens', 'rt_expires_idx');
    await queryInterface.removeIndex('refresh_tokens', 'rt_user_jti_idx');
    await queryInterface.dropTable('refresh_tokens');
  }
};