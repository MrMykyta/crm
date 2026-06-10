'use strict';
const {
  Model
} = require('sequelize');
// Инициализирует и возвращает Sequelize-модель текущей сущности.
module.exports = (sequelize, DataTypes) => {
  class Parcel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Reverse side of Shipment.hasMany(Parcel, { as: 'parcels' }).
      // Company scoping for parcels is derived through this association:
      // Parcel -> Shipment -> companyId (the parcels table has no company_id column).
      Parcel.belongsTo(models.Shipment, {
        foreignKey: 'shipment_id',
        as: 'shipment',
      });
    }
  }
  Parcel.init({
    id:{ 
      type:DataTypes.UUID, 
      primaryKey:true,
      allowNull:false,
      defaultValue: DataTypes.UUIDV4
    },
    shipmentId:{ 
      type:DataTypes.UUID, 
      field:'shipment_id',
      allowNull:false 
    },
    carrier:{ 
      type:DataTypes.STRING(64) 
    },
    trackingNumber:{ 
      type:DataTypes.STRING(128), 
      field:'tracking_number' 
    },
    weight:{ 
      type:DataTypes.DECIMAL(12,3) 
    },
    dims:{ 
      type:DataTypes.JSONB 
    },
  }, {
    sequelize,
    modelName: 'Parcel',
    tableName:'parcels', 
    underscored:true, 
    timestamps:true
  });
  return Parcel;
};
