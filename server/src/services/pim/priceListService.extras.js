
// priceListService.extras.js (generated)
const { Op } = require('sequelize');
const { PriceList, PriceListItem } = require('../../models');
module.exports.setItems = async (companyId, priceListId, items=[], t=null)=>{
  await PriceListItem.destroy({ where:{ companyId, priceListId }, transaction:t });
  if(items?.length) await PriceListItem.bulkCreate(items.map(i=>({ ...i, companyId, priceListId })),{ transaction:t });
  return PriceList.findOne({ where:{ companyId, id:priceListId }, include:[{ model: PriceListItem, as:'items' }] });
};
module.exports.bestPrice = async (companyId, { productId=null, variantId=null, priceListId=null, qty=1, currency='PLN' })=>{
  const where={ companyId, currency };
  if(priceListId) where.priceListId=priceListId;
  if(variantId) where.variantId=variantId; else where.productId=productId;
  const row=await PriceListItem.findOne({ where:{ ...where, minQty:{ [Op.lte]: qty } }, order:[['minQty','DESC'],['createdAt','DESC']] });
  return row? { price:row.price, currency:row.currency, minQty:row.minQty, priceListId:row.priceListId }:null;
};
