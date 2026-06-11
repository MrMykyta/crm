import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import EntityDetailPage from '../../../_scaffold/EntityDetailPage';
import Modal from '../../../../components/Modal';
import ConfirmDialog from '../../../../components/dialogs/ConfirmDialog';
import ThemedSelect from '../../../../components/inputs/RadixSelect';
import {
  productEntitySchema,
  toApiProduct,
  toFormProduct,
} from '../../../../schemas/product.schema';
import {
  useGetProductQuery,
  useCreateBrandLookupMutation,
  useCreateCategoryLookupMutation,
  useDeleteBrandLookupMutation,
  useDeleteCategoryLookupMutation,
  useListBrandsLookupQuery,
  useListCategoriesLookupQuery,
  useMergeBrandLookupMutation,
  useMergeCategoryLookupMutation,
  useListProductTypesLookupQuery,
  useListProductAttachmentsQuery,
  useCreateProductAttachmentMutation,
  useUpdateProductAttachmentMutation,
  useDeleteProductAttachmentMutation,
  useListTaxCategoriesLookupQuery,
  useUpdateBrandLookupMutation,
  useUpdateCategoryLookupMutation,
  useUpdateProductMutation,
  useListUomsLookupQuery,
} from '../../../../store/rtk/productsApi';
import {
  useGetSignedPreviewUrlQuery,
  useListFilesByOwnerQuery,
  useUploadFileMutation,
} from '../../../../store/rtk/filesApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import ProductDetailTabs from './ProductDetailTabs';
import { formatQuantity, getUomLabel, getUomSymbol } from '../../../../utils/uom';
import { withApiOrigin } from '../../../../config/api';
import s from './ProductDetailPage.module.css';

const BASE_TABS = [
  { key: 'description', label: 'Описание' },
  { key: 'files', label: 'Файлы' },
  { key: 'variants', label: 'Варианты' },
  { key: 'suppliers-purchase', label: 'Поставщики / Закупка' },
  { key: 'picker-demo', label: 'Подбор товара' },
  { key: 'prices', label: 'Цены' },
  { key: 'specifications', label: 'Характеристики' },
  { key: 'measurements', label: 'Измерения' },
  { key: 'movements', label: 'Передвижения' },
];

const BASE_GTU_OPTIONS = [
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
];

// byLabel: вспомогательная логика компонента.
function byLabel(a, b) {
  return String(a?.label || '').localeCompare(String(b?.label || ''), 'ru');
}
const PRODUCT_QUANTITY_UOM_FAMILIES = new Set(['piece', 'packaging', 'weight', 'volume', 'length']);
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

// useDebouncedValue: инкапсулирует переиспользуемую UI-логику.
function useDebouncedValue(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// computeEffectiveSellable: вспомогательная логика компонента.
function computeEffectiveSellable(values = {}) {
  const manual = Boolean(values?.isSellable);
  if (!manual) return false;

  const today = new Date().toISOString().slice(0, 10);
  const start = String(values?.saleStartDate || '').trim();
  const end = String(values?.saleEndDate || '').trim();

  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

function parseListPayload(payload) {
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

function MainImageBlock({ productId, productName }) {
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

  const attachments = useMemo(() => parseListPayload(attachmentData), [attachmentData]);
  const files = useMemo(() => parseListPayload(filesData), [filesData]);
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
  const imageFiles = useMemo(() => files.filter(isImageFile), [files]);

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
      setError('Можно загрузить только изображение');
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
      setError(e?.data?.message || e?.message || 'Не удалось загрузить main image');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [productId, promoteAttachment, uploadFile]);

  const removeMainImage = useCallback(async () => {
    if (!mainAttachment?.id) return;
    setBusy(true);
    setError('');
    try {
      await deleteProductAttachment({ id: mainAttachment.id, productId }).unwrap();
      await refetchAttachments();
    } catch (e) {
      setError(e?.data?.message || e?.message || 'Не удалось убрать main image');
    } finally {
      setBusy(false);
    }
  }, [deleteProductAttachment, mainAttachment?.id, productId, refetchAttachments]);

  return (
    <div className={s.mainImageBlock}>
      <div className={s.mainImagePreview}>
        {imageUrl ? (
          <img src={imageUrl} alt={mainFile?.filename || productName || 'Product image'} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className={s.mainImageActions}>
        <button
          type="button"
          className={s.mainImageAction}
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {mainAttachment ? 'Заменить фото' : 'Загрузить фото'}
        </button>
        {mainAttachment ? (
          <button
            type="button"
            className={`${s.mainImageAction} ${s.mainImageActionMuted}`}
            onClick={removeMainImage}
            disabled={busy}
          >
            Убрать
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
      {imageFiles.length && !mainAttachment ? (
        <div className={s.mainImageHint}>В файлах есть изображения. Их можно назначить main image во вкладке «Файлы».</div>
      ) : null}
      {mainFile ? <div className={s.mainImageFileName}>{mainFile.filename || mainFile.safeName}</div> : null}
      {error ? <div className={s.mainImageError}>{error}</div> : null}
    </div>
  );
}

// Компонент ProductDetailPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: base, isFetching } = useGetProductQuery(id, {
    refetchOnMountOrArgChange: true,
  });

  const [updateProduct, { isLoading: saving }] = useUpdateProductMutation();
  const [createCategoryLookup, { isLoading: creatingCategory }] = useCreateCategoryLookupMutation();
  const [createBrandLookup, { isLoading: creatingBrand }] = useCreateBrandLookupMutation();
  const [deleteCategoryLookup, { isLoading: deletingCategory }] = useDeleteCategoryLookupMutation();
  const [deleteBrandLookup, { isLoading: deletingBrand }] = useDeleteBrandLookupMutation();
  const [updateCategoryLookup, { isLoading: updatingCategory }] = useUpdateCategoryLookupMutation();
  const [updateBrandLookup, { isLoading: updatingBrand }] = useUpdateBrandLookupMutation();
  const [mergeCategoryLookup] = useMergeCategoryLookupMutation();
  const [mergeBrandLookup] = useMergeBrandLookupMutation();

  const [categorySearch, setCategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [createdCategories, setCreatedCategories] = useState([]);
  const [createdBrands, setCreatedBrands] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [renameState, setRenameState] = useState(null);
  const [managerState, setManagerState] = useState({ open: false, type: null });
  const [mergeState, setMergeState] = useState(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState(BASE_TABS[0].key);
  const [managerError, setManagerError] = useState('');
  const [managerBusyKey, setManagerBusyKey] = useState('');
  const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);
  const debouncedBrandSearch = useDebouncedValue(brandSearch, 300);
  const debouncedSubcategorySearch = useDebouncedValue(subcategorySearch, 300);
  const debouncedSupplierSearch = useDebouncedValue(supplierSearch, 300);

  const requestConfirm = useCallback(({ title, text, okText = 'Подтвердить' }) => (
    new Promise((resolve) => {
      setConfirmState({ title, text, okText, resolve });
    })
  ), []);

  const requestRename = useCallback(({ title, label, initialValue = '', okText = 'Сохранить' }) => (
    new Promise((resolve) => {
      setRenameState({
        title,
        label,
        value: String(initialValue || ''),
        okText,
        error: '',
        resolve,
      });
    })
  ), []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((prev) => {
      prev?.resolve?.(result);
      return null;
    });
  }, []);

  const closeRename = useCallback((nextValue) => {
    setRenameState((prev) => {
      prev?.resolve?.(nextValue);
      return null;
    });
  }, []);

  const submitRename = useCallback(() => {
    setRenameState((prev) => {
      if (!prev) return prev;
      const normalized = String(prev.value || '').trim();
      if (!normalized) {
        return { ...prev, error: 'Название не может быть пустым' };
      }
      prev.resolve?.(normalized);
      return null;
    });
  }, []);

  const { data: brandsData, isFetching: isBrandLookupFetching } = useListBrandsLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
      search: debouncedBrandSearch || undefined,
    },
    { refetchOnMountOrArgChange: true }
  );

  const { data: categoriesData, isFetching: isCategoryLookupFetching } = useListCategoriesLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
      search: debouncedCategorySearch || undefined,
    },
    { refetchOnMountOrArgChange: true }
  );

  const { data: subcategoriesLookupData, isFetching: isSubcategoryLookupFetching } = useListCategoriesLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
      search: debouncedSubcategorySearch || undefined,
    },
    { refetchOnMountOrArgChange: true }
  );

  const { data: categoriesManagerData, isFetching: isCategoriesManagerFetching } = useListCategoriesLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
      includeUsage: true,
    },
    {
      skip: !managerState.open || managerState.type !== 'category',
      refetchOnMountOrArgChange: true,
    }
  );

  const { data: brandsManagerData, isFetching: isBrandsManagerFetching } = useListBrandsLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
      includeUsage: true,
    },
    {
      skip: !managerState.open || managerState.type !== 'brand',
      refetchOnMountOrArgChange: true,
    }
  );

  const { data: suppliersData, isFetching: isSupplierLookupFetching } = useListCounterpartiesQuery(
    {
      limit: 100,
      sort: 'shortName',
      dir: 'ASC',
      excludeLeadClient: true,
      search: debouncedSupplierSearch || undefined,
    },
    { refetchOnMountOrArgChange: false }
  );

  const { data: uomsData, isFetching: isUomLookupFetching } = useListUomsLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
    },
    { refetchOnMountOrArgChange: false }
  );

  const { data: productTypesData, isFetching: isProductTypeLookupFetching } = useListProductTypesLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
    },
    { refetchOnMountOrArgChange: false }
  );

  const { data: taxCategoriesData, isFetching: isTaxCategoryLookupFetching } = useListTaxCategoriesLookupQuery(
    {
      limit: 100,
      sort: 'name',
      dir: 'ASC',
    },
    { refetchOnMountOrArgChange: false }
  );

  const allCategories = useMemo(() => {
    const baseSelected = [
      base?.primaryCategory ? {
        id: base.primaryCategory.id,
        name: base.primaryCategory.name,
        slug: base.primaryCategory.slug,
        parentId: base.primaryCategory.parentId || null,
      } : null,
      base?.subcategory ? {
        id: base.subcategory.id,
        name: base.subcategory.name,
        slug: base.subcategory.slug,
        parentId: base.subcategory.parentId || null,
      } : null,
    ].filter(Boolean);
    const categoryItems = Array.isArray(categoriesData?.items) ? categoriesData.items : [];
    const subcategoryItems = Array.isArray(subcategoriesLookupData?.items) ? subcategoriesLookupData.items : [];
    const merged = [...baseSelected, ...createdCategories, ...categoryItems, ...subcategoryItems];
    const seen = new Set();
    return merged.filter((item) => {
      const key = String(item?.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [base?.primaryCategory, base?.subcategory, categoriesData?.items, createdCategories, subcategoriesLookupData?.items]);

  const categoryById = useMemo(() => {
    return new Map(allCategories.map((item) => [String(item.id), item]));
  }, [allCategories]);

  const categoryOptions = useMemo(() => (
    allCategories
      .map((item) => ({
        value: item.id,
        label: item.name || item.slug || item.id,
      }))
      .sort(byLabel)
  ), [allCategories]);

  const subcategoryOptions = useMemo(() => {
    const children = allCategories.filter((item) => item?.parentId);
    return children
      .map((item) => {
        const parent = categoryById.get(String(item.parentId || ''));
        const parentLabel = parent?.name || parent?.slug || '';
        const label = item.name || item.slug || item.id;
        return {
          value: item.id,
          label,
          secondary: parentLabel ? `Категория: ${parentLabel}` : null,
          parentId: item.parentId || null,
        };
      })
      .sort(byLabel);
  }, [allCategories, categoryById]);

  const subcategoryOptionsByCategory = useCallback((values) => {
    const selectedCategoryId = String(values?.primaryCategoryId || '');
    if (!selectedCategoryId) return subcategoryOptions;

    const filtered = subcategoryOptions.filter(
      (item) => String(item.parentId || '') === selectedCategoryId
    );

    const selectedSubcategoryId = String(values?.subcategoryId || '');
    if (!selectedSubcategoryId) return filtered;

    const alreadyIncluded = filtered.some(
      (item) => String(item.value || '') === selectedSubcategoryId
    );
    if (alreadyIncluded) return filtered;

    const selectedSubcategory = subcategoryOptions.find(
      (item) => String(item.value || '') === selectedSubcategoryId
    );

    if (selectedSubcategory) return [selectedSubcategory, ...filtered];
    return [{ value: selectedSubcategoryId, label: selectedSubcategoryId }, ...filtered];
  }, [subcategoryOptions]);

  const brandOptions = useMemo(() => {
    const baseSelected = base?.brand ? [{
      id: base.brand.id,
      name: base.brand.name,
      slug: base.brand.slug,
    }] : [];
    const items = Array.isArray(brandsData?.items) ? brandsData.items : [];
    const merged = [...baseSelected, ...createdBrands, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        value: item.id,
        label: item.name || item.slug || item.id,
      }))
      .sort(byLabel);
  }, [base?.brand, brandsData?.items, createdBrands]);

  const supplierOptions = useMemo(() => {
    const selectedSupplier = base?.supplier
      ? [{
          id: base.supplier.id,
          shortName: base.supplier.shortName,
          fullName: base.supplier.fullName,
          type: base.supplier.type,
        }]
      : [];
    const items = Array.isArray(suppliersData?.items) ? suppliersData.items : [];
    const merged = [...selectedSupplier, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        value: item.id,
        label: item.shortName || item.fullName || item.id,
        secondary: [
          item.type ? `Тип: ${item.type}` : null,
          item.nip ? `NIP: ${item.nip}` : null,
          item.city || null,
        ]
          .filter(Boolean)
          .join(' • ') || null,
      }))
      .sort(byLabel);
  }, [base?.supplier, suppliersData?.items]);

  const supplierOptionById = useMemo(
    () => new Map(supplierOptions.map((item) => [String(item.value), item])),
    [supplierOptions]
  );

  const uomOptions = useMemo(() => {
    const selectedUom = base?.uom
      ? [{
          id: base.uom.id,
          code: base.uom.code,
          name: base.uom.name,
          symbol: base.uom.symbol,
          family: base.uom.family,
          precision: base.uom.precision,
        }]
      : [];
    const items = Array.isArray(uomsData?.items) ? uomsData.items : [];
    const merged = [...selectedUom, ...items];
    const seen = new Set();
    const selectedUomId = String(base?.uom?.id || '');

    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((item) => {
        const family = String(item?.family || '').toLowerCase();
        const isSelected = selectedUomId && String(item?.id || '') === selectedUomId;
        return isSelected || !family || PRODUCT_QUANTITY_UOM_FAMILIES.has(family);
      })
      .map((item) => ({
        value: item.id,
        label: item.symbol || item.code || item.name || item.id,
        secondary: [
          item.name || null,
          item.family ? `Семейство: ${item.family}` : null,
        ].filter(Boolean).join(' • ') || null,
        code: item.code || null,
        name: item.name || null,
        symbol: item.symbol || null,
        family: item.family || null,
        precision: item.precision,
      }))
      .sort(byLabel);
  }, [base?.uom, uomsData?.items]);

  const productTypeOptions = useMemo(() => {
    const selectedType = base?.type
      ? [{
          id: base.type.id,
          code: base.type.code,
          name: base.type.name,
        }]
      : [];
    const items = Array.isArray(productTypesData?.items) ? productTypesData.items : [];
    const merged = [...selectedType, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        value: item.id,
        label: item.name || item.code || item.id,
        secondary: item.code || null,
      }))
      .sort(byLabel);
  }, [base?.type, productTypesData?.items]);

  const taxCategoryOptions = useMemo(() => {
    const selectedTaxCategory = base?.taxCategory
      ? [{
          id: base.taxCategory.id,
          code: base.taxCategory.code,
          name: base.taxCategory.name,
          rate: base.taxCategory.rate,
        }]
      : [];
    const items = Array.isArray(taxCategoriesData?.items) ? taxCategoriesData.items : [];
    const merged = [...selectedTaxCategory, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        value: item.id,
        label: item.name || item.code || item.id,
        secondary: [
          item.code ? `Код: ${item.code}` : null,
          item.rate !== undefined && item.rate !== null ? `Ставка: ${item.rate}%` : null,
        ].filter(Boolean).join(' • ') || null,
      }))
      .sort(byLabel);
  }, [base?.taxCategory, taxCategoriesData?.items]);

  const gtuOptions = useMemo(() => {
    const set = new Set(BASE_GTU_OPTIONS);
    const existing = String(base?.gtu || '').trim();
    if (existing) set.add(existing);

    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((value) => ({ value, label: value }));
  }, [base?.gtu]);

  const categoryOptionById = useMemo(
    () => new Map(categoryOptions.map((item) => [String(item.value), item])),
    [categoryOptions]
  );
  const brandOptionById = useMemo(
    () => new Map(brandOptions.map((item) => [String(item.value), item])),
    [brandOptions]
  );
  const uomOptionById = useMemo(
    () => new Map(uomOptions.map((item) => [String(item.value), item])),
    [uomOptions]
  );
  const productTypeOptionById = useMemo(
    () => new Map(productTypeOptions.map((item) => [String(item.value), item])),
    [productTypeOptions]
  );
  const taxCategoryOptionById = useMemo(
    () => new Map(taxCategoryOptions.map((item) => [String(item.value), item])),
    [taxCategoryOptions]
  );

  const managerRows = useMemo(() => {
    if (managerState.type === 'category') {
      const items = Array.isArray(categoriesManagerData?.items) ? categoriesManagerData.items : [];
      return items.map((item) => ({
        id: item.id,
        name: item.name || item.slug || item.id,
        usageCount: Number(item?.usage?.totalCount || 0),
        usageExtra: `Основная: ${Number(item?.usage?.primaryCount || 0)}, Подкатегория: ${Number(item?.usage?.subcategoryCount || 0)}`,
      }));
    }
    if (managerState.type === 'brand') {
      const items = Array.isArray(brandsManagerData?.items) ? brandsManagerData.items : [];
      return items.map((item) => ({
        id: item.id,
        name: item.name || item.slug || item.id,
        usageCount: Number(item?.usage?.totalCount || 0),
        usageExtra: '',
      }));
    }
    return [];
  }, [brandsManagerData?.items, categoriesManagerData?.items, managerState.type]);

  const managerTargetOptions = useMemo(() => {
    if (!mergeState?.sourceId) return [];
    return managerRows
      .filter((row) => String(row.id) !== String(mergeState.sourceId))
      .map((row) => ({ value: row.id, label: `${row.name} (${row.usageCount})` }));
  }, [managerRows, mergeState?.sourceId]);

  const closeManager = useCallback(() => {
    setManagerState({ open: false, type: null });
    setManagerError('');
  }, []);

  const openMergeForRow = useCallback((row) => {
    setMergeState({
      type: managerState.type,
      sourceId: row.id,
      sourceName: row.name,
      sourceUsage: row.usageCount,
      targetId: '',
      error: '',
    });
  }, [managerState.type]);

  const handleManagerRename = useCallback(async (row) => {
    const nextName = await requestRename({
      title: managerState.type === 'brand' ? 'Переименование производителя' : 'Переименование категории',
      label: 'Новое название',
      initialValue: row.name,
      okText: 'Сохранить',
    });
    if (!nextName || nextName === row.name) return;

    setManagerError('');
    setManagerBusyKey(`rename:${row.id}`);
    try {
      if (managerState.type === 'brand') {
        await updateBrandLookup({ id: row.id, payload: { name: nextName } }).unwrap();
      } else {
        await updateCategoryLookup({ id: row.id, payload: { name: nextName } }).unwrap();
      }
    } catch (e) {
      setManagerError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось переименовать');
    } finally {
      setManagerBusyKey('');
    }
  }, [managerState.type, requestRename, updateBrandLookup, updateCategoryLookup]);

  const handleManagerDelete = useCallback(async (row) => {
    setManagerError('');

    let payload = {};
    if (row.usageCount > 0) {
      const confirmUnassign = await requestConfirm({
        title: 'Удаление используемой сущности',
        text: `«${row.name}» используется в ${row.usageCount} товарах. Отвязать от всех и удалить?`,
        okText: 'Отвязать и удалить',
      });
      if (!confirmUnassign) return;
      payload = { unassign: true };
    } else {
      const confirmDelete = await requestConfirm({
        title: managerState.type === 'brand' ? 'Удаление производителя' : 'Удаление категории',
        text: `Удалить «${row.name}»?`,
        okText: 'Удалить',
      });
      if (!confirmDelete) return;
    }

    setManagerBusyKey(`delete:${row.id}`);
    try {
      if (managerState.type === 'brand') {
        await deleteBrandLookup({ id: row.id, payload }).unwrap();
      } else {
        await deleteCategoryLookup({ id: row.id, payload }).unwrap();
      }
    } catch (e) {
      setManagerError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось удалить');
    } finally {
      setManagerBusyKey('');
    }
  }, [deleteBrandLookup, deleteCategoryLookup, managerState.type, requestConfirm]);

  const submitMerge = useCallback(async () => {
    if (!mergeState?.sourceId || !mergeState?.targetId) {
      setMergeState((prev) => (prev ? { ...prev, error: 'Выберите целевую сущность' } : prev));
      return;
    }

    setManagerError('');
    setManagerBusyKey(`merge:${mergeState.sourceId}`);
    try {
      if (mergeState.type === 'brand') {
        await mergeBrandLookup({
          id: mergeState.sourceId,
          targetId: mergeState.targetId,
        }).unwrap();
      } else {
        await mergeCategoryLookup({
          id: mergeState.sourceId,
          targetId: mergeState.targetId,
        }).unwrap();
      }
      setMergeState(null);
    } catch (e) {
      const msg = e?.data?.error || e?.data?.message || e?.message || 'Не удалось объединить';
      setMergeState((prev) => (prev ? { ...prev, error: msg } : prev));
    } finally {
      setManagerBusyKey('');
    }
  }, [mergeBrandLookup, mergeCategoryLookup, mergeState]);

  const schemaBuilder = useCallback(
    (i18n) => {
      const baseSchema = productEntitySchema(i18n, {
                // categoryOptions: вспомогательная логика компонента.
categoryOptions: (values) => {
          const selectedId = String(values?.primaryCategoryId || '');
          const selected = selectedId ? categoryOptionById.get(selectedId) : null;
          if (selected) return [selected, ...categoryOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...categoryOptions];
          return categoryOptions;
        },
        subcategoryOptions: subcategoryOptionsByCategory,
                // brandOptions: вспомогательная логика компонента.
brandOptions: (values) => {
          const selectedId = String(values?.brandId || '');
          const selected = selectedId ? brandOptionById.get(selectedId) : null;
          if (selected) return [selected, ...brandOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...brandOptions];
          return brandOptions;
        },
                // supplierOptions: вспомогательная логика компонента.
supplierOptions: (values) => {
          const selectedId = String(values?.supplierId || '');
          const selected = selectedId ? supplierOptionById.get(selectedId) : null;
          if (selected) return [selected, ...supplierOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...supplierOptions];
          return supplierOptions;
        },
                // uomOptions: вспомогательная логика компонента.
uomOptions: (values) => {
          const selectedId = String(values?.uomId || '');
          const selected = selectedId ? uomOptionById.get(selectedId) : null;
          if (selected) return [selected, ...uomOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...uomOptions];
          return uomOptions;
        },
                // productTypeOptions: вспомогательная логика компонента.
        productTypeOptions: (values) => {
          const selectedId = String(values?.productTypeId || '');
          const selected = selectedId ? productTypeOptionById.get(selectedId) : null;
          if (selected) return [selected, ...productTypeOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...productTypeOptions];
          return productTypeOptions;
        },
        taxCategoryOptions: (values) => {
          const selectedId = String(values?.taxCategoryId || '');
          const selected = selectedId ? taxCategoryOptionById.get(selectedId) : null;
          if (selected) return [selected, ...taxCategoryOptions.filter((item) => String(item.value) !== selectedId)];
          if (selectedId) return [{ value: selectedId, label: selectedId }, ...taxCategoryOptions];
          return taxCategoryOptions;
        },
        gtuOptions,
      });

      return baseSchema.map((field) => {
        if (field?.name === 'primaryCategoryId') {
          return {
            ...field,
            allowCreate: true,
            loading: Boolean(
              isCategoryLookupFetching
              || creatingCategory
              || deletingCategory
              || updatingCategory
            ),
            onSearchChange: setCategorySearch,
                        // createActionLabel: создаёт сущность в рамках UI-компонента.
createActionLabel: (text) => `Создать категорию «${text}»`,
            inlineOpenAction: true,
                        // onOpenSelected: вспомогательная логика компонента.
onOpenSelected: () => setManagerState({ open: true, type: 'category' }),
                        // onOpenManager: вспомогательная логика компонента.
onOpenManager: () => setManagerState({ open: true, type: 'category' }),
                        // onClearOption: вспомогательная логика компонента.
onClearOption: async (selectedOption) => {
              const selectedName = selectedOption?.label || selectedOption?.name || 'категория';
              return requestConfirm({
                title: 'Отвязка категории',
                text: `Отвязать «${selectedName}» от текущего товара?`,
                okText: 'Отвязать',
              });
            },
                        // canDeleteOption: проверяет доступность действия в рамках UI-компонента.
canDeleteOption: () => true,
                        // onDeleteOption: вспомогательная логика компонента.
onDeleteOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return;
              const ok = await requestConfirm({
                title: 'Удаление категории',
                text: `Удалить категорию «${opt?.name || opt?.label || targetId}»?`,
                okText: 'Удалить',
              });
              if (!ok) return;
              await deleteCategoryLookup({ id: targetId }).unwrap();
              setCreatedCategories((prev) => prev.filter((item) => String(item?.id || '') !== targetId));
            },
                        // canEditOption: проверяет доступность действия в рамках UI-компонента.
canEditOption: () => true,
                        // onEditOption: вспомогательная логика компонента.
onEditOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return null;
              const currentName = String(opt?.name || opt?.label || '').trim();
              const normalized = await requestRename({
                title: 'Переименование категории',
                label: 'Название категории',
                initialValue: currentName,
                okText: 'Сохранить',
              });
              if (!normalized || normalized === currentName) return null;
              const updated = await updateCategoryLookup({
                id: targetId,
                payload: { name: normalized },
              }).unwrap();
              if (updated?.id) {
                setCreatedCategories((prev) => prev.map((item) => (
                  String(item?.id || '') === String(updated.id)
                    ? { ...item, name: updated.name || normalized }
                    : item
                )));
              }
              return { value: updated?.id || targetId, label: updated?.name || normalized };
            },
                        // onCreateOption: вспомогательная логика компонента.
onCreateOption: async (name) => {
              const created = await createCategoryLookup({ name }).unwrap();
              if (created?.id) {
                setCreatedCategories((prev) => {
                  const key = String(created.id);
                  const next = prev.filter((item) => String(item?.id || '') !== key);
                  return [{ id: created.id, name: created.name || name, slug: created.slug, parentId: created.parentId || null }, ...next];
                });
              }
              return {
                value: created?.id,
                label: created?.name || name,
              };
            },
          };
        }

        if (field?.name === 'brandId') {
          return {
            ...field,
            allowCreate: true,
            loading: Boolean(
              isBrandLookupFetching
              || creatingBrand
              || deletingBrand
              || updatingBrand
            ),
            onSearchChange: setBrandSearch,
                        // createActionLabel: создаёт сущность в рамках UI-компонента.
createActionLabel: (text) => `Создать производителя «${text}»`,
            inlineOpenAction: true,
                        // onOpenSelected: вспомогательная логика компонента.
onOpenSelected: () => setManagerState({ open: true, type: 'brand' }),
                        // onOpenManager: вспомогательная логика компонента.
onOpenManager: () => setManagerState({ open: true, type: 'brand' }),
                        // onClearOption: вспомогательная логика компонента.
onClearOption: async (selectedOption) => {
              const selectedName = selectedOption?.label || selectedOption?.name || 'производитель';
              return requestConfirm({
                title: 'Отвязка производителя',
                text: `Отвязать «${selectedName}» от текущего товара?`,
                okText: 'Отвязать',
              });
            },
                        // canDeleteOption: проверяет доступность действия в рамках UI-компонента.
canDeleteOption: () => true,
                        // onDeleteOption: вспомогательная логика компонента.
onDeleteOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return;
              const ok = await requestConfirm({
                title: 'Удаление производителя',
                text: `Удалить производителя «${opt?.name || opt?.label || targetId}»?`,
                okText: 'Удалить',
              });
              if (!ok) return;
              await deleteBrandLookup({ id: targetId }).unwrap();
              setCreatedBrands((prev) => prev.filter((item) => String(item?.id || '') !== targetId));
            },
                        // canEditOption: проверяет доступность действия в рамках UI-компонента.
canEditOption: () => true,
                        // onEditOption: вспомогательная логика компонента.
onEditOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return null;
              const currentName = String(opt?.name || opt?.label || '').trim();
              const normalized = await requestRename({
                title: 'Переименование производителя',
                label: 'Название производителя',
                initialValue: currentName,
                okText: 'Сохранить',
              });
              if (!normalized || normalized === currentName) return null;
              const updated = await updateBrandLookup({
                id: targetId,
                payload: { name: normalized },
              }).unwrap();
              if (updated?.id) {
                setCreatedBrands((prev) => prev.map((item) => (
                  String(item?.id || '') === String(updated.id)
                    ? { ...item, name: updated.name || normalized }
                    : item
                )));
              }
              return { value: updated?.id || targetId, label: updated?.name || normalized };
            },
                        // onCreateOption: вспомогательная логика компонента.
onCreateOption: async (name) => {
              const created = await createBrandLookup({ name }).unwrap();
              if (created?.id) {
                setCreatedBrands((prev) => {
                  const key = String(created.id);
                  const next = prev.filter((item) => String(item?.id || '') !== key);
                  return [{ id: created.id, name: created.name || name, slug: created.slug }, ...next];
                });
              }
              return {
                value: created?.id,
                label: created?.name || name,
              };
            },
          };
        }

        if (field?.name === 'subcategoryId') {
          return {
            ...field,
            allowCreate: true,
            loading: Boolean(
              isSubcategoryLookupFetching
              || creatingCategory
              || deletingCategory
              || updatingCategory
            ),
            onSearchChange: setSubcategorySearch,
                        // createActionLabel: создаёт сущность в рамках UI-компонента.
createActionLabel: (text) => `Создать подкатегорию «${text}»`,
            inlineOpenAction: true,
                        // onOpenSelected: вспомогательная логика компонента.
onOpenSelected: () => setManagerState({ open: true, type: 'category' }),
                        // onOpenManager: вспомогательная логика компонента.
onOpenManager: () => setManagerState({ open: true, type: 'category' }),
                        // onClearOption: вспомогательная логика компонента.
onClearOption: async (selectedOption) => {
              const selectedName = selectedOption?.label || selectedOption?.name || 'подкатегория';
              return requestConfirm({
                title: 'Отвязка подкатегории',
                text: `Отвязать «${selectedName}» от текущего товара?`,
                okText: 'Отвязать',
              });
            },
                        // canDeleteOption: проверяет доступность действия в рамках UI-компонента.
canDeleteOption: () => true,
                        // onDeleteOption: вспомогательная логика компонента.
onDeleteOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return;
              const ok = await requestConfirm({
                title: 'Удаление подкатегории',
                text: `Удалить подкатегорию «${opt?.name || opt?.label || targetId}»?`,
                okText: 'Удалить',
              });
              if (!ok) return;
              await deleteCategoryLookup({ id: targetId }).unwrap();
              setCreatedCategories((prev) => prev.filter((item) => String(item?.id || '') !== targetId));
            },
                        // canEditOption: проверяет доступность действия в рамках UI-компонента.
canEditOption: () => true,
                        // onEditOption: вспомогательная логика компонента.
onEditOption: async (opt) => {
              const targetId = String(opt?.id || opt?.value || '');
              if (!targetId) return null;
              const currentName = String(opt?.name || opt?.label || '').trim();
              const normalized = await requestRename({
                title: 'Переименование подкатегории',
                label: 'Название подкатегории',
                initialValue: currentName,
                okText: 'Сохранить',
              });
              if (!normalized || normalized === currentName) return null;
              const updated = await updateCategoryLookup({
                id: targetId,
                payload: { name: normalized },
              }).unwrap();
              if (updated?.id) {
                setCreatedCategories((prev) => prev.map((item) => (
                  String(item?.id || '') === String(updated.id)
                    ? { ...item, name: updated.name || normalized }
                    : item
                )));
              }
              return { value: updated?.id || targetId, label: updated?.name || normalized };
            },
                        // onCreateOption: вспомогательная логика компонента.
onCreateOption: async (name, ctx) => {
              const parentId = String(ctx?.values?.primaryCategoryId || '').trim();
              if (!parentId) {
                throw new Error('Сначала выберите категорию');
              }
              const created = await createCategoryLookup({ name, parentId }).unwrap();
              if (created?.id) {
                setCreatedCategories((prev) => {
                  const key = String(created.id);
                  const next = prev.filter((item) => String(item?.id || '') !== key);
                  return [{ id: created.id, name: created.name || name, slug: created.slug, parentId: created.parentId || parentId }, ...next];
                });
              }
              return {
                value: created?.id,
                label: created?.name || name,
              };
            },
          };
        }

        if (field?.name === 'supplierId') {
          return {
            ...field,
            loading: Boolean(isSupplierLookupFetching),
            onSearchChange: setSupplierSearch,
            inlineOpenAction: true,
                        // onOpenSelected: вспомогательная логика компонента.
onOpenSelected: ({ selected }) => {
              const targetId = String(selected?.value || '').trim();
              if (!targetId) return;
              navigate(`/main/counterparties/${targetId}`);
            },
                        // onOpenManager: вспомогательная логика компонента.
onOpenManager: () => navigate('/main/counterparties'),
                        // onClearOption: вспомогательная логика компонента.
onClearOption: async (selectedOption) => {
              const selectedName = selectedOption?.label || selectedOption?.name || 'поставщик';
              return requestConfirm({
                title: 'Отвязка поставщика',
                text: `Отвязать «${selectedName}» от текущего товара?`,
                okText: 'Отвязать',
              });
            },
          };
        }

        if (field?.name === 'uomId') {
          return {
            ...field,
            loading: Boolean(isUomLookupFetching),
          };
        }

        if (field?.name === 'productTypeId') {
          return {
            ...field,
            loading: Boolean(isProductTypeLookupFetching),
          };
        }

        if (field?.name === 'taxCategoryId') {
          return {
            ...field,
            loading: Boolean(isTaxCategoryLookupFetching),
          };
        }

        return field;
      });
    },
    [
      brandOptionById,
      brandOptions,
      categoryOptionById,
      categoryOptions,
      createBrandLookup,
      createCategoryLookup,
      deleteBrandLookup,
      deleteCategoryLookup,
      updateBrandLookup,
      updateCategoryLookup,
      requestConfirm,
      requestRename,
      deletingBrand,
      deletingCategory,
      creatingBrand,
      creatingCategory,
      updatingBrand,
      updatingCategory,
      gtuOptions,
      isBrandLookupFetching,
      isCategoryLookupFetching,
      isSubcategoryLookupFetching,
      isSupplierLookupFetching,
      isProductTypeLookupFetching,
      isTaxCategoryLookupFetching,
      isUomLookupFetching,
      subcategoryOptionsByCategory,
      supplierOptionById,
      supplierOptions,
      productTypeOptionById,
      productTypeOptions,
      taxCategoryOptionById,
      taxCategoryOptions,
      uomOptionById,
      uomOptions,
      navigate,
    ]
  );

  const save = useCallback(
    async (entityId, payload) => {
      const saved = await updateProduct({ id: entityId, payload }).unwrap();
      return saved;
    },
    [updateProduct]
  );

  const detailTabs = useMemo(() => {
    const out = [...BASE_TABS];
    out.splice(3, 0, { key: 'warehouse', label: t('pim.stock.tab') });
    out.splice(
      4,
      0,
      { key: 'reservations', label: t('wms.reservations.title') },
      { key: 'lots', label: t('wms.lots.title') },
      { key: 'serials', label: t('wms.serials.title') }
    );
    return out;
  }, [t]);

  const renderLeftTop = useCallback(
    ({ values, onChange }) => {
      const categoryLabel = categoryOptionById.get(String(values?.primaryCategoryId || ''))?.label
        || base?.primaryCategory?.name
        || 'Не выбрана';
      const subcategoryLabel = categoryOptionById.get(String(values?.subcategoryId || ''))?.label
        || base?.subcategory?.name
        || 'Не выбрана';
      const brandLabel = brandOptionById.get(String(values?.brandId || ''))?.label
        || base?.brand?.name
        || 'Не выбран';
      const supplierLabel = supplierOptionById.get(String(values?.supplierId || ''))?.label
        || base?.supplier?.shortName
        || 'Не выбран';
      const productTypeLabel = productTypeOptionById.get(String(values?.productTypeId || ''))?.label
        || base?.type?.name
        || 'Не выбран';
      const taxCategoryLabel = taxCategoryOptionById.get(String(values?.taxCategoryId || ''))?.label
        || base?.taxCategory?.name
        || 'Не выбрана';
      const selectedUom = uomOptionById.get(String(values?.uomId || '')) || base?.uom || null;
      const uomLabel = getUomSymbol(selectedUom, '') || getUomLabel(selectedUom, 'Не выбрана');
      const effectiveSellable = computeEffectiveSellable(values);
      const trackInventory = Boolean(values?.trackInventory);
      const stockQuantity = Number(values?.stockQuantity ?? base?.stockQuantity);
      const lastUpdate = new Date(base?.updatedAt || base?.createdAt || Date.now()).toLocaleString();
      const statusLabel = (
        values?.status === 'active' ? 'Активен'
          : values?.status === 'archived' ? 'Архив'
            : 'Черновик'
      );
      const visibilityLabel = values?.visibility === 'private' ? 'Скрытый' : 'Публичный';
      const hasStock = trackInventory && Number.isFinite(stockQuantity);
      const formattedStock = formatQuantity(stockQuantity, selectedUom, { fallback: '—' });
      const active = values?.status === 'active';

      return (
      <div className={s.heroCard}>
        <MainImageBlock productId={id} productName={values?.name || base?.name || 'Товар'} />
        <div className={s.heroMain}>
          <div className={s.heroIdentity}>
            <div className={s.heroKicker}>
              <span>{values?.isService ? 'Услуга' : 'Товар'}</span>
              <span>{statusLabel}</span>
            </div>
            <h2 className={s.heroTitle}>{values?.name || base?.name || 'Товар'}</h2>
            <div className={s.heroMeta}>
              {values?.sku ? <span>SKU: {values.sku}</span> : <span>SKU не указан</span>}
              <span>EAN: {values?.ean || 'не указан'}</span>
              <span>Производитель: {brandLabel}</span>
              <span>Категория: {categoryLabel}</span>
              <span>Обновлен: {lastUpdate}</span>
            </div>
          </div>
          <div className={s.heroStats}>
            {subcategoryLabel !== 'Не выбрана' ? <span className={s.heroStatChip}><b>Подкатегория:</b> {subcategoryLabel}</span> : null}
            <span className={s.heroStatChip}><b>Видимость:</b> {visibilityLabel}</span>
            <span className={s.heroStatChip}><b>Ед. изм.:</b> {uomLabel}</span>
            {supplierLabel !== 'Не выбран' ? <span className={s.heroStatChip}><b>Поставщик:</b> {supplierLabel}</span> : null}
            {productTypeLabel !== 'Не выбран' ? <span className={s.heroStatChip}><b>Тип:</b> {productTypeLabel}</span> : null}
            {taxCategoryLabel !== 'Не выбрана' ? <span className={s.heroStatChip}><b>Налог:</b> {taxCategoryLabel}</span> : null}
            {hasStock ? <span className={s.heroStatChip}><b>Остаток:</b> {formattedStock}</span> : null}
          </div>
          <div className={s.heroActions}>
            <button
              type="button"
              className={s.heroActionBtn}
              onClick={() => {
                setHeaderMenuOpen(false);
                const field = document.getElementById('name');
                if (field && typeof field.focus === 'function') field.focus();
              }}
            >
              Редактировать
            </button>
            <div className={s.heroMenuWrap}>
              <button
                type="button"
                className={s.heroActionBtn}
                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                aria-expanded={headerMenuOpen}
              >
                ⋯
              </button>
              {headerMenuOpen ? (
                <div className={s.heroMenu}>
                  <button
                    type="button"
                    className={s.heroMenuItem}
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      navigate('/main/products');
                    }}
                  >
                    Перейти к списку товаров
                  </button>
                  <button
                    type="button"
                    className={s.heroMenuItem}
                    onClick={() => {
                      onChange?.('status', 'active');
                      setHeaderMenuOpen(false);
                    }}
                  >
                    Статус: Активен
                  </button>
                  <button
                    type="button"
                    className={s.heroMenuItem}
                    onClick={() => {
                      onChange?.('status', 'archived');
                      setHeaderMenuOpen(false);
                    }}
                  >
                    Статус: Архив
                  </button>
                  <button
                    type="button"
                    className={s.heroMenuItem}
                    onClick={() => {
                      onChange?.('visibility', values?.visibility === 'private' ? 'public' : 'private');
                      setHeaderMenuOpen(false);
                    }}
                  >
                    {values?.visibility === 'private' ? 'Сделать публичным' : 'Скрыть товар'}
                  </button>
                  <button
                    type="button"
                    className={`${s.heroMenuItem} ${s.heroMenuItemDanger}`}
                    disabled
                    title="Удаление будет доступно после отдельного endpoint"
                  >
                    Удалить товар
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={s.heroStatusPanel} aria-label="Статус товара">
          <span className={active ? s.heroStateChipOn : s.heroStateChipOff}>
            {active ? 'Активен' : statusLabel}
          </span>
          <button
            type="button"
            className={effectiveSellable ? s.heroStateChipOn : s.heroStateChipOff}
            onClick={() => onChange?.('isSellable', !Boolean(values?.isSellable))}
            title="Быстрое переключение признака «Продаётся»"
          >
            {effectiveSellable
              ? 'Продаётся'
              : (values?.isSellable ? 'Не продаётся сейчас' : 'Не продаётся')}
          </button>
          <span className={trackInventory ? s.heroStateChipOn : s.heroStateChipOff}>
            {trackInventory ? 'Учитываются остатки' : 'Без учета остатков'}
          </span>
          <span className={values?.isService ? s.heroStateChipService : s.heroStateChipProduct}>
            {values?.isService ? 'Услуга' : 'Товар'}
          </span>
        </div>
      </div>
      );
    },
    [
      base?.brand?.name,
      base?.createdAt,
      base?.name,
      base?.primaryCategory?.name,
      base?.stockQuantity,
      base?.subcategory?.name,
      base?.supplier?.shortName,
      base?.taxCategory?.name,
      base?.type?.name,
      base?.uom,
      base?.updatedAt,
      brandOptionById,
      categoryOptionById,
      productTypeOptionById,
      supplierOptionById,
      taxCategoryOptionById,
      headerMenuOpen,
      id,
      navigate,
      uomOptionById,
    ]
  );

  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <>
      <EntityDetailPage
        id={id}
        tabs={detailTabs}
        tabsNamespace="pim.product.detail"
        schemaBuilder={schemaBuilder}
        toForm={toFormProduct}
        toApi={toApiProduct}
        isSaving={saving}
        load={async () => base}
        save={save}
        storageKeyPrefix="product"
        autosave={{ debounceMs: 500 }}
        saveOnExit
        clearDraftOnUnmount
        leftTop={renderLeftTop}
        RightTabsComponent={ProductDetailTabs}
        activeTab={activeDetailTab}
        onActiveTabChange={setActiveDetailTab}
        layoutClassName={s.layout}
        leftPaneClassName={s.leftPane}
        rightPaneClassName={s.rightPane}
        tabsClassName={s.tabsArea}
        panelClassName={s.panel}
        formClassName={s.leftForm}
        formVariant="productDetail"
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || 'Подтверждение'}
        text={confirmState?.text || ''}
        okText={confirmState?.okText || 'Подтвердить'}
        cancelText="Отмена"
        onOk={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />

      <Modal
        open={Boolean(renameState)}
        onClose={() => closeRename(null)}
        title={renameState?.title || 'Переименование'}
        footer={(
          <>
            <Modal.Button onClick={() => closeRename(null)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" onClick={submitRename}>
              {renameState?.okText || 'Сохранить'}
            </Modal.Button>
          </>
        )}
      >
        <div className={s.modalForm}>
          <div className={s.field}>
            <label className={s.label}>
              {renameState?.label || 'Название'}
            </label>
            <input
              className={s.input}
              value={renameState?.value || ''}
              onChange={(e) => {
                const next = e.target.value;
                setRenameState((prev) => (
                  prev
                    ? { ...prev, value: next, error: '' }
                    : prev
                ));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitRename();
                }
              }}
              autoFocus
              maxLength={160}
            />
          </div>
          {renameState?.error ? <div className={s.error}>{renameState.error}</div> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(managerState.open)}
        onClose={closeManager}
        title={managerState.type === 'brand' ? 'Управление производителями' : 'Управление категориями'}
        size="md"
        footer={(
          <>
            <Modal.Button onClick={closeManager}>Закрыть</Modal.Button>
          </>
        )}
      >
        <div className={s.managerWrap}>
          <div className={s.managerHint}>
            {managerState.type === 'brand'
              ? 'Переименование обновит отображение во всех связанных товарах. Для дублей используйте объединение.'
              : 'Переименование обновит отображение во всех связанных товарах. Для дублей используйте объединение.'}
          </div>
          <div className={s.managerTable}>
            <div className={s.managerHead}>
              <span>Название</span>
              <span>Связано</span>
              <span>Действия</span>
            </div>
            {(managerRows || []).map((row) => (
              <div key={row.id} className={s.managerRow}>
                <div className={s.managerName}>
                  <div>{row.name}</div>
                  {row.usageExtra ? <small>{row.usageExtra}</small> : null}
                </div>
                <div className={s.managerUsage}>{row.usageCount}</div>
                <div className={s.managerActions}>
                  <button
                    type="button"
                    className={s.actionBtn}
                    onClick={() => handleManagerRename(row)}
                    disabled={Boolean(managerBusyKey)}
                  >
                    {managerBusyKey === `rename:${row.id}` ? '...' : 'Переименовать'}
                  </button>
                  <button
                    type="button"
                    className={s.actionBtn}
                    onClick={() => openMergeForRow(row)}
                    disabled={Boolean(managerBusyKey)}
                  >
                    Объединить
                  </button>
                  <button
                    type="button"
                    className={`${s.actionBtn} ${s.actionDanger}`}
                    onClick={() => handleManagerDelete(row)}
                    disabled={Boolean(managerBusyKey)}
                  >
                    {managerBusyKey === `delete:${row.id}` ? '...' : 'Удалить'}
                  </button>
                </div>
              </div>
            ))}
            {((managerRows || []).length === 0) ? (
              <div className={s.emptyInline}>
                {isCategoriesManagerFetching || isBrandsManagerFetching ? 'Загрузка...' : 'Нет данных'}
              </div>
            ) : null}
          </div>
          {managerError ? <div className={s.error}>{managerError}</div> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(mergeState)}
        onClose={() => setMergeState(null)}
        title={mergeState?.type === 'brand' ? 'Объединение производителей' : 'Объединение категорий'}
        size="sm"
        footer={(
          <>
            <Modal.Button onClick={() => setMergeState(null)}>Отмена</Modal.Button>
            <Modal.Button variant="primary" onClick={submitMerge} disabled={Boolean(managerBusyKey)}>
              {Boolean(managerBusyKey) ? 'Объединение...' : 'Объединить'}
            </Modal.Button>
          </>
        )}
      >
        <div className={s.modalForm}>
          <div className={s.hint}>
            Источник: <b>{mergeState?.sourceName || '—'}</b>
            {typeof mergeState?.sourceUsage === 'number' ? ` (товаров: ${mergeState.sourceUsage})` : ''}
          </div>
          <label className={s.field}>
            <span className={s.label}>Перенести в</span>
            <ThemedSelect
              value={mergeState?.targetId || ''}
              onChange={(value) => setMergeState((prev) => (prev ? { ...prev, targetId: value, error: '' } : prev))}
              options={[{ value: '', label: 'Выберите целевую сущность' }, ...managerTargetOptions]}
            />
          </label>
          {mergeState?.error ? <div className={s.error}>{mergeState.error}</div> : null}
        </div>
      </Modal>
    </>
  );
}
