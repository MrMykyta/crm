// scripts/scaffold-pim.js
// Генерит services/controllers/routes для PIM в стиле CRM.
// Запуск: node scripts/scaffold-pim.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const SERVICES_DIR    = path.join(SRC, 'services', 'pim');
const CONTROLLERS_DIR = path.join(SRC, 'controllers', 'pim');
const ROUTES_DIR      = path.join(SRC, 'routes', 'pim');

// kind: 'crud' | 'product' | 'pricelist' | 'channel'
const ENTITIES = [
  { name:'product', model:'Product', path:'products', sort:'createdAt:desc', kind:'product',
    search:['name','slug','sku','barcode'], filters:['status','brandId','visibility'],
    include:[
      "{ model: Brand, as:'brand' }",
      "{ model: ProductType, as:'productType' }",
      "{ model: Uom, as:'uom' }",
      "{ model: ShippingClass, as:'shippingClass' }",
      "{ model: TaxCategory, as:'taxCategory' }",
      "{ model: ProductVariant, as:'variants' }"
    ]},

  { name:'brand',   model:'Brand',   path:'brands',   sort:'createdAt:desc', search:['name','slug'], filters:['isActive'], kind:'crud' },
  { name:'category',model:'Category',path:'categories',sort:'sort_order:asc',search:['name','slug','path'], filters:['parentId','isActive'], kind:'crud' },
  { name:'uom',     model:'Uom',     path:'uoms',     sort:'createdAt:desc', search:['name','code'], kind:'crud' },
  { name:'productType', model:'ProductType', path:'product-types', sort:'createdAt:desc', search:['name','code'], filters:['isActive'], kind:'crud' },
  { name:'attribute', model:'Attribute', path:'attributes', sort:'createdAt:desc', search:['name','code'], filters:['type','isVariant'], kind:'crud' },
  { name:'attributeOption', model:'AttributeOption', path:'attribute-options', sort:'createdAt:desc', search:['value','code'], filters:['attributeId'], kind:'crud' },
  { name:'productAttributeValue', model:'ProductAttributeValue', path:'product-attribute-values', sort:'createdAt:desc', search:[], filters:['productId','attributeId'], kind:'crud' },
  { name:'productVariant', model:'ProductVariant', path:'product-variants', sort:'createdAt:desc', search:['sku'], filters:['productId'], kind:'crud' },
  { name:'variantOption',  model:'VariantOption',  path:'variant-options',  sort:'sort_order:asc', search:['name','value'], filters:['variantId'], kind:'crud' },
  { name:'productAttachment', model:'ProductAttachment', path:'product-attachments', sort:'createdAt:desc', search:[], filters:['productId'], kind:'crud' },
  { name:'productLocalization', model:'ProductLocalization', path:'product-localizations', sort:'createdAt:desc', search:['slug','title'], filters:['productId','locale'], kind:'crud' },
  { name:'productExternalRef', model:'ProductExternalRef', path:'product-external-refs', sort:'createdAt:desc', search:['externalId','system'], filters:['productId','variantId','system'], kind:'crud' },
  { name:'productSupplier', model:'ProductSupplier', path:'product-suppliers', sort:'createdAt:desc', search:['supplierSku'], filters:['supplierId','productId','variantId'], kind:'crud' },
  { name:'productComponent', model:'ProductComponent', path:'product-components', sort:'createdAt:desc', search:[], filters:['parentProductId','componentProductId','componentVariantId'], kind:'crud' },
  { name:'productRelation', model:'ProductRelation', path:'product-relations', sort:'createdAt:desc', search:[], filters:['sourceProductId','targetProductId','relationType'], kind:'crud' },
  { name:'packagingUnit', model:'PackagingUnit', path:'packaging-units', sort:'level:asc', search:[], filters:['productId','variantId','level'], kind:'crud' },
  { name:'tag', model:'Tag', path:'tags', sort:'createdAt:desc', search:['name','code'], filters:['isActive'], kind:'crud' },
  { name:'productTag', model:'ProductTag', path:'product-tags', sort:'createdAt:desc', search:[], filters:['productId','tagId'], kind:'crud' },
  { name:'collection', model:'Collection', path:'collections', sort:'createdAt:desc', search:['name','code'], filters:['isActive'], kind:'crud' },
  { name:'productCollection', model:'ProductCollection', path:'product-collections', sort:'createdAt:desc', search:[], filters:['productId','collectionId'], kind:'crud' },
  { name:'productCategory', model:'ProductCategory', path:'product-categories', sort:'createdAt:desc', search:[], filters:['productId','categoryId'], kind:'crud' },
  { name:'priceList', model:'PriceList', path:'price-lists', sort:'createdAt:desc', search:['name','code'], filters:['type','isActive'], kind:'pricelist' },
  { name:'priceListItem', model:'PriceListItem', path:'price-list-items', sort:'createdAt:desc', search:[], filters:['priceListId','productId','variantId','minQty'], kind:'crud' },
  { name:'channel', model:'Channel', path:'channels', sort:'createdAt:desc', search:['name','code'], filters:['type','isActive'], kind:'channel' },
  { name:'channelListing', model:'ChannelListing', path:'channel-listings', sort:'createdAt:desc', search:['channelSku'], filters:['channelId','productId','variantId'], kind:'crud' },
  { name:'channelCategoryMap', model:'ChannelCategoryMap', path:'channel-category-maps', sort:'createdAt:desc', search:[], filters:['channelId','categoryId'], kind:'crud' },
  { name:'channel', model: 'Channel', path: 'channels', sort: 'createdAt:desc', search: ['name', 'code'], filters: ['type', 'isActive'], kind: 'crud' },
  { name:'priceList', model:'PriceList', path:'price-lists', sort:'createdAt:desc', search:['name','code'], filters:['type','isActive'], kind:'crud' },
  { name:'taxCategory', model: 'TaxCategory', path: 'tax-categories', sort: 'createdAt:desc', search: ['name','code'], filters: ['isActive'], kind: 'crud' },
  { name: 'shippingClass', model: 'ShippingClass', path: 'shipping-classes', sort: 'createdAt:desc', search: ['name','code'], filters: ['isActive'], kind: 'crud'},
];

// ===== helpers =====
function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); }
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function camelToModelField(k){ return k; }
function includeModelImports(includeArr){
  if (!includeArr?.length) return '';
  const names = includeArr.map(s=>{ const m = s.match(/model:\s*([A-Za-z0-9_]+)/); return m ? m[1] : null; }).filter(Boolean);
  return names.length ? ', ' + [...new Set(names)].join(', ') : '';
}

// ===== CRUD template =====
function serviceCrudTemplate({ name, model, search, filters, include = [] }) {
  const hasSearch = Array.isArray(search) && search.length > 0;
  const searchOr = hasSearch
    ? `where[Op.or] = [${search.map(f => `{ ${f}: { [Op.iLike]: \`%\${query.q}%\` } }`).join(', ')}];`
    : ``;
  const filterLines = (filters || [])
    .map(f => `  if (query.${f}) where.${f} = query.${f};`)
    .join('\n');
  const includeArr = include.length ? `include: [${include.join(', ')}],` : '';

  return `
// ${name}Service.js (generated)
const { Op } = require('sequelize');
const { ${model}${includeModelImports(include)} } = require('../../models');

const parse = (q={})=>{ const page=Math.max(parseInt(q.page||'1',10),1); const limit=Math.min(Math.max(parseInt(q.limit||'20',10),1),200); return { page, limit, offset:(page-1)*limit }; };

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const where = {};
  if (query.companyId) where.companyId = query.companyId; else if (user?.companyId) where.companyId = user.companyId;
${filterLines ? filterLines : '  // no extra filters'}
${hasSearch ? `  if (query.q) { ${searchOr} }` : '  // no free-text search'}
  const { rows, count } = await ${model}.findAndCountAll({ where, ${includeArr} order:[['createdAt','DESC']], limit, offset });
  return { rows, count, page, limit };
};

module.exports.getById = (id) => id ? ${model}.findByPk(id, { ${includeArr} }) : null;
module.exports.create  = (payload={}) => { if(!payload.companyId) throw new Error('companyId is required'); return ${model}.create(payload); };
module.exports.update  = async (id, payload={}) => { const it=await ${model}.findByPk(id); if(!it) return null; await it.update(payload); return module.exports.getById(id); };
module.exports.remove  = (id) => ${model}.destroy({ where:{ id } });
`;
}

function controllerCrudTemplate({ name }) {
  const ctrlName = cap(name);
  return `
// ${ctrlName}.controller.js (generated)
const ${name}Service = require('../../services/pim/${name}Service');
module.exports.list = async (req,res)=>{ const r = await ${name}Service.list({ query:req.query, user:req.user }); res.json({ data:r.rows, meta:{ count:r.count, page:r.page, limit:r.limit } }); };
module.exports.getById = async (req,res)=>{ const r = await ${name}Service.getById(req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.create = async (req,res)=>{ const p={...req.body}; if(req.user?.companyId && !p.companyId) p.companyId=req.user.companyId; const r=await ${name}Service.create(p); res.status(201).json(r); };
module.exports.update = async (req,res)=>{ const r=await ${name}Service.update(req.params.id, req.body); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.remove = async (req,res)=>{ const n=await ${name}Service.remove(req.params.id); if(!n) return res.sendStatus(404); res.json({ deleted:n }); };
`;
}
function routerCrudTemplate({ name, path }) {
  return `
// ${name}Router.js (generated)
const ${name}Router = require('express').Router();
const controller = require('../../controllers/pim/${name}.controller');
${name}Router.get('/', c.list); 
${name}Router.get('/:id', c.getById); 
${name}Router.post('/', c.create); 
${name}Router.put('/:id', c.update); 
${name}Router.delete('/:id', c.remove);
module.exports = ${name}Router;
`;
}

// ===== Product (расширенный) =====
function serviceProductTemplate({ include=[] }) {
  const includeArr = include.length ? ', ' + includeModelImports(include) : '';
  return `
// productService.js (generated)
const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const { withCompany } = require('../../utils/withCompany');
const { sequelize, Product, ProductVariant, VariantOption, ProductAttributeValue${includeArr} } = require('../../models');

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
  const skuPattern = opts.skuPattern || '\${base}-\${codes}';
  const created=[];
  for(const combo of combos){
    const codes = combo.map(x=>x.o.code||x.o.value).join('-').toUpperCase();
    const sku = skuPattern.replace('\${base}',baseSku).replace('\${codes}',codes);
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
`;
}

const controllerProduct = `
// product.controller.js (generated)
const svc = require('../../services/pim/productService');
module.exports.get    = async (req,res)=>{ const r=await svc.getById(req.user?.companyId||req.body.companyId, req.params.id); if(!r) return res.sendStatus(404); res.json(r); };
module.exports.publish= async (req,res)=>{ await svc.publish(req.user?.companyId||req.body.companyId, req.params.id); res.json({ok:true}); };
module.exports.archive= async (req,res)=>{ await svc.archive(req.user?.companyId||req.body.companyId, req.params.id); res.json({ok:true}); };
module.exports.duplicate= async (req,res)=>{ const r=await svc.duplicate(req.user?.companyId||req.body.companyId, req.params.id, req.body||{}); if(!r) return res.sendStatus(404); res.status(201).json(r); };
module.exports.variantMatrix= async (req,res)=>{ const rows=await svc.variantMatrix(req.user?.companyId||req.body.companyId, req.params.id, req.body.attrs||[], req.body.opts||{}); if(!rows) return res.sendStatus(404); res.status(201).json({ created:rows.length, rows }); };
module.exports.upsertAttrs= async (req,res)=>{ const r=await svc.upsertAttrs(req.user?.companyId||req.body.companyId, req.params.id, req.body.values||[]); if(!r) return res.sendStatus(404); res.json(r); };
`;

const routerProduct = `
// productRouter.js (generated)
const productRouter = require('express').Router();
const controller = require('../../controllers/pim/product.controller');
productRouter.get('/:id', controller.get);
productRouter.post('/:id/publish', controller.publish);
productRouter.post('/:id/archive', controller.archive);
productRouter.post('/:id/duplicate', controller.duplicate);
productRouter.post('/:id/variant-matrix', controller.variantMatrix);
productRouter.put('/:id/attributes', controller.upsertAttrs);
module.exports = productRouter;
`;

// ===== PriceList extras =====
const servicePriceListExtras = `
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
`;

const controllerPriceListExtras = `
// priceList.extras.controller.js (generated)
const svc=require('../../services/pim/priceListService.extras');
module.exports.setItems=async(req,res)=>{ const r=await svc.setItems(req.user?.companyId||req.body.companyId, req.params.id, req.body.items||[]); res.json(r); };
module.exports.bestPrice=async(req,res)=>{ const r=await svc.bestPrice(req.user?.companyId||req.query.companyId,{...req.query,priceListId:req.params.id}); res.json(r||{}); };
`;

const routerPriceListExtras = `
// priceList.extras.router.js (generated)
const r=require('express').Router();
const c=require('../../controllers/pim/priceList.extras.controller');
r.put('/:id/items', c.setItems);
r.get('/:id/best-price', c.bestPrice);
module.exports = r;
`;

// ===== Channel extras =====
const serviceChannelExtras = `
// channelService.extras.js (generated)
const { withTx } = require('../../utils/tx');
const { Channel, ChannelListing } = require('../../models');
module.exports.setListings = (companyId, channelId, listings=[], tx=null)=> withTx(async (t)=>{
  await ChannelListing.destroy({ where:{ companyId, channelId }, transaction:t });
  if (listings?.length) await ChannelListing.bulkCreate(listings.map(l=>({ ...l, companyId, channelId })), { transaction:t });
  return Channel.findOne({ where:{ companyId, id: channelId }, include:[{ model: ChannelListing, as:'listings' }], transaction:t });
}, tx);
`;

const controllerChannelExtras = `
// channel.extras.controller.js (generated)
const svc = require('../../services/pim/channelService.extras');
module.exports.setListings = async (req,res)=> {
  const r = await svc.setListings(req.user?.companyId||req.body.companyId, req.params.id, req.body.listings||[]);
  res.json(r);
};
`;

const routerChannelExtras = `
// channel.extras.router.js (generated)
const r = require('express').Router();
const c = require('../../controllers/pim/channel.extras.controller');
r.put('/:id/listings', c.setListings);
module.exports = r;
`;

// ===== index routes =====
function indexRoutesTemplate(items){
  const lines = [
    "const { Router } = require('express');",
    "const router = Router();",
    "router.use('/products', require('./product.router'));",
    "router.use('/price-lists', require('./priceList.extras.router'));",
    "router.use('/channels', require('./channel.extras.router'));",
  ];
  items.filter(e=>e.kind==='crud').forEach(e => lines.push(`router.use('/${e.path}', require('./${e.name}.router'));`));
  lines.push("module.exports = router;");
  return lines.join('\n');
}

// ===== generate =====
ensureDir(SERVICES_DIR); ensureDir(CONTROLLERS_DIR); ensureDir(ROUTES_DIR);

// CRUD
for (const e of ENTITIES.filter(x=>x.kind==='crud')) {
  if (!fs.existsSync(path.join(SERVICES_DIR, `${e.name}Service.js`)))  fs.writeFileSync(path.join(SERVICES_DIR, `${e.name}Service.js`), serviceCrudTemplate(e), 'utf8');
  if (!fs.existsSync(path.join(CONTROLLERS_DIR, `${e.name}.controller.js`))) fs.writeFileSync(path.join(CONTROLLERS_DIR, `${e.name}.controller.js`), controllerCrudTemplate(e), 'utf8');
  if (!fs.existsSync(path.join(ROUTES_DIR, `${e.name}.router.js`)))    fs.writeFileSync(path.join(ROUTES_DIR, `${e.name}.router.js`), routerCrudTemplate(e), 'utf8');
  console.log('✔ generated CRUD', e.name);
}

// Product
if (!fs.existsSync(path.join(SERVICES_DIR, 'productService.js')))      fs.writeFileSync(path.join(SERVICES_DIR, 'productService.js'), serviceProductTemplate(ENTITIES[0]), 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR, 'product.controller.js'))) fs.writeFileSync(path.join(CONTROLLERS_DIR, 'product.controller.js'), controllerProduct, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR, 'product.router.js')))          fs.writeFileSync(path.join(ROUTES_DIR, 'product.router.js'), routerProduct, 'utf8');

// PriceList extras
if (!fs.existsSync(path.join(SERVICES_DIR, 'priceListService.extras.js'))) fs.writeFileSync(path.join(SERVICES_DIR, 'priceListService.extras.js'), servicePriceListExtras, 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR, 'priceList.extras.controller.js'))) fs.writeFileSync(path.join(CONTROLLERS_DIR, 'priceList.extras.controller.js'), controllerPriceListExtras, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR, 'priceList.extras.router.js'))) fs.writeFileSync(path.join(ROUTES_DIR, 'priceList.extras.router.js'), routerPriceListExtras, 'utf8');

// Channel extras
if (!fs.existsSync(path.join(SERVICES_DIR, 'channelService.extras.js'))) fs.writeFileSync(path.join(SERVICES_DIR, 'channelService.extras.js'), serviceChannelExtras, 'utf8');
if (!fs.existsSync(path.join(CONTROLLERS_DIR, 'channel.extras.controller.js'))) fs.writeFileSync(path.join(CONTROLLERS_DIR, 'channel.extras.controller.js'), controllerChannelExtras, 'utf8');
if (!fs.existsSync(path.join(ROUTES_DIR, 'channel.extras.router.js'))) fs.writeFileSync(path.join(ROUTES_DIR, 'channel.extras.router.js'), routerChannelExtras, 'utf8');

// index
fs.writeFileSync(path.join(ROUTES_DIR, 'index.js'), indexRoutesTemplate(ENTITIES), 'utf8');
console.log('✔ PIM routes index generated');
