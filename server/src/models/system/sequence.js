'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Sequence extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Sequence.belongsTo(models.Company, { 
        foreignKey:'companyId' 
      });
    }
  }
  Sequence.init({
    id: { 
      type: DataTypes.UUID, 
      primaryKey:true, 
      defaultValue: DataTypes.UUIDV4 
    },
    companyId: { 
      type: DataTypes.UUID, 
      allowNull:false, 
      field:'company_id' 
    },
    scope: { 
      type: DataTypes.ENUM('offer','order'), 
      allowNull:false 
    },
    year: { 
      type: DataTypes.INTEGER, 
      allowNull:false 
    },
    value: { 
      type: DataTypes.INTEGER, 
      allowNull:false, 
      defaultValue:0 
    }
  }, {
    sequelize,
    modelName: 'Sequence',
    tableName: 'sequences',
    underscored: true,
    timestamps: true
  });
  return Sequence;
};