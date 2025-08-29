
// productService.js (generated)
const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const { withCompany } = require('../../utils/withCompany');
const { sequelize, Product, ProductVariant, VariantOption, ProductAttributeValue, Brand, ProductType, Uom, ShippingClass, TaxCategory } = require('../../models');

module.exports.getById = (companyId, id)=> Product.findOne({ where: withCompany(companyId,{ id }), include:[{ model: ProductVariant, as:'variants', include:[{ model: VariantOption, as:'options' }] }] });

module.exports.publish  = (companyId,id)=> Product.update({ status:'published', publishedAt: sequelize.fn('NOW') }, { where: withCompany(companyId,{ id }) });
module.exports.archive  = (companyId,id)=> Product.update({ status:'archived' }, { where: withCompany(companyId,{ id }) });

module.exports.duplicate = (companyId,id,{ skuSuffix='-COPY' }={})=> withTx(async(t)=>{
  const src = await Product.findOne({ where: withCompany(companyId,{ id }), include:[{ model: ProductVariant, as:'variants' }], transaction:t });
  if(!src) return null;
  const copy = await Product.create({ companyId, name: src.name+' copy', sku: src.sku?src.sku+skuSuffix:null, status:'draft' },{ transaction:t });
  for(const v of src.variants){
    await ProductVariant.create({ companyId, productId:copy.id, name:v.name, sku:v.sku? v.sku+skuSuffix:null },{ transaction:t });
  }
  return copy;
},null);

module.exports.variantMatrix = (companyId, productId, attrs=[], opts={}, tx=null)=> withTx(async(t)=>{
  const product = await Product.findOne({ where: withCompany(companyId,{ id:productId }), transaction:t });
  if(!product) return null;
  const combos = attrs.reduce((acc,a)=>{ if(!a.options?.length) return acc; const next=[]; for(const c of acc) for(const o of a.options) next.push([...c,{a,o}]); return next; }, [[]]);
  const baseSku = opts.baseSku || product.sku || 'PRD';
  const skuPattern = opts.skuPattern || '${base}-${codes}';
  const created=[];
  for(const combo of combos){
    const codes = combo.map(x=>x.o.code||x.o.value).join('-').toUpperCase();
    const sku = skuPattern.replace('${base}',baseSku).replace('${codes}',codes);
    const v = await ProductVariant.create({ companyId, productId, sku },{ transaction:t });
    await VariantOption.bulkCreate(combo.map(x=>({ companyId, variantId:v.id, name:x.a.name, value:x.o.value })),{ transaction:t });
    created.push(v);
  }
  return created;
},tx);

module.exports.upsertAttrs = (companyId, productId, values=[], tx=null)=> withTx(async(t)=>{
  await ProductAttributeValue.destroy({ where:{ companyId, productId }, transaction:t });
  if(values?.length) await ProductAttributeValue.bulkCreate(values.map(v=>({ ...v, companyId, productId })),{ transaction:t });
  return Product.findOne({ where: withCompany(companyId,{ id:productId }), include:[{ model: ProductAttributeValue, as:'attributeValues' }] });
},tx);
