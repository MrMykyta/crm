'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Offer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Offer.belongsTo(Company, { 
        as:'company', 
        foreignKey:'companyId' 
      });
      Offer.belongsTo(Counterparty, { 
        as:'customer', 
        foreignKey:'customerId' 
      });
      Offer.hasMany(OfferItem, { 
        as:'items', 
        foreignKey:'offerId', 
        onDelete:'CASCADE' 
      });
    }
  }
  Offer.init({
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
    customerId:{ 
      type: DataTypes.UUID, 
      allowNull: true, 
      field: 'customer_id' 
    },
    currencyCode:{ 
      type: DataTypes.STRING(3), 
      allowNull: false, 
      field: 'currency_code' 
    },
    status:{ 
      type: DataTypes.ENUM('draft','sent','accepted','rejected','expired'),
      allowNull: false, 
      defaultValue: 'draft' 
    },
    validUntil:{ 
      type: DataTypes.DATE,
      allowNull: true, 
      field: 'valid_until' 
    },
    totalNet:{ 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_net',
      allowNull: false, 
      defaultValue: 0 
    },
    totalTax:{ 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_tax',
      allowNull: false,
      defaultValue: 0 
    },
    totalGross:{ 
      type: DataTypes.DECIMAL(14,2), 
      field: 'total_gross',
      allowNull: false, 
      defaultValue: 0 
    },
    createdAt: {
      type: DataTypes.DATE, 
      field: 'created_at',
      allowNull: false, 
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE, 
      field: 'updated_at',
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'Offer',
    tableName:'offers', 
    paranoid:true,
    timestamps:true, 
    underscored:true
  });
  return Offer;
};