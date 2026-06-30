import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeDollarSign,
  Boxes,
  Building2,
  FileText,
  Package,
  PackageCheck,
  ReceiptText,
  Save,
  Settings,
  ShieldCheck,
  Tags,
  Warehouse,
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import HtmlDescriptionSection from '../../../../components/data/HtmlDescriptionSection';
import {
  AutocompleteField,
  CheckboxField,
  NumberField,
  SelectField,
  TextField,
} from '../../../../components/ui/fields';
import {
  toApiProduct,
  toFormProduct,
} from '../../../../schemas/product.schema';
import {
  useCreateProductMutation,
  useCreateBrandLookupMutation,
  useCreateCategoryLookupMutation,
  useCreateProductAttachmentMutation,
  useCreateProductTypeLookupMutation,
  useCreateTaxCategoryLookupMutation,
  useDeleteProductAttachmentMutation,
  useGetProductMovementsQuery,
  useGetProductPricesQuery,
  useGetProductQuery,
  useListBrandsLookupQuery,
  useListCategoriesLookupQuery,
  useListProductAttachmentsQuery,
  useListProductTypesLookupQuery,
  useListTaxCategoriesLookupQuery,
  useListUomsLookupQuery,
  useUpdateProductAttachmentMutation,
  useUpdateProductDescriptionMutation,
  useUpdateProductMutation,
} from '../../../../store/rtk/productsApi';
import {
  useGetSignedPreviewUrlQuery,
  useListFilesByOwnerQuery,
  useUploadFileMutation,
} from '../../../../store/rtk/filesApi';
import { useCreateCounterpartyMutation, useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import { formatQuantity, getUomSymbol } from '../../../../utils/uom';
import { withApiOrigin } from '../../../../config/api';
import ProductDetailTabs from './ProductDetailTabs';
import s from './ProductDetailPage.module.css';

const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  ean: '',
  barcode: '',
  slug: '',
  primaryCategoryId: '',
  subcategoryId: '',
  brandId: '',
  supplierId: '',
  manufacturerId: '',
  productTypeId: '',
  uomId: '',
  taxCategoryId: '',
  status: 'draft',
  visibility: 'public',
  isSellable: true,
  isService: false,
  price: '',
  oldPrice: '',
  cost: '',
  currency: 'PLN',
  pkwiu: '',
  cn: '',
  gtu: '',
  hsCode: '',
  countryOfOrigin: '',
  trackInventory: false,
  isSerialized: false,
  isLotTracked: false,
  shelfLifeDays: '',
  stockQuantity: '',
  reservedQuantity: '',
  orderedQuantity: '',
  saleStartDate: '',
  saleEndDate: '',
  description: '',
  createdAt: null,
  updatedAt: null,
};

const GTU_OPTIONS = [
  'GTU_01',
  'GTU_02',
  'GTU_03',
  'GTU_04',
  'GTU_05',
  'GTU_06',
  'GTU_07',
  'GTU_08',
  'GTU_09',
  'GTU_10',
  'GTU_11',
  'GTU_12',
  'GTU_13',
].map((value) => ({ value, label: value }));

const POLISH_TAX_PRESETS = [
  { code: 'PL_VAT_23', name: 'VAT 23%', rate: 23 },
  { code: 'PL_VAT_8', name: 'VAT 8%', rate: 8 },
  { code: 'PL_VAT_5', name: 'VAT 5%', rate: 5 },
  { code: 'PL_VAT_0', name: 'VAT 0%', rate: 0 },
  { code: 'PL_VAT_ZW', name: 'ZW', rate: 0 },
  { code: 'PL_VAT_NP', name: 'NP', rate: 0 },
];

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
]);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tif', 'tiff', 'heic', 'heif']);

function byLabel(a, b) {
  return String(a?.label || '').localeCompare(String(b?.label || ''));
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeLookupText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeInputName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lookupCode(value, fallback = 'ITEM') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return (normalized || fallback).slice(0, 60);
}

function taxPresetCode(item) {
  return String(item?.preset?.code || item?.code || '').toUpperCase();
}

function taxPresetLabel(item) {
  const code = taxPresetCode(item);
  if (code === 'PL_VAT_23') return 'VAT 23%';
  if (code === 'PL_VAT_8') return 'VAT 8%';
  if (code === 'PL_VAT_5') return 'VAT 5%';
  if (code === 'PL_VAT_0') return 'VAT 0%';
  if (code === 'PL_VAT_ZW') return 'ZW';
  if (code === 'PL_VAT_NP') return 'NP';
  return item?.name || item?.code || item?.id;
}

function taxPresetSecondary(item, t) {
  const code = taxPresetCode(item);
  if (code === 'PL_VAT_ZW') return t('pim.product.detail.taxPresets.zw', 'ZW — exempt');
  if (code === 'PL_VAT_NP') return t('pim.product.detail.taxPresets.np', 'NP — not subject');
  if (item?.rate !== undefined && item?.rate !== null && item?.rate !== '') {
    return t('pim.product.detail.taxPresets.rate', '{{rate}}% VAT', { rate: Number(item.rate) });
  }
  return item?.code || null;
}

function listItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function fileNameOf(file) {
  return String(file?.filename || file?.safeName || file?.name || '');
}

function fileExt(file) {
  const match = fileNameOf(file).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : '';
}

function isImageFile(file) {
  const mime = String(file?.mime || file?.type || '').toLowerCase();
  return mime.startsWith('image/') || IMAGE_MIME.has(mime) || IMAGE_EXT.has(fileExt(file));
}

function pickMainAttachment(attachments = []) {
  return [...attachments]
    .filter((row) => String(row?.role || '').toLowerCase() === 'image')
    .sort((a, b) => {
      const left = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : 0;
      const right = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 0;
      if (left !== right) return left - right;
      return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0);
    })[0] || null;
}

function moneyLabel(value, currency, empty = '—') {
  if (value === null || value === undefined || value === '') return empty;
  const num = Number(value);
  if (!Number.isFinite(num)) return `${value} ${currency || ''}`.trim();
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
}

function dateTimeLabel(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || undefined);
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function optionLabel(map, id, fallback = '—') {
  if (!id) return fallback;
  return map.get(String(id))?.label || fallback;
}

function statusLabel(status, t) {
  if (status === 'active') return t('pim.product.detail.status.active', 'Active');
  if (status === 'archived') return t('pim.product.detail.status.archived', 'Archived');
  return t('pim.product.detail.status.draft', 'Draft');
}

function visibilityLabel(visibility, t) {
  return visibility === 'private'
    ? t('pim.product.detail.visibility.private', 'Private')
    : t('pim.product.detail.visibility.public', 'Public');
}

function productKindLabel(values, t) {
  return values?.isService
    ? t('pim.product.detail.kind.service', 'Service')
    : t('pim.product.detail.kind.product', 'Product');
}

function inventoryAvailable(values = {}) {
  const stock = Number(values.stockQuantity);
  const reserved = Number(values.reservedQuantity);
  if (!Number.isFinite(stock)) return null;
  return stock - (Number.isFinite(reserved) ? reserved : 0);
}

function latestByDate(rows = []) {
  return [...rows]
    .filter(Boolean)
    .sort((a, b) => new Date(b?.createdAt || b?.updatedAt || 0) - new Date(a?.createdAt || a?.updatedAt || 0))[0] || null;
}

function priceAmount(row) {
  const gross = Number(row?.grossPrice);
  const net = Number(row?.netPrice);
  if (Number.isFinite(gross)) return gross;
  if (Number.isFinite(net)) return net;
  return null;
}

function priceSnapshot(pricesData, product) {
  const purchase = Array.isArray(pricesData?.purchase) ? pricesData.purchase : [];
  const sale = Array.isArray(pricesData?.sale) ? pricesData.sale : [];
  const firstSale = sale.map((row) => ({ row, amount: priceAmount(row) }))
    .filter((item) => Number.isFinite(item.amount))
    .sort((a, b) => a.amount - b.amount)[0] || null;
  const firstPurchase = purchase.map((row) => ({ row, amount: priceAmount(row) }))
    .filter((item) => Number.isFinite(item.amount))
    .sort((a, b) => a.amount - b.amount)[0] || null;
  const cost = numberOrNull(product?.cost);
  const saleAmount = firstSale?.amount ?? numberOrNull(product?.price);
  const margin = Number.isFinite(saleAmount) && Number.isFinite(cost) ? saleAmount - cost : null;

  return {
    purchaseCount: purchase.length,
    saleCount: sale.length,
    purchase: firstPurchase,
    sale: firstSale,
    margin,
    currency: firstSale?.row?.currency || firstPurchase?.row?.currency || product?.currency || 'PLN',
  };
}

function FieldGrid({ children }) {
  return <div className={s.v2FieldGrid}>{children}</div>;
}

function FactRow({ label, value }) {
  return (
    <div className={s.v2FactRow}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function FieldHint({ children, compact = false }) {
  if (!children) return null;
  return <div className={`${s.v2FieldHint} ${compact ? s.v2FieldHintCompact : ''}`}>{children}</div>;
}

function Metric({ label, value, tone = 'default', icon }) {
  return (
    <div className={`${s.v2Metric} ${s[`v2Metric_${tone}`] || ''}`}>
      <span className={s.v2MetricIcon}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function HeroVital({ label, value, detail, tone = 'default' }) {
  return (
    <div className={`${s.v2HeroVital} ${s[`v2HeroVital_${tone}`] || ''}`}>
      <span>{label}</span>
      <strong>{value === 0 || value ? value : '—'}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function MainImageBlock({ productId, productName, disabled, t }) {
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: attachmentData, refetch: refetchAttachments } = useListProductAttachmentsQuery(
    { productId, limit: 100 },
    { skip: !productId }
  );
  const { data: filesData, refetch: refetchFiles } = useListFilesByOwnerQuery(
    { ownerType: 'product', ownerId: productId },
    { skip: !productId }
  );
  const [uploadFile] = useUploadFileMutation();
  const [createProductAttachment] = useCreateProductAttachmentMutation();
  const [updateProductAttachment] = useUpdateProductAttachmentMutation();
  const [deleteProductAttachment] = useDeleteProductAttachmentMutation();

  const attachments = useMemo(() => listItems(attachmentData), [attachmentData]);
  const files = useMemo(() => listItems(filesData), [filesData]);
  const fileById = useMemo(() => {
    const map = new Map();
    files.forEach((file) => {
      if (file?.id) map.set(String(file.id), file);
    });
    return map;
  }, [files]);
  const mainAttachment = useMemo(() => pickMainAttachment(attachments), [attachments]);
  const mainFile = mainAttachment?.attachmentId ? fileById.get(String(mainAttachment.attachmentId)) : null;
  const shouldSign = Boolean(mainFile?.id && mainFile?.visibility !== 'public');
  const { data: signedPreview } = useGetSignedPreviewUrlQuery(mainFile?.id, { skip: !shouldSign });
  const signedUrl = signedPreview?.data?.url || signedPreview?.url || '';
  const imageUrl = mainFile?.visibility === 'public' && mainFile?.url
    ? withApiOrigin(mainFile.url)
    : withApiOrigin(signedUrl);
  const initials = String(productName || 'P').trim().slice(0, 2).toUpperCase() || 'P';

  const promoteAttachment = useCallback(async (fileId) => {
    if (!productId || !fileId) return;
    const existing = attachments.find((row) => String(row?.attachmentId) === String(fileId));
    const others = attachments.filter((row) => row?.id && String(row?.id) !== String(existing?.id || ''));
    const orderedOthers = others
      .filter((row) => String(row?.role || '').toLowerCase() === 'image')
      .sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0));

    await Promise.all(orderedOthers.map((row, index) => (
      updateProductAttachment({
        id: row.id,
        payload: {
          productId,
          attachmentId: row.attachmentId,
          role: row.role || 'image',
          sortOrder: index + 1,
        },
      }).unwrap()
    )));

    if (existing) {
      await updateProductAttachment({
        id: existing.id,
        payload: {
          productId,
          attachmentId: existing.attachmentId,
          role: 'image',
          sortOrder: 0,
        },
      }).unwrap();
    } else {
      await createProductAttachment({
        productId,
        attachmentId: fileId,
        role: 'image',
        sortOrder: 0,
      }).unwrap();
    }

    await Promise.all([refetchAttachments(), refetchFiles()]);
  }, [attachments, createProductAttachment, productId, refetchAttachments, refetchFiles, updateProductAttachment]);

  const uploadMainImage = useCallback(async (fileList) => {
    const file = Array.from(fileList || [])[0];
    if (!file || !productId) return;
    if (!isImageFile(file)) {
      setError(t('pim.product.detail.image.onlyImages', 'Only image files can be uploaded.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadFile({
        ownerType: 'product',
        ownerId: productId,
        file,
        purpose: 'product_image',
        visibility: 'public',
      }).unwrap();
      const uploadedFile = uploaded?.data || uploaded;
      const fileId = uploadedFile?.id;
      if (!fileId) throw new Error('File id is missing');
      await promoteAttachment(fileId);
    } catch (e) {
      setError(e?.data?.message || e?.message || t('pim.product.detail.image.uploadFailed', 'Failed to upload image.'));
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [productId, promoteAttachment, t, uploadFile]);

  const removeMainImage = useCallback(async () => {
    if (!mainAttachment?.id) return;
    setBusy(true);
    setError('');
    try {
      await deleteProductAttachment({ id: mainAttachment.id, productId }).unwrap();
      await refetchAttachments();
    } catch (e) {
      setError(e?.data?.message || e?.message || t('pim.product.detail.image.removeFailed', 'Failed to remove image.'));
    } finally {
      setBusy(false);
    }
  }, [deleteProductAttachment, mainAttachment?.id, productId, refetchAttachments, t]);

  return (
    <div className={s.mainImageBlock}>
      <div className={s.mainImagePreview}>
        {imageUrl ? (
          <img src={imageUrl} alt={mainFile?.filename || productName || t('pim.product.detail.image.alt', 'Product image')} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className={s.mainImageActions}>
        <button
          type="button"
          className={s.mainImageAction}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || disabled || !productId}
        >
          {mainAttachment ? t('pim.product.detail.image.replace', 'Replace') : t('pim.product.detail.image.upload', 'Upload')}
        </button>
        {mainAttachment ? (
          <button
            type="button"
            className={`${s.mainImageAction} ${s.mainImageActionMuted}`}
            onClick={removeMainImage}
            disabled={busy || disabled}
          >
            {t('pim.product.detail.image.remove', 'Remove')}
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={s.fileInputHidden}
          onChange={(event) => uploadMainImage(event.target.files)}
        />
      </div>
      {disabled && !productId ? (
        <div className={s.mainImageHint}>{t('pim.product.detail.image.saveFirst', 'Save the product to add an image.')}</div>
      ) : null}
      {mainFile ? <div className={s.mainImageFileName}>{mainFile.filename || mainFile.safeName}</div> : null}
      {error ? <div className={s.mainImageError}>{error}</div> : null}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isCreateMode = id === 'new' || !id;
  const productId = isCreateMode ? '' : id;

  const { data: base, isFetching } = useGetProductQuery(id, {
    skip: isCreateMode,
    refetchOnMountOrArgChange: true,
  });

  const [createProduct, { isLoading: creating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateProductMutation();
  const [updateDescription] = useUpdateProductDescriptionMutation();
  const [createCategoryLookup, { isLoading: creatingCategory }] = useCreateCategoryLookupMutation();
  const [createBrandLookup, { isLoading: creatingBrand }] = useCreateBrandLookupMutation();
  const [createProductTypeLookup, { isLoading: creatingProductType }] = useCreateProductTypeLookupMutation();
  const [createTaxCategoryLookup, { isLoading: creatingTaxCategory }] = useCreateTaxCategoryLookupMutation();
  const [createCounterparty, { isLoading: creatingCounterparty }] = useCreateCounterpartyMutation();
  const [values, setValues] = useState(() => ({ ...EMPTY_PRODUCT }));
  const [dirty, setDirty] = useState(isCreateMode);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const saving = creating || updating;

  useEffect(() => {
    if (isCreateMode) {
      setValues({ ...EMPTY_PRODUCT });
      setDirty(true);
      setSaveError('');
      setActiveTab('overview');
      return;
    }
    if (!base) return;
    setValues({ ...EMPTY_PRODUCT, ...toFormProduct(base), slug: base?.slug || '' });
    setDirty(false);
    setSaveError('');
  }, [base, isCreateMode]);

  const { data: categoriesData, isFetching: categoriesLoading } = useListCategoriesLookupQuery(
    { limit: 200, sort: 'name', dir: 'ASC' },
    { refetchOnMountOrArgChange: true }
  );
  const { data: brandsData, isFetching: brandsLoading } = useListBrandsLookupQuery(
    { limit: 200, sort: 'name', dir: 'ASC' },
    { refetchOnMountOrArgChange: true }
  );
  const { data: productTypesData, isFetching: productTypesLoading } = useListProductTypesLookupQuery(
    { limit: 100, sort: 'name', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: taxCategoriesData, isFetching: taxCategoriesLoading } = useListTaxCategoriesLookupQuery(
    { limit: 100, sort: 'name', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: uomsData, isFetching: uomsLoading } = useListUomsLookupQuery(
    { limit: 100, sort: 'name', dir: 'ASC' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: suppliersData, isFetching: suppliersLoading } = useListCounterpartiesQuery(
    { limit: 100, sort: 'shortName', dir: 'ASC', type: 'supplier' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: manufacturersData, isFetching: manufacturersLoading } = useListCounterpartiesQuery(
    { limit: 100, sort: 'shortName', dir: 'ASC', type: 'manufacturer' },
    { refetchOnMountOrArgChange: false }
  );
  const { data: overviewPricesData } = useGetProductPricesQuery(productId, {
    skip: isCreateMode || !productId,
  });
  const { data: overviewMovementsData } = useGetProductMovementsQuery(
    { id: productId, page: 1, limit: 8 },
    { skip: isCreateMode || !productId }
  );
  const { data: overviewFilesData } = useListFilesByOwnerQuery(
    { ownerType: 'product', ownerId: productId },
    { skip: isCreateMode || !productId }
  );

  const categories = useMemo(() => {
    const selected = [base?.primaryCategory, base?.subcategory].filter(Boolean);
    const rows = [...selected, ...listItems(categoriesData)];
    const seen = new Set();
    return rows.filter((item) => {
      const key = String(item?.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [base?.primaryCategory, base?.subcategory, categoriesData]);

  const selectOptions = useMemo(() => {
    const mapRows = (rows, labelFn, secondaryFn, chip) => rows
      .filter((item) => item?.id)
      .map((item) => ({
        value: item.id,
        label: labelFn(item),
        secondary: secondaryFn?.(item) || null,
        chip: typeof chip === 'function' ? chip(item) : chip,
        preset: item.preset || null,
        raw: item,
      }))
      .sort(byLabel);

    const taxRows = [
      base?.taxCategory,
      ...listItems(taxCategoriesData),
    ].filter(Boolean);
    const existingTaxCodes = new Set(taxRows.map((item) => String(item?.code || '').toUpperCase()).filter(Boolean));
    const taxPresetRows = POLISH_TAX_PRESETS
      .filter((preset) => !existingTaxCodes.has(preset.code))
      .map((preset) => ({
        id: `preset:${preset.code}`,
        name: preset.name,
        code: preset.code,
        rate: preset.rate,
        preset,
      }));

    return {
      categories: mapRows(
        categories.filter((item) => !item?.parentId),
        (item) => item.name || item.slug || item.id,
        null,
        t('pim.product.detail.lookup.types.category', 'Category')
      ),
      subcategories: mapRows(
        categories.filter((item) => item?.parentId),
        (item) => item.name || item.slug || item.id,
        null,
        t('pim.product.detail.lookup.types.subcategory', 'Subcategory')
      ),
      brands: mapRows([
        base?.brand,
        ...listItems(brandsData),
      ].filter(Boolean), (item) => item.name || item.slug || item.id, null, t('pim.product.detail.lookup.types.brand', 'Brand')),
      suppliers: mapRows([
        base?.supplier,
        ...listItems(suppliersData),
      ].filter(Boolean), (item) => item.shortName || item.fullName || item.name || item.id, null, t('pim.product.detail.lookup.types.supplier', 'Supplier')),
      manufacturers: mapRows([
        base?.manufacturer,
        ...listItems(manufacturersData),
      ].filter(Boolean), (item) => item.shortName || item.fullName || item.name || item.id, null, t('pim.product.detail.lookup.types.manufacturer', 'Manufacturer')),
      productTypes: mapRows([
        base?.type,
        ...listItems(productTypesData),
      ].filter(Boolean), (item) => item.name || item.code || item.id, null, t('pim.product.detail.lookup.types.productType', 'Product type')),
      taxCategories: [...taxRows, ...taxPresetRows]
        .filter((item) => item?.id)
        .map((item) => ({
          value: item.id,
          label: taxPresetLabel(item),
          secondary: taxPresetSecondary(item, t),
          chip: t('pim.product.detail.lookup.types.taxCategory', 'Tax'),
          preset: item.preset || null,
          raw: item,
        }))
        .sort(byLabel),
      uoms: mapRows([
        base?.uom,
        ...listItems(uomsData),
      ].filter(Boolean), (item) => getUomSymbol(item, '') || item.code || item.name || item.id),
    };
  }, [base?.brand, base?.manufacturer, base?.supplier, base?.taxCategory, base?.type, base?.uom, brandsData, categories, manufacturersData, productTypesData, suppliersData, t, taxCategoriesData, uomsData]);

  const optionMaps = useMemo(() => ({
    categories: new Map([...selectOptions.categories, ...selectOptions.subcategories].map((item) => [String(item.value), item])),
    brands: new Map(selectOptions.brands.map((item) => [String(item.value), item])),
    suppliers: new Map(selectOptions.suppliers.map((item) => [String(item.value), item])),
    manufacturers: new Map(selectOptions.manufacturers.map((item) => [String(item.value), item])),
    productTypes: new Map(selectOptions.productTypes.map((item) => [String(item.value), item])),
    taxCategories: new Map(selectOptions.taxCategories.map((item) => [String(item.value), item])),
    uoms: new Map(selectOptions.uoms.map((item) => [String(item.value), item])),
  }), [selectOptions]);

  const setField = useCallback((field, next) => {
    setValues((prev) => ({ ...prev, [field]: next }));
    setDirty(true);
    setSaveError('');
  }, []);

  const createCategoryOption = useCallback(async ({ name, parentId } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    return createCategoryLookup(parentId ? { name: cleanName, parentId } : { name: cleanName }).unwrap();
  }, [createCategoryLookup]);

  const createBrandOption = useCallback(async ({ name } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    return createBrandLookup({ name: cleanName }).unwrap();
  }, [createBrandLookup]);

  const createProductTypeOption = useCallback(async ({ name } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    return createProductTypeLookup({
      name: cleanName,
      code: lookupCode(cleanName, 'PRODUCT_TYPE'),
      isActive: true,
    }).unwrap();
  }, [createProductTypeLookup]);

  const createSupplierOption = useCallback(async ({ name } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    return createCounterparty({
      type: 'supplier',
      shortName: cleanName,
      fullName: cleanName,
      status: 'active',
    }).unwrap();
  }, [createCounterparty]);

  const createManufacturerOption = useCallback(async ({ name } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    return createCounterparty({
      type: 'manufacturer',
      shortName: cleanName,
      fullName: cleanName,
      status: 'active',
    }).unwrap();
  }, [createCounterparty]);

  const createTaxCategoryOption = useCallback(async ({ name, code, rate } = {}) => {
    const cleanName = normalizeInputName(name);
    if (!cleanName) return null;
    const numericRate = Number(rate);
    return createTaxCategoryLookup({
      name: cleanName,
      code: code || lookupCode(cleanName, 'VAT'),
      rate: Number.isFinite(numericRate) ? numericRate : 23,
      isActive: true,
    }).unwrap();
  }, [createTaxCategoryLookup]);

  const handleSave = useCallback(async () => {
    const name = asText(values.name);
    if (!name) {
      setSaveError(t('pim.product.detail.validation.nameRequired', 'Product name is required.'));
      return;
    }
    const payload = toApiProduct({ ...values, name });
    try {
      if (isCreateMode) {
        const created = await createProduct(payload).unwrap();
        setDirty(false);
        if (created?.id) navigate(`/main/products/${created.id}`, { replace: true });
        return;
      }
      const saved = await updateProduct({ id, payload }).unwrap();
      setValues({ ...EMPTY_PRODUCT, ...toFormProduct(saved), slug: saved?.slug || '' });
      setDirty(false);
    } catch (error) {
      setSaveError(error?.data?.error || error?.data?.message || error?.message || t('pim.product.detail.messages.saveFailed', 'Failed to save product.'));
    }
  }, [createProduct, id, isCreateMode, navigate, t, updateProduct, values]);

  const selectedUom = optionMaps.uoms.get(String(values.uomId || '')) || base?.uom || null;
  const categoryLabel = optionLabel(optionMaps.categories, values.primaryCategoryId, t('common.none', '—'));
  const brandLabel = optionLabel(optionMaps.brands, values.brandId, t('common.none', '—'));
  const supplierLabel = optionLabel(optionMaps.suppliers, values.supplierId, t('common.none', '—'));
  const typeLabel = optionLabel(optionMaps.productTypes, values.productTypeId, productKindLabel(values, t));
  const available = inventoryAvailable(values);
  const canShowStock = Boolean(values.trackInventory) && !values.isService;
  const stockLabel = canShowStock
    ? formatQuantity(numberOrNull(values.stockQuantity) ?? 0, selectedUom, { fallback: '0' })
    : t('pim.product.detail.inventory.notTracked', 'Not tracked');
  const snapshot = useMemo(() => priceSnapshot(overviewPricesData, values), [overviewPricesData, values]);
  const overviewFiles = useMemo(() => listItems(overviewFilesData), [overviewFilesData]);
  const latestDocument = useMemo(() => latestByDate(overviewFiles), [overviewFiles]);
  const latestMovement = useMemo(() => latestByDate(listItems(overviewMovementsData)), [overviewMovementsData]);
  const saveState = saveError
    || (saving ? t('common.saving', 'Saving...') : dirty ? t('common.unsaved', 'Unsaved') : t('common.saved', 'Saved'));

  const tabs = useMemo(() => ([
    {
      key: 'overview',
      label: t('pim.product.detail.tabs.overview', 'Overview'),
      render: () => (
        <div className={s.v2Overview}>
          <OverviewSnapshot
            t={t}
            priceInfo={snapshot}
            latestMovement={latestMovement}
            latestDocument={latestDocument}
            supplierLabel={supplierLabel}
            selectedUom={selectedUom}
            locale={i18n.language}
          />
          {isCreateMode ? (
            <DetailSection title={t('pim.product.detail.sections.description', 'Description')}>
              <div className={s.v2EmptyDescription}>
                <FileText size={22} aria-hidden="true" />
                <div>
                  <strong>{t('pim.product.detail.description.saveFirstTitle', 'Save product first')}</strong>
                  <p>{t('pim.product.detail.description.saveFirstText', 'Description is available after the product exists.')}</p>
                </div>
              </div>
            </DetailSection>
          ) : (
            <HtmlDescriptionSection
              title={t('pim.product.detail.sections.description', 'Description')}
              value={String(values.description || '')}
              onSave={async (nextHtml) => {
                const saved = await updateDescription({
                  id: productId,
                  description: nextHtml || '',
                }).unwrap();
                const finalHtml = saved?.description ?? nextHtml ?? '';
                setValues((current) => ({ ...current, description: finalHtml }));
                return finalHtml;
              }}
              placeholder={t('pim.product.detail.description.placeholder', 'Describe product usage, technical details, and sales conditions...')}
              emptyText={t('pim.product.detail.description.emptyText', 'Description is empty. Add product context for sales, warehouse, and documents.')}
              minHeight={180}
            />
          )}
        </div>
      ),
    },
    {
      key: 'pricing',
      label: t('pim.product.detail.tabs.pricing', 'Pricing'),
      disabled: isCreateMode,
      render: () => isCreateMode ? <CreateTabHint t={t} /> : (
        <div className={s.v2TabStack}>
          <PriceSummary t={t} product={values} priceInfo={snapshot} />
          <ProductDetailTabs tab="prices" data={base} values={values} onChange={setField} />
        </div>
      ),
    },
    {
      key: 'inventory',
      label: t('pim.product.detail.tabs.inventory', 'Inventory'),
      disabled: isCreateMode,
      render: () => isCreateMode ? <CreateTabHint t={t} /> : (
        <div className={s.v2NestedStack}>
          <InventoryControls
            values={values}
            setField={setField}
            selectedUom={selectedUom}
            selectOptions={selectOptions}
            uomsLoading={uomsLoading}
            t={t}
          />
          <ProductDetailTabs tab="warehouse" data={base} values={values} onChange={setField} />
          <ProductDetailTabs tab="movements" data={base} values={values} onChange={setField} />
          {values.isLotTracked ? <ProductDetailTabs tab="lots" data={base} values={values} onChange={setField} /> : null}
          {values.isSerialized ? <ProductDetailTabs tab="serials" data={base} values={values} onChange={setField} /> : null}
          <ProductDetailTabs tab="reservations" data={base} values={values} onChange={setField} />
        </div>
      ),
    },
    {
      key: 'compliance',
      label: t('pim.product.detail.tabs.compliance', 'Compliance'),
      disabled: isCreateMode,
      render: () => isCreateMode ? <CreateTabHint t={t} /> : (
        <ComplianceSection
          values={values}
          setField={setField}
          t={t}
        />
      ),
    },
    {
      key: 'documents',
      label: t('pim.product.detail.tabs.documents', 'Documents'),
      disabled: isCreateMode,
      render: () => isCreateMode ? <CreateTabHint t={t} /> : (
        <ProductDetailTabs tab="files" data={base} values={values} onChange={setField} />
      ),
    },
    {
      key: 'notes',
      label: t('pim.product.detail.tabs.notes', 'Notes'),
      disabled: isCreateMode,
      render: () => isCreateMode ? <CreateTabHint t={t} /> : (
        <EntityNotesSection
          ownerType="product"
          ownerId={productId}
          title={t('pim.product.detail.notes.title', 'Product notes')}
          emptyTitle={t('pim.product.detail.notes.emptyTitle', 'No notes yet')}
          emptyText={t('pim.product.detail.notes.emptyText', 'Notes linked to this product will appear here.')}
          addNoteLabel={t('pim.product.detail.notes.add', 'Add note')}
          hideFiltersWhenEmpty
          hidePagerWhenSingle
        />
      ),
    },
    {
      key: 'system',
      label: t('pim.product.detail.tabs.system', 'System'),
      render: () => (
        <DetailSection title={t('pim.product.detail.sections.system', 'System')}>
          <div className={s.v2FactsList}>
            <FactRow label="ID" value={productId || t('pim.product.detail.system.notCreated', 'Not created yet')} />
            <FactRow label={t('pim.product.detail.fields.status', 'Status')} value={statusLabel(values.status, t)} />
            <FactRow label={t('pim.product.detail.fields.visibility', 'Visibility')} value={visibilityLabel(values.visibility, t)} />
            <FactRow label={t('pim.product.detail.fields.createdAt', 'Created')} value={dateTimeLabel(values.createdAt, i18n.language)} />
            <FactRow label={t('pim.product.detail.fields.updatedAt', 'Updated')} value={dateTimeLabel(values.updatedAt, i18n.language)} />
          </div>
        </DetailSection>
      ),
    },
  ]), [base, i18n.language, isCreateMode, latestDocument, latestMovement, productId, selectOptions, selectedUom, setField, snapshot, supplierLabel, t, uomsLoading, updateDescription, values]);

  const visibleTabs = tabs.map((tab) => ({
    ...tab,
    hidden: false,
    render: tab.disabled ? () => <CreateTabHint t={t} /> : tab.render,
  }));

  if (!isCreateMode && isFetching && !base) {
    return <div className={s.v2State}>{t('pim.product.detail.loading', 'Loading product...')}</div>;
  }

  if (!isCreateMode && !base) {
    return <div className={s.v2State}>{t('pim.product.detail.notFound', 'Product not found.')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.productDetailV2}
      header={(
        <header className={s.v2Hero}>
          <div className={s.v2HeroTop}>
            <button type="button" onClick={() => navigate('/main/products')} className={s.v2BackButton}>
              <ArrowLeft size={15} aria-hidden="true" />
              {t('pim.product.detail.actions.back', 'Back to products')}
            </button>
            <span className={`${s.v2SaveState} ${saveError ? s.v2SaveStateError : dirty ? s.v2SaveStateDirty : ''}`}>{saveState}</span>
          </div>
          <div className={s.v2HeroMain}>
            <MainImageBlock productId={productId} productName={values.name} disabled={isCreateMode} t={t} />
            <div className={s.v2HeroIdentity}>
              <h1>{values.name || t('pim.product.detail.createTitle', 'New product')}</h1>
              <div className={s.v2HeroIdentityLine}>
                <span>SKU {values.sku || t('pim.product.detail.empty.sku', 'No SKU')}</span>
                <span>EAN {values.ean || t('pim.product.detail.empty.ean', 'No EAN')}</span>
              </div>
              <div className={s.v2HeroMetaLine}>
                <span><Tags size={13} aria-hidden="true" />{categoryLabel}</span>
                <span><Building2 size={13} aria-hidden="true" />{brandLabel}</span>
                <span>{typeLabel}</span>
              </div>
            </div>
            <div className={s.v2HeroSignals}>
              <HeroVital
                label={t('pim.product.detail.fields.price', 'Price')}
                value={values.price === null || values.price === undefined || values.price === '' ? '—' : moneyLabel(values.price, '')}
                detail={values.currency || 'PLN'}
                tone="money"
              />
              <HeroVital
                label={t('pim.product.detail.inventory.stock', 'Stock')}
                value={stockLabel}
                tone={canShowStock ? 'stock' : 'muted'}
                detail={canShowStock && available !== null
                  ? t('pim.product.detail.inventory.availableLabel', '{{value}} available', { value: formatQuantity(available, selectedUom, { fallback: '0' }) })
                  : productKindLabel(values, t)}
              />
              <HeroVital
                label={t('pim.product.detail.fields.status', 'Status')}
                value={statusLabel(values.status, t)}
                detail={`${productKindLabel(values, t)} · ${visibilityLabel(values.visibility, t)}`}
                tone={String(values.status || '').toLowerCase() === 'active' ? 'ok' : 'muted'}
              />
            </div>
            <div className={s.v2HeroActions}>
              <button type="button" onClick={handleSave} disabled={saving}>
                <Save size={15} aria-hidden="true" />
                {isCreateMode ? t('pim.product.detail.actions.create', 'Create product') : t('common.save', 'Save')}
              </button>
              <Link to="/main/products">
                <Package size={15} aria-hidden="true" />
                {t('pim.product.detail.actions.products', 'Products')}
              </Link>
            </div>
          </div>
        </header>
      )}
      sidebar={(
        <aside className={s.v2Sidebar}>
          <DetailCard title={t('pim.product.detail.sections.identity', 'Identity')}>
            <FieldGrid>
              <TextField label={t('pim.product.detail.fields.name', 'Name')} value={values.name} onValueChange={(next) => setField('name', next)} required />
              <TextField label="SKU" value={values.sku} onValueChange={(next) => setField('sku', next)} />
              <TextField label="EAN" value={values.ean} onValueChange={(next) => setField('ean', next)} />
              <TextField label={t('pim.product.detail.fields.barcode', 'Barcode')} value={values.barcode} onValueChange={(next) => setField('barcode', next)} />
              <TextField label={t('pim.product.detail.fields.slug', 'Slug')} value={values.slug} onValueChange={(next) => setField('slug', next)} disabled />
            </FieldGrid>
            <FieldHint>{t('pim.product.detail.identifiers.eanBarcodeHint', 'EAN is the standard number. Barcode is any scannable code.')}</FieldHint>
          </DetailCard>

          <DetailCard title={t('pim.product.detail.sections.catalog', 'Catalog')}>
            <FieldGrid>
              <CreatableLookupField
                label={t('pim.product.detail.fields.category', 'Category')}
                value={values.primaryCategoryId}
                options={selectOptions.categories}
                onValueChange={(next) => setField('primaryCategoryId', next || '')}
                onCreate={createCategoryOption}
                loading={categoriesLoading}
                creating={creatingCategory}
                createLabel={(query) => t('pim.product.detail.lookup.createCategory', 'Create category "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdCategory', 'Category created and selected')}
                t={t}
              />
              <CreatableLookupField
                label={t('pim.product.detail.fields.subcategory', 'Subcategory')}
                value={values.subcategoryId}
                options={selectOptions.subcategories}
                onValueChange={(next) => setField('subcategoryId', next || '')}
                onCreate={(payload) => createCategoryOption({ ...payload, parentId: values.primaryCategoryId || null })}
                loading={categoriesLoading}
                creating={creatingCategory}
                createLabel={(query) => t('pim.product.detail.lookup.createSubcategory', 'Create subcategory "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdSubcategory', 'Subcategory created and selected')}
                t={t}
              />
              <CreatableLookupField
                label={t('pim.product.detail.fields.brand', 'Brand')}
                value={values.brandId}
                options={selectOptions.brands}
                onValueChange={(next) => setField('brandId', next || '')}
                onCreate={createBrandOption}
                loading={brandsLoading}
                creating={creatingBrand}
                createLabel={(query) => t('pim.product.detail.lookup.createBrand', 'Create brand "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdBrand', 'Brand created and selected')}
                t={t}
              />
              <CreatableLookupField
                label={t('pim.product.detail.fields.productType', 'Product type')}
                value={values.productTypeId}
                options={selectOptions.productTypes}
                onValueChange={(next) => setField('productTypeId', next || '')}
                onCreate={createProductTypeOption}
                loading={productTypesLoading}
                creating={creatingProductType}
                createLabel={(query) => t('pim.product.detail.lookup.createProductType', 'Create product type "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdProductType', 'Product type created and selected')}
                t={t}
              />
            </FieldGrid>
            <FieldHint>{t('pim.product.detail.lookup.saveHelper', 'New values are created immediately. The product selection is saved when you save the card.')}</FieldHint>
          </DetailCard>

          <DetailCard title={t('pim.product.detail.sections.partners', 'Partners')}>
            <FieldGrid>
              <CreatableLookupField
                label={t('pim.product.detail.fields.manufacturer', 'Manufacturer')}
                value={values.manufacturerId}
                options={selectOptions.manufacturers}
                onValueChange={(next) => setField('manufacturerId', next || '')}
                onCreate={createManufacturerOption}
                loading={manufacturersLoading}
                creating={creatingCounterparty}
                createLabel={(query) => t('pim.product.detail.lookup.createManufacturer', 'Create manufacturer "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdManufacturer', 'Manufacturer created and selected')}
                hint={t('pim.product.detail.lookup.partnerHint', 'Start typing to find or create a company.')}
                t={t}
              />
              <CreatableLookupField
                label={t('pim.product.detail.fields.supplier', 'Supplier')}
                value={values.supplierId}
                options={selectOptions.suppliers}
                onValueChange={(next) => setField('supplierId', next || '')}
                onCreate={createSupplierOption}
                loading={suppliersLoading}
                creating={creatingCounterparty}
                createLabel={(query) => t('pim.product.detail.lookup.createSupplier', 'Create supplier "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdSupplier', 'Supplier created and selected')}
                hint={t('pim.product.detail.lookup.partnerHint', 'Start typing to find or create a company.')}
                t={t}
              />
            </FieldGrid>
            <FieldHint>{t('pim.product.detail.partners.helper', 'Supplier is who you buy from. Manufacturer is who made it. They are often different companies.')}</FieldHint>
            <FieldHint compact>{t('pim.product.detail.lookup.saveHelper', 'New values are created immediately. The product selection is saved when you save the card.')}</FieldHint>
          </DetailCard>

          <DetailCard title={t('pim.product.detail.sections.commerce', 'Commerce')}>
            <FieldGrid>
              <NumberField label={t('pim.product.detail.fields.price', 'Price')} value={values.price} emitAs="string" step="0.01" onValueChange={(next) => setField('price', next)} />
              <TextField label={t('pim.product.detail.fields.currency', 'Currency')} value={values.currency} onValueChange={(next) => setField('currency', String(next || '').toUpperCase())} />
              <NumberField label={t('pim.product.detail.fields.oldPrice', 'Old price')} value={values.oldPrice} emitAs="string" step="0.01" onValueChange={(next) => setField('oldPrice', next)} />
              <NumberField label={t('pim.product.detail.fields.cost', 'Cost')} value={values.cost} emitAs="string" step="0.01" onValueChange={(next) => setField('cost', next)} />
              <CreatableLookupField
                label={t('pim.product.detail.fields.taxCategory', 'Tax category')}
                value={values.taxCategoryId}
                options={selectOptions.taxCategories}
                onValueChange={(next) => setField('taxCategoryId', next || '')}
                onCreate={createTaxCategoryOption}
                loading={taxCategoriesLoading}
                creating={creatingTaxCategory}
                createLabel={(query) => t('pim.product.detail.lookup.createTaxCategory', 'Create tax category "{{value}}"', { value: query })}
                createdMessage={t('pim.product.detail.lookup.createdTaxCategory', 'Tax category created and selected')}
                t={t}
              />
              <CheckboxField label={t('pim.product.detail.fields.sellable', 'Sellable')} checked={values.isSellable} onValueChange={(next) => setField('isSellable', next)} />
            </FieldGrid>
          </DetailCard>
        </aside>
      )}
      content={(
        <main className={s.v2Content}>
          <div className={s.v2WorkspaceSurface}>
            <DetailTabs
              tabs={visibleTabs}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
            />
          </div>
        </main>
      )}
    />
  );
}

function InventoryControls({ values, setField, selectedUom, selectOptions, uomsLoading, t }) {
  const available = inventoryAvailable(values);
  const stock = numberOrNull(values.stockQuantity);
  const reserved = numberOrNull(values.reservedQuantity);
  const ordered = numberOrNull(values.orderedQuantity);

  return (
    <DetailSection title={t('pim.product.detail.sections.inventoryControls', 'Inventory controls')}>
      <div className={s.v2NestedStack}>
        <div className={s.v2InventoryMetrics}>
          <Metric label={t('pim.product.detail.inventory.onHand', 'On hand')} value={formatQuantity(stock ?? 0, selectedUom, { fallback: '0' })} icon={<Boxes size={16} aria-hidden="true" />} tone="stock" />
          <Metric label={t('pim.product.detail.inventory.reserved', 'Reserved')} value={formatQuantity(reserved ?? 0, selectedUom, { fallback: '0' })} icon={<ShieldCheck size={16} aria-hidden="true" />} tone="muted" />
          <Metric label={t('pim.product.detail.inventory.ordered', 'Ordered')} value={formatQuantity(ordered ?? 0, selectedUom, { fallback: '0' })} icon={<ReceiptText size={16} aria-hidden="true" />} tone="muted" />
          <Metric label={t('pim.product.detail.inventory.available', 'Available')} value={formatQuantity(available ?? 0, selectedUom, { fallback: '0' })} icon={<PackageCheck size={16} aria-hidden="true" />} tone={(available ?? 0) > 0 ? 'ok' : 'warning'} />
        </div>
        <FieldGrid>
          <CheckboxField label={t('pim.product.detail.fields.trackInventory', 'Track inventory')} checked={values.trackInventory} onValueChange={(next) => setField('trackInventory', next)} />
          <SelectField clearable searchable loading={uomsLoading} label={t('pim.product.detail.fields.uom', 'UoM')} value={values.uomId} options={selectOptions.uoms} onValueChange={(next) => setField('uomId', next || '')} />
          <CheckboxField label={t('pim.product.detail.fields.service', 'Service')} checked={values.isService} onValueChange={(next) => setField('isService', next)} />
          <CheckboxField label={t('pim.product.detail.fields.serialized', 'Serialized')} checked={values.isSerialized} onValueChange={(next) => setField('isSerialized', next)} />
          <CheckboxField label={t('pim.product.detail.fields.lotTracked', 'Lot tracked')} checked={values.isLotTracked} onValueChange={(next) => setField('isLotTracked', next)} />
          <NumberField label={t('pim.product.detail.fields.shelfLife', 'Shelf life')} value={values.shelfLifeDays} emitAs="string" onValueChange={(next) => setField('shelfLifeDays', next)} />
        </FieldGrid>
      </div>
    </DetailSection>
  );
}

function ComplianceSection({ values, setField, t }) {
  return (
    <DetailSection title={t('pim.product.detail.sections.compliance', 'Compliance')}>
      <div className={s.v2NestedStack}>
        <FieldHint>{t('pim.product.detail.compliance.helper', 'Fiscal and customs identifiers used for tax reporting, customs, and product classification.')}</FieldHint>
        <FieldGrid>
          <TextField label="PKWiU" value={values.pkwiu} onValueChange={(next) => setField('pkwiu', next)} />
          <TextField label="CN" value={values.cn} onValueChange={(next) => setField('cn', next)} />
          <SelectField clearable label="GTU" value={values.gtu} options={GTU_OPTIONS} onValueChange={(next) => setField('gtu', next || '')} />
          <TextField label="HS" value={values.hsCode} onValueChange={(next) => setField('hsCode', next)} />
          <TextField label={t('pim.product.detail.fields.country', 'Country')} value={values.countryOfOrigin} onValueChange={(next) => setField('countryOfOrigin', String(next || '').toUpperCase())} />
        </FieldGrid>
      </div>
    </DetailSection>
  );
}

function CreatableLookupField({
  label,
  value,
  options = [],
  onValueChange,
  onCreate,
  loading,
  creating,
  t,
  placeholder,
  hint,
  createLabel,
  createdMessage,
}) {
  const selectedOption = useMemo(
    () => options.find((option) => String(option?.value || '') === String(value || '')) || null,
    [options, value]
  );
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [createdNotice, setCreatedNotice] = useState('');
  const noticeTimerRef = useRef(null);

  useEffect(() => {
    if (selectedOption) {
      setInputValue(selectedOption.label || '');
    } else if (!value) {
      setInputValue('');
    }
  }, [selectedOption, value]);

  useEffect(() => () => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const autocompleteOptions = useMemo(() => options.map((option) => ({
    ...option,
    id: option.value,
    name: option.label,
  })), [options]);

  const query = normalizeInputName(inputValue);
  const shouldShowCreate = Boolean(query)
    && !autocompleteOptions.some((option) => normalizeLookupText(option.name) === normalizeLookupText(query));

  const showCreatedNotice = useCallback(() => {
    setCreatedNotice(createdMessage || t('pim.product.detail.lookup.createdSelected', 'Created and selected'));
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setCreatedNotice(''), 3600);
  }, [createdMessage, t]);

  const handleSelect = useCallback(async (option) => {
    if (!option) return;
    setError('');
    setCreatedNotice('');
    if (option.preset && onCreate) {
      try {
        const created = await onCreate(option.preset);
        if (created?.id) {
          onValueChange?.(String(created.id));
          setInputValue(created.name || option.name || '');
          showCreatedNotice();
        }
      } catch (err) {
        setError(err?.data?.error || err?.data?.message || err?.message || t('pim.product.detail.lookup.createFailed', 'Failed to create value.'));
      }
      return;
    }
    onValueChange?.(String(option.id || ''));
    setInputValue(option.name || '');
  }, [onCreate, onValueChange, showCreatedNotice, t]);

  const handleCreate = useCallback(async () => {
    if (!query || !onCreate) return;
    setError('');
    setCreatedNotice('');
    try {
      const created = await onCreate({ name: query });
      if (created?.id) {
        onValueChange?.(String(created.id));
        setInputValue(created.name || query);
        showCreatedNotice();
      }
    } catch (err) {
      setError(err?.data?.error || err?.data?.message || err?.message || t('pim.product.detail.lookup.createFailed', 'Failed to create value.'));
    }
  }, [onCreate, onValueChange, query, showCreatedNotice, t]);

  return (
    <AutocompleteField
      label={label}
      value={selectedOption ? { id: selectedOption.value, name: selectedOption.label } : null}
      inputValue={inputValue}
      onInputChange={(next) => {
        setInputValue(next);
        setError('');
        if (selectedOption && normalizeLookupText(next) !== normalizeLookupText(selectedOption.label)) {
          onValueChange?.('');
        }
      }}
      options={autocompleteOptions}
      onSelect={handleSelect}
      getOptionSecondary={(option) => option?.secondary || null}
      placeholder={placeholder || t('pim.product.detail.lookup.placeholder', 'Start typing...')}
      hint={hint || t('pim.product.detail.lookup.hint', 'Type to search or create a new value.')}
      emptyLabel={t('pim.product.detail.lookup.empty', 'Nothing found')}
      searchingLabel={t('common.searching', 'Searching...')}
      loading={loading}
      error={error}
      helperText={createdNotice}
      opaque
      clearable
      showCreateAction={shouldShowCreate}
      createActionLabel={createLabel ? createLabel(query) : t('pim.product.detail.lookup.createValue', 'Create "{{value}}"', { value: query })}
      createActionLoading={creating}
      createActionLoadingLabel={t('common.creating', 'Creating…')}
      onCreateAction={handleCreate}
    />
  );
}

function SummaryCard({ icon, label, value, hint, tone = 'default' }) {
  return (
    <div className={`${s.v2SummaryCard} ${s[`v2SummaryCard_${tone}`] || ''}`}>
      <span className={s.v2SummaryIcon}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value === 0 || value ? value : '—'}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function OverviewSnapshot({ t, priceInfo, latestMovement, latestDocument, supplierLabel, selectedUom, locale }) {
  const movementQty = numberOrNull(latestMovement?.qty);
  const movementValue = Number.isFinite(movementQty)
    ? formatQuantity(movementQty, selectedUom, { fallback: '0' })
    : t('pim.product.detail.overview.noMovement', 'No movement yet');
  const movementDate = latestMovement?.createdAt || latestMovement?.updatedAt;
  const documentName = latestDocument?.filename || latestDocument?.safeName || latestDocument?.name || '';
  const supplierValue = supplierLabel || t('common.none', '—');
  const priceRows = (priceInfo?.saleCount || 0) + (priceInfo?.purchaseCount || 0);

  return (
    <DetailSection title={t('pim.product.detail.sections.operationalSnapshot', 'Operational snapshot')}>
      <div className={s.v2BriefGrid}>
        <SummaryCard
          icon={<BadgeDollarSign size={16} aria-hidden="true" />}
          label={t('pim.product.detail.overview.priceContext', 'Price context')}
          value={t('pim.product.detail.overview.priceRows', '{{count}} price rows', { count: priceRows })}
          hint={t('pim.product.detail.overview.priceHint', 'Sales {{sales}} · Purchase {{purchase}}', {
            sales: priceInfo?.saleCount ?? 0,
            purchase: priceInfo?.purchaseCount ?? 0,
          })}
        />
        <SummaryCard
          icon={<Warehouse size={16} aria-hidden="true" />}
          label={t('pim.product.detail.overview.latestMovement', 'Latest movement')}
          value={movementValue}
          hint={movementDate ? dateTimeLabel(movementDate, locale) : t('pim.product.detail.overview.noMovementHint', 'Warehouse activity will appear here.')}
          tone={movementQty > 0 ? 'ok' : movementQty < 0 ? 'warning' : 'default'}
        />
        <SummaryCard
          icon={<FileText size={16} aria-hidden="true" />}
          label={t('pim.product.detail.overview.latestDocument', 'Latest document')}
          value={documentName || t('pim.product.detail.overview.noDocument', 'No document yet')}
          hint={latestDocument?.createdAt ? dateTimeLabel(latestDocument.createdAt, locale) : t('pim.product.detail.overview.noDocumentHint', 'Files linked to this product will appear here.')}
        />
        <SummaryCard
          icon={<Building2 size={16} aria-hidden="true" />}
          label={t('pim.product.detail.overview.supplier', 'Supplier')}
          value={supplierValue}
          hint={t('pim.product.detail.overview.supplierHint', 'Primary purchase context')}
        />
      </div>
    </DetailSection>
  );
}

function PriceSummary({ t, product, priceInfo }) {
  const purchase = priceInfo?.purchase?.amount;
  const sale = priceInfo?.sale?.amount ?? numberOrNull(product?.price);
  const margin = priceInfo?.margin;
  const currency = priceInfo?.currency || product?.currency || 'PLN';
  const rowsCount = (priceInfo?.purchaseCount || 0) + (priceInfo?.saleCount || 0);
  const marginTone = Number.isFinite(margin) && margin >= 0 ? 'ok' : Number.isFinite(margin) ? 'warning' : 'muted';

  return (
    <DetailSection title={t('pim.product.detail.sections.priceSummary', 'Price summary')}>
      <div className={s.v2PriceStory}>
        <div>
          <span>{t('pim.product.detail.prices.purchase', 'Purchase')}</span>
          <strong>{Number.isFinite(purchase) ? moneyLabel(purchase, currency) : t('pim.product.detail.prices.noPurchase', 'No purchase price')}</strong>
        </div>
        <div>
          <span>{t('pim.product.detail.prices.sales', 'Sales')}</span>
          <strong>{Number.isFinite(sale) ? moneyLabel(sale, currency) : t('pim.product.detail.prices.noSales', 'No sales price')}</strong>
        </div>
        <div className={`${s.v2PriceStoryMargin} ${s[`v2PriceStoryMargin_${marginTone}`] || ''}`}>
          <span>{t('pim.product.detail.prices.margin', 'Margin')}</span>
          <strong>{Number.isFinite(margin) ? moneyLabel(margin, currency) : t('pim.product.detail.prices.noMargin', 'No margin')}</strong>
        </div>
        <small>{currency} · {t('pim.product.detail.prices.priceRows', '{{count}} price rows', { count: rowsCount })}</small>
      </div>
    </DetailSection>
  );
}

function CreateTabHint({ t }) {
  return (
    <DetailSection title={t('pim.product.detail.createTab.title', 'Save product first')}>
      <div className={s.v2EmptyDescription}>
        <Settings size={22} aria-hidden="true" />
        <div>
          <strong>{t('pim.product.detail.createTab.heading', 'This section unlocks after create')}</strong>
          <p>{t('pim.product.detail.createTab.text', 'Create the product to attach prices, stock, documents, and notes.')}</p>
        </div>
      </div>
    </DetailSection>
  );
}
