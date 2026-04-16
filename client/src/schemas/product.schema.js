const PRODUCT_MAX = {
  name: 255,
  sku: 64,
  ean: 32,
  barcode: 64,
  pkwiu: 32,
  cn: 32,
  gtu: 32,
  hsCode: 32,
  countryOfOrigin: 2,
};

const PRODUCT_STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'active', label: 'Активен' },
  { value: 'archived', label: 'Архив' },
];

const PRODUCT_VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Публичный' },
  { value: 'private', label: 'Скрытый' },
];

// trimOrNull: описывает схему валидации и преобразования данных.
function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

// toNumberOrNull: описывает схему валидации и преобразования данных.
function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

// toIntOrNull: описывает схему валидации и преобразования данных.
function toIntOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return null;
  return number;
}

// toDateInput: описывает схему валидации и преобразования данных.
function toDateInput(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

// productEntitySchema: описывает схему валидации и преобразования данных.
export function productEntitySchema(_i18n, options = {}) {
  const {
    categoryOptions = [],
    subcategoryOptions = [],
    brandOptions = [],
    supplierOptions = [],
    uomOptions = [],
    productTypeOptions = [],
    gtuOptions = [],
  } = options;

  return [
    { kind: 'section', title: 'Основное', collapsible: true, defaultCollapsed: false, emphasis: 'primary' },
    {
      name: 'name',
      label: 'Название',
      type: 'text',
      float: true,
      required: true,
      max: PRODUCT_MAX.name,
      cols: 4,
    },
    {
      name: 'sku',
      label: 'SKU',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.sku,
      cols: 2,
    },
    {
      name: 'ean',
      label: 'EAN',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.ean,
      cols: 2,
    },
    {
      name: 'barcode',
      label: 'Штрихкод',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.barcode,
      cols: 2,
    },
    { kind: 'spacer', cols: 2 },

    { kind: 'section', title: 'Классификация', collapsible: true, defaultCollapsed: false, emphasis: 'primary' },
    {
      name: 'primaryCategoryId',
      label: 'Категория',
      type: 'autocomplete-select',
      float: true,
      options: categoryOptions,
      placeholder: 'Начните вводить категорию',
      cols: 2,
    },
    {
      name: 'subcategoryId',
      label: 'Подкатегория',
      type: 'autocomplete-select',
      float: true,
      options: subcategoryOptions,
      placeholder: 'Начните вводить подкатегорию',
      cols: 2,
    },
    {
      name: 'brandId',
      label: 'Производитель',
      type: 'autocomplete-select',
      float: true,
      options: brandOptions,
      placeholder: 'Начните вводить производителя',
      cols: 2,
    },
    {
      name: 'supplierId',
      label: 'Поставщик',
      type: 'autocomplete-select',
      float: true,
      options: supplierOptions,
      placeholder: 'Начните вводить поставщика',
      cols: 2,
    },
    {
      name: 'productTypeId',
      label: 'Тип товара',
      type: 'autocomplete-select',
      float: true,
      options: productTypeOptions,
      placeholder: 'Выберите тип товара',
      cols: 2,
    },
    {
      name: 'uomId',
      label: 'Ед. изм.',
      type: 'autocomplete-select',
      float: true,
      options: uomOptions,
      placeholder: 'Выберите единицу',
      cols: 2,
    },

    { kind: 'section', title: 'Продажи', collapsible: true, defaultCollapsed: false },
    {
      name: 'saleStartDate',
      label: 'Дата начала продаж',
      type: 'date',
      float: true,
      hint: 'Только дата',
      cols: 2,
    },
    {
      name: 'saleEndDate',
      label: 'Дата окончания продаж',
      type: 'date',
      float: true,
      hint: 'Только дата',
      cols: 2,
    },
    { kind: 'section', title: 'Состояние', collapsible: true, defaultCollapsed: true },
    {
      name: 'status',
      label: 'Статус',
      type: 'dropdown-select',
      float: true,
      options: PRODUCT_STATUS_OPTIONS,
      cols: 2,
    },
    {
      name: 'visibility',
      label: 'Видимость',
      type: 'dropdown-select',
      float: true,
      options: PRODUCT_VISIBILITY_OPTIONS,
      cols: 2,
    },
    {
      name: 'isSellable',
      label: 'Продаётся',
      type: 'checkbox',
      cols: 2,
    },
    { kind: 'spacer', cols: 2 },

    { kind: 'section', title: 'Коды и классификаторы', collapsible: true, defaultCollapsed: true },
    {
      name: 'pkwiu',
      label: 'PKWiU',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.pkwiu,
      cols: 2,
    },
    {
      name: 'cn',
      label: 'CN',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.cn,
      cols: 2,
    },
    {
      name: 'gtu',
      label: 'GTU',
      type: 'dropdown-select',
      float: true,
      options: gtuOptions,
      cols: 2,
    },
    {
      name: 'hsCode',
      label: 'HS Code',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.hsCode,
      cols: 2,
    },
    {
      name: 'countryOfOrigin',
      label: 'Страна происхождения',
      type: 'text',
      float: true,
      max: PRODUCT_MAX.countryOfOrigin,
      upper: true,
      cols: 2,
    },
    { kind: 'spacer', cols: 2 },

    { kind: 'section', title: 'Коммерция', collapsible: true, defaultCollapsed: true },
    {
      name: 'cost',
      label: 'Себестоимость',
      type: 'text',
      float: true,
      inputMode: 'decimal',
      cols: 2,
    },
    {
      name: 'currency',
      label: 'Валюта',
      type: 'text',
      float: true,
      max: 3,
      upper: true,
      cols: 2,
    },
    {
      name: 'trackInventory',
      label: 'Учитывать остатки',
      type: 'checkbox',
      cols: 2,
    },
  ];
}

// toFormProduct: описывает схему валидации и преобразования данных.
export function toFormProduct(product = {}) {
  return {
    id: product?.id || null,

    name: product?.name || '',
    sku: product?.sku || '',
    ean: product?.ean || '',
    barcode: product?.barcode || '',

    primaryCategoryId: product?.primaryCategoryId || product?.primaryCategory?.id || '',
    subcategoryId: product?.subcategoryId || product?.subcategory?.id || '',
    brandId: product?.brandId || product?.brand?.id || '',
    supplierId: product?.supplierId || product?.supplier?.id || '',
    productTypeId: product?.productTypeId || product?.type?.id || '',
    uomId: product?.uomId || product?.uom?.id || '',
    taxCategoryId: product?.taxCategoryId || product?.taxCategory?.id || '',
    shippingClassId: product?.shippingClassId || product?.shippingClass?.id || '',

    saleStartDate: toDateInput(product?.saleStartDate),
    saleEndDate: toDateInput(product?.saleEndDate),
    status: product?.status || 'draft',
    visibility: product?.visibility || 'public',
    isSellable: Boolean(product?.isSellable ?? true),

    pkwiu: product?.pkwiu || '',
    cn: product?.cn || '',
    gtu: product?.gtu || '',
    hsCode: product?.hsCode || '',
    countryOfOrigin: product?.countryOfOrigin || '',

    cost: product?.cost ?? '',
    currency: product?.currency || 'PLN',
    trackInventory: Boolean(product?.trackInventory ?? false),

    // Related tab fields (persisted by the same entity, but edited in tabs)
    description: product?.description || '',
    weight: product?.weight ?? '',
    length: product?.length ?? '',
    width: product?.width ?? '',
    height: product?.height ?? '',
    warrantyMonths: product?.warrantyMonths ?? '',
    dangerousGoodsClass: product?.dangerousGoodsClass || '',
    unNumber: product?.unNumber || '',
    isSerialized: Boolean(product?.isSerialized ?? false),
    isLotTracked: Boolean(product?.isLotTracked ?? false),
    shelfLifeDays: product?.shelfLifeDays ?? '',
    replacedByProductId: product?.replacedByProductId || '',
    publishedAt: product?.publishedAt || null,
    discontinuedAt: product?.discontinuedAt || null,

    // Transitional fields: keep for read compatibility only.
    price: product?.price ?? '',
    oldPrice: product?.oldPrice ?? '',
    stockQuantity: product?.stockQuantity ?? '',
    reservedQuantity: product?.reservedQuantity ?? '',
    orderedQuantity: product?.orderedQuantity ?? '',
    effectiveIsSellable: Boolean(product?.effectiveIsSellable ?? product?.isSellable ?? false),

    createdAt: product?.createdAt || null,
    updatedAt: product?.updatedAt || null,
  };
}

// toApiProduct: описывает схему валидации и преобразования данных.
export function toApiProduct(values = {}) {
  return {
    // Core / master data
    name: String(values.name || '').trim(),
    sku: trimOrNull(values.sku),
    ean: trimOrNull(values.ean),
    barcode: trimOrNull(values.barcode),

    // Classification / relations
    primaryCategoryId: trimOrNull(values.primaryCategoryId),
    subcategoryId: trimOrNull(values.subcategoryId),
    brandId: trimOrNull(values.brandId),
    supplierId: trimOrNull(values.supplierId),
    productTypeId: trimOrNull(values.productTypeId),
    uomId: trimOrNull(values.uomId),
    taxCategoryId: trimOrNull(values.taxCategoryId),
    shippingClassId: trimOrNull(values.shippingClassId),
    replacedByProductId: trimOrNull(values.replacedByProductId),

    // Sales / lifecycle
    saleStartDate: trimOrNull(values.saleStartDate),
    saleEndDate: trimOrNull(values.saleEndDate),
    status: trimOrNull(values.status),
    visibility: trimOrNull(values.visibility),
    isSellable: Boolean(values.isSellable),
    discontinuedAt: trimOrNull(values.discontinuedAt),

    // Codes / classification
    pkwiu: trimOrNull(values.pkwiu),
    cn: trimOrNull(values.cn),
    gtu: trimOrNull(values.gtu),
    hsCode: trimOrNull(values.hsCode),
    countryOfOrigin: trimOrNull(values.countryOfOrigin),

    // Commerce flags
    cost: toNumberOrNull(values.cost),
    currency: trimOrNull(values.currency),
    trackInventory: Boolean(values.trackInventory),

    // Related measurements / advanced logistics
    weight: toNumberOrNull(values.weight),
    length: toNumberOrNull(values.length),
    width: toNumberOrNull(values.width),
    height: toNumberOrNull(values.height),
    warrantyMonths: toIntOrNull(values.warrantyMonths),
    dangerousGoodsClass: trimOrNull(values.dangerousGoodsClass),
    unNumber: trimOrNull(values.unNumber),
    isSerialized: Boolean(values.isSerialized),
    isLotTracked: Boolean(values.isLotTracked),
    shelfLifeDays: toIntOrNull(values.shelfLifeDays),
  };
}

