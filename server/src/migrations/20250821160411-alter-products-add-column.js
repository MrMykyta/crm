'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('products','productTypeId',{ 
      type:Sequelize.UUID, 
      references:{ 
        model:'product_types', 
        key:'id' 
      },
      field:'product_type_id',
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });
    await queryInterface.addColumn('products','taxCategoryId',{ 
      type:Sequelize.UUID, 
      references:{ 
        model:'tax_categories', 
        key:'id' 
      }, 
      field:'tax_category_id',
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });
    await queryInterface.addColumn('products','shippingClassId',{ 
      type:Sequelize.UUID, 
      references:{ 
        model:'shipping_classes', 
        key:'id' 
      },
      field:'shipping_class_id',
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });

    await queryInterface.addColumn('products','hsCode',{ 
      type:Sequelize.STRING(32), 
      field:'hs_code' 
    });
    await queryInterface.addColumn('products','countryOfOrigin',{ 
      type:Sequelize.STRING(2), 
      field:'country_of_origin' 
    });
    await queryInterface.addColumn('products','warrantyMonths',{ 
      type:Sequelize.INTEGER, 
      field:'warranty_months', 
      defaultValue:0 
    });
    await queryInterface.addColumn('products','dangerousGoodsClass',{ 
      type:Sequelize.STRING(16), 
      field:'dangerous_goods_class' 
    });
    await queryInterface.addColumn('products','unNumber',{ 
      type:Sequelize.STRING(10), 
      field:'un_number' 
    });

    await queryInterface.addColumn('products','isSerialized',{ 
      type:Sequelize.BOOLEAN, 
      field:'is_serialized', 
      defaultValue:false 
    });
    await queryInterface.addColumn('products','isLotTracked',{ 
      type:Sequelize.BOOLEAN, 
      field:'is_lot_tracked', 
      defaultValue:false 
    });
    await queryInterface.addColumn('products','shelfLifeDays',{ 
      type:Sequelize.INTEGER, 
      field:'shelf_life_days', 
      defaultValue:0 
    });

    await queryInterface.addColumn('products','discontinuedAt',{ 
      type:Sequelize.DATE, 
      field:'discontinued_at' 
    });
    await queryInterface.addColumn('products','replacedByProductId',{ 
      type:Sequelize.UUID, 
      field:'replaced_by_product_id',
      references:{ 
        model:'products', 
        key:'id' 
      }, 
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('products','replacedByProductId');
    await queryInterface.removeColumn('products','discontinuedAt');

    await queryInterface.removeColumn('products','shelfLifeDays');
    await queryInterface.removeColumn('products','isLotTracked');
    await queryInterface.removeColumn('products','isSerialized');

    await queryInterface.removeColumn('products','unNumber');
    await queryInterface.removeColumn('products','dangerousGoodsClass');
    await queryInterface.removeColumn('products','warrantyMonths');
    await queryInterface.removeColumn('products','countryOfOrigin');
    await queryInterface.removeColumn('products','hsCode');

    await queryInterface.removeColumn('products','shippingClassId');
    await queryInterface.removeColumn('products','taxCategoryId');
    await queryInterface.removeColumn('products','productTypeId');
  }
};
