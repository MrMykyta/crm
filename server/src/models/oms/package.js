'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Package extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Package.belongsTo(models.Company, { 
        as: 'company', 
        foreignKey: 'companyId' 
      });
      Package.belongsTo(models.Shipment, { 
        as: 'shipment', 
        foreignKey: 'shipmentId'
      });
    }
  }
  Package.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey: true, 
      allowNull: false, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'company_id' 
    },
    shipmentId: { 
      type: DataTypes.UUID, 
      allowNull: false, 
      field: 'shipment_id' 
    },
    weight: { 
      type: DataTypes.DECIMAL(10,3) 
    },
    dimensionsJson: { 
      type: DataTypes.JSONB, 
      field: 'dimensions_json' 
    },
    trackingNumber: { 
      type: DataTypes.STRING(128), 
      field: 'tracking_number' 
    },
  }, {
    sequelize,
    modelName: 'Package',
    tableName: 'packages',
    timestamps: true, 
    paranoid: true, 
    underscored: true
  });
  return Package;
};