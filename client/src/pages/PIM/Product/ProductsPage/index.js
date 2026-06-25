import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Workspace,
  useWorkspaceData,
} from '../../../../components/workspace';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import Modal from '../../../../components/Modal';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import { createProductListColumns } from '../../../../components/workspace/columnSchemas/productsColumns';
import {
  useCreateBrandLookupMutation,
  useCreateCategoryLookupMutation,
  useCreateProductMutation,
  useListProductsQuery,
  useListBrandsLookupQuery,
  useListCategoriesLookupQuery,
} from '../../../../store/rtk/productsApi';
import { AutocompleteField, SearchField, SelectField, TextField } from '../../../../components/ui/fields';
import s from './ProductsPage.module.css';

const defaultCreate = {
  name: '',
  primaryCategoryId: '',
  brandId: '',
  sku: '',
};

// useDebouncedValue: инкапсулирует переиспользуемую UI-логику.
function useDebouncedValue(value, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// normalizeText: нормализует данные для отображения и ввода.
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const sanitizeProductsQuery = (query = {}) => Object.fromEntries(
  Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

function humanizeColumnKey(key) {
  return String(key || '')
    .replace(/^customFields\./, '')
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeValueForCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const chunks = value.map((item) => normalizeValueForCell(item)).filter((item) => item && item !== '—');
    return chunks.length ? chunks.join(', ') : '—';
  }
  if (typeof value === 'object') {
    const label = value.name || value.title || value.label || value.fullName || value.shortName || value.id || null;
    if (label) return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

function buildCustomFieldColumns(rows = [], fixedColumns = []) {
  const fixedKeys = new Set(fixedColumns.map((column) => column.key));
  const customFields = new Set();

  rows.slice(0, 120).forEach((row) => {
    const fields = row?.customFields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return;
    Object.keys(fields).forEach((fieldKey) => {
      const key = `customFields.${fieldKey}`;
      if (!fixedKeys.has(key)) customFields.add(fieldKey);
    });
  });

  return [...customFields]
    .sort((a, b) => a.localeCompare(b))
    .map((fieldKey) => {
      const key = `customFields.${fieldKey}`;
      const label = humanizeColumnKey(fieldKey);
      return {
        key,
        title: label,
        fallbackLabel: label,
        category: 'custom',
        defaultVisible: false,
        sortable: false,
        width: 190,
        minWidth: 120,
        maxWidth: 360,
        render: (row) => normalizeValueForCell(row?.customFields?.[fieldKey]),
      };
    });
}

// Компонент ProductsPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openAsModal = useOpenAsModal();
  const listRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState(defaultCreate);
  const [categorySearch, setCategorySearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [createLookupError, setCreateLookupError] = useState('');
  const [createdCategoryOptions, setCreatedCategoryOptions] = useState([]);
  const [createdBrandOptions, setCreatedBrandOptions] = useState([]);

  const [createProduct] = useCreateProductMutation();
  const [createCategoryLookup, { isLoading: creatingCategory }] = useCreateCategoryLookupMutation();
  const [createBrandLookup, { isLoading: creatingBrand }] = useCreateBrandLookupMutation();

  const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);
  const debouncedBrandSearch = useDebouncedValue(brandSearch, 300);

  const { data: categoriesFilterData } = useListCategoriesLookupQuery({ limit: 100, sort: 'name', dir: 'ASC' });
  const { data: brandsFilterData } = useListBrandsLookupQuery({ limit: 100, sort: 'name', dir: 'ASC' });

  const { data: categoriesData, isFetching: searchingCategories } = useListCategoriesLookupQuery({
    limit: 25,
    sort: 'name',
    dir: 'ASC',
    search: debouncedCategorySearch || undefined,
  });
  const { data: brandsData, isFetching: searchingBrands } = useListBrandsLookupQuery({
    limit: 25,
    sort: 'name',
    dir: 'ASC',
    search: debouncedBrandSearch || undefined,
  });

  const {
    colWidths,
    colOrder,
    colVisibility,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
  } = useGridPrefs('pim.products');

  const defaultQuery = useMemo(() => ({ page: 1, sort: 'createdAt', dir: 'DESC', limit: 25 }), []);
  const [query, setQuery] = useState(defaultQuery);
  const apiQuery = useMemo(() => sanitizeProductsQuery(query), [query]);
  const {
    data: productsData,
    isFetching: productsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useListProductsQuery(apiQuery);

  const loadedProducts = useMemo(() => {
    if (Array.isArray(productsData)) return productsData;
    if (Array.isArray(productsData?.items)) return productsData.items;
    if (Array.isArray(productsData?.data)) return productsData.data;
    return [];
  }, [productsData]);
  const productsTotal = Number(productsData?.total ?? loadedProducts.length ?? 0);
  const hasAnyFilter = Boolean(query.search || query.categoryId || query.brandId || query.isSellable);

  const workspaceData = useWorkspaceData({
    externalData: loadedProducts,
    externalMeta: {
      total: productsTotal,
      page: productsData?.page || query.page || defaultQuery.page,
      limit: productsData?.limit || query.limit || defaultQuery.limit,
    },
    externalLoading: productsLoading,
    externalError: productsError,
    onExternalRefetch: refetchProducts,
    query,
    onQueryChange: setQuery,
    defaultQuery,
  });

  const updateFilter = useCallback((key, value) => {
    setQuery((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  }, []);

  const columnState = useMemo(() => ({
    widths: colWidths,
    order: colOrder,
    visibility: colVisibility,
  }), [colOrder, colVisibility, colWidths]);

  const handleColumnStateChange = useCallback((next = {}) => {
    onColumnResize(next.widths || {});
    onColumnOrderChange(Array.isArray(next.order) ? next.order : []);
    onColumnVisibilityChange(next.visibility || {});
  }, [onColumnOrderChange, onColumnResize, onColumnVisibilityChange]);

  const categoryOptions = useMemo(() => {
    const items = Array.isArray(categoriesFilterData?.items) ? categoriesFilterData.items : [];
    const mapped = items.map((item) => ({
      value: item.id,
      label: item.name || item.slug || item.id,
    }));
    return [{ value: '', label: 'Все категории' }, ...mapped];
  }, [categoriesFilterData?.items]);

  const brandOptions = useMemo(() => {
    const items = Array.isArray(brandsFilterData?.items) ? brandsFilterData.items : [];
    const mapped = items.map((item) => ({
      value: item.id,
      label: item.name || item.slug || item.id,
    }));
    return [{ value: '', label: 'Все производители' }, ...mapped];
  }, [brandsFilterData?.items]);

  const categoryAutocompleteOptions = useMemo(() => {
    const items = Array.isArray(categoriesData?.items) ? categoriesData.items : [];
    const merged = [...createdCategoryOptions, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
      id: item.id,
      name: item.name || item.slug || item.id,
    }));
  }, [categoriesData?.items, createdCategoryOptions]);

  const brandAutocompleteOptions = useMemo(() => {
    const items = Array.isArray(brandsData?.items) ? brandsData.items : [];
    const merged = [...createdBrandOptions, ...items];
    const seen = new Set();
    return merged
      .filter((item) => {
        const key = String(item?.id || '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
      id: item.id,
      name: item.name || item.slug || item.id,
    }));
  }, [brandsData?.items, createdBrandOptions]);

  const selectedCategoryOption = useMemo(() => {
    if (!createForm.primaryCategoryId) return null;
    const fromSearch = categoryAutocompleteOptions.find((opt) => String(opt.id) === String(createForm.primaryCategoryId));
    if (fromSearch) return fromSearch;
    const allItems = Array.isArray(categoriesFilterData?.items) ? categoriesFilterData.items : [];
    const fallback = allItems.find((item) => String(item.id) === String(createForm.primaryCategoryId));
    return fallback ? { id: fallback.id, name: fallback.name || fallback.slug || fallback.id } : null;
  }, [categoriesFilterData?.items, categoryAutocompleteOptions, createForm.primaryCategoryId]);

  const selectedBrandOption = useMemo(() => {
    if (!createForm.brandId) return null;
    const fromSearch = brandAutocompleteOptions.find((opt) => String(opt.id) === String(createForm.brandId));
    if (fromSearch) return fromSearch;
    const allItems = Array.isArray(brandsFilterData?.items) ? brandsFilterData.items : [];
    const fallback = allItems.find((item) => String(item.id) === String(createForm.brandId));
    return fallback ? { id: fallback.id, name: fallback.name || fallback.slug || fallback.id } : null;
  }, [brandAutocompleteOptions, brandsFilterData?.items, createForm.brandId]);

  const shouldShowCreateCategory = useMemo(() => {
    const q = normalizeText(categorySearch);
    if (!q) return false;
    return !categoryAutocompleteOptions.some((opt) => normalizeText(opt.name) === q);
  }, [categoryAutocompleteOptions, categorySearch]);

  const shouldShowCreateBrand = useMemo(() => {
    const q = normalizeText(brandSearch);
    if (!q) return false;
    return !brandAutocompleteOptions.some((opt) => normalizeText(opt.name) === q);
  }, [brandAutocompleteOptions, brandSearch]);

  const createCategoryFromSearch = useCallback(async () => {
    const name = String(categorySearch || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    setCreateLookupError('');
    try {
      const created = await createCategoryLookup({ name }).unwrap();
      if (created?.id) {
        setCreatedCategoryOptions((prev) => {
          const key = String(created.id);
          const next = prev.filter((item) => String(item?.id || '') !== key);
          return [{ id: created.id, name: created.name || name, slug: created.slug }, ...next];
        });
      }
      setCreateForm((prev) => ({ ...prev, primaryCategoryId: created?.id || prev.primaryCategoryId }));
      setCategorySearch(created?.name || name);
    } catch (e) {
      setCreateLookupError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось создать категорию');
    }
  }, [categorySearch, createCategoryLookup]);

  const createBrandFromSearch = useCallback(async () => {
    const name = String(brandSearch || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    setCreateLookupError('');
    try {
      const created = await createBrandLookup({ name }).unwrap();
      if (created?.id) {
        setCreatedBrandOptions((prev) => {
          const key = String(created.id);
          const next = prev.filter((item) => String(item?.id || '') !== key);
          return [{ id: created.id, name: created.name || name, slug: created.slug }, ...next];
        });
      }
      setCreateForm((prev) => ({ ...prev, brandId: created?.id || prev.brandId }));
      setBrandSearch(created?.name || name);
    } catch (e) {
      setCreateLookupError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось создать производителя');
    }
  }, [brandSearch, createBrandLookup]);

  const openDetail = useCallback((id) => {
    const suffix = openAsModal ? '?modal=1' : '';
    navigate(`/main/products/${id}${suffix}`);
  }, [navigate, openAsModal]);

  const columns = useMemo(
    () => createProductListColumns({ onOpenDetail: openDetail }),
    [openDetail]
  );

    // onSubmitCreate: вспомогательная логика компонента.
const onSubmitCreate = async (event) => {
    event?.preventDefault();
    setCreateError('');

    const name = String(createForm.name || '').trim();
    if (!name) {
      setCreateError('Введите название продукта');
      return;
    }

    setCreating(true);
    try {
      const created = await createProduct({
        name,
        primaryCategoryId: createForm.primaryCategoryId || null,
        brandId: createForm.brandId || null,
        sku: createForm.sku || null,
      }).unwrap();

      setOpen(false);
      setCreateForm(defaultCreate);
      setCategorySearch('');
      setBrandSearch('');
      setCreateLookupError('');
      listRef.current?.refetch?.();
      if (created?.id) {
        openDetail(created.id);
      }
    } catch (e) {
      setCreateError(e?.data?.error || e?.data?.message || e?.message || 'Не удалось создать продукт');
    } finally {
      setCreating(false);
    }
  };

  const rowActions = useCallback((row) => (
    <div className={s.rowActions}>
      <button type="button" className={s.actionBtn} onClick={() => openDetail(row.id)}>
        Открыть
      </button>
    </div>
  ), [openDetail]);

  const workspaceColumns = useMemo(() => {
    const fixedColumns = columns.map((column) => ({
      ...column,
      fallbackLabel: column.title || column.managerLabel || column.key,
      category: column.managerGroup || column.category || 'core',
      defaultVisible: column.defaultVisible !== false,
      required: column.canHide === false || column.key === 'name',
      minWidth: Math.max(110, Math.min(Number(column.width) || 180, 180)),
      maxWidth: 560,
      numeric: column.align === 'right',
    }));
    return [
      ...fixedColumns,
      ...buildCustomFieldColumns(loadedProducts, fixedColumns),
      {
        key: 'actions',
        fallbackLabel: t('common.actions', 'Actions'),
        width: 150,
        minWidth: 130,
        maxWidth: 220,
        category: 'context',
        defaultVisible: true,
        required: true,
        render: rowActions,
      },
    ];
  }, [columns, loadedProducts, rowActions, t]);

  const renderCell = useCallback((row, column) => {
    if (typeof column.render === 'function') return column.render(row);
    const value = row?.[column.key];
    return normalizeValueForCell(value);
  }, []);

  const workspaceControls = useMemo(() => [
    {
      key: 'search',
      kind: 'search',
      label: t('common.search', 'Search'),
      control: (
        <SearchField
          value={query.search || ''}
          onValueChange={(value) => updateFilter('search', value)}
          placeholder="Поиск: название, SKU, EAN..."
          size="sm"
          clearable
          fullWidth={false}
        />
      ),
    },
    {
      key: 'categoryId',
      label: 'Категория',
      control: (
        <SelectField
          value={query.categoryId || ''}
          onValueChange={(value) => updateFilter('categoryId', value)}
          options={categoryOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'brandId',
      label: 'Производитель',
      control: (
        <SelectField
          value={query.brandId || ''}
          onValueChange={(value) => updateFilter('brandId', value)}
          options={brandOptions}
          size="sm"
          fullWidth={false}
        />
      ),
    },
    {
      key: 'isSellable',
      label: 'Продаётся',
      control: (
        <SelectField
          value={query.isSellable || ''}
          onValueChange={(value) => updateFilter('isSellable', value)}
          options={[
            { value: '', label: 'Любой' },
            { value: 'true', label: 'Да' },
            { value: 'false', label: 'Нет' },
          ]}
          size="sm"
          fullWidth={false}
        />
      ),
    },
  ], [
    brandOptions,
    categoryOptions,
    query.brandId,
    query.categoryId,
    query.isSellable,
    query.search,
    t,
    updateFilter,
  ]);

  const workspaceLabels = useMemo(() => ({
    loading: t('common.loading', 'Loading'),
    errorTitle: t('pim.products.errorTitle', 'Не удалось загрузить товары'),
    retry: t('list.refresh', 'Refresh'),
    resetColumns: t('list.columns.reset', 'Reset'),
    columnsMenu: t('list.columns.configureShort', 'Columns'),
    showAllColumns: t('list.columns.configure', 'Show all'),
    showTechnicalColumns: t('list.columns.groupSystem', 'System'),
    hideTechnicalColumns: t('list.columns.hideAdditional', 'Hide extra'),
    requiredColumn: t('list.columns.recommended', 'Recommended'),
    visibleColumns: (count) => t('list.columns.visibleCount', { count }),
    groupLabel: (group) => {
      if (group === 'context') return t('list.columns.groupAdditional', 'Additional');
      if (group === 'custom') return t('list.columns.groupCustom', 'Custom');
      if (group === 'system') return t('list.columns.groupSystem', 'System');
      if (group === 'technical') return t('list.columns.groupSystem', 'System');
      if (group === 'logistics') return t('list.columns.groupLogistics', 'Logistics');
      if (group === 'business') return t('list.columns.groupBusiness', 'Business');
      return t('list.columns.groupMain', 'Main');
    },
    columnLabel: (column) => column.fallbackLabel || column.title || column.key,
  }), [t]);

  return (
    <>
      <Workspace
        ref={listRef}
        title={t('menu.products', 'Товары')}
        badge={t('pim.products.workspaceCount', {
          count: workspaceData.total,
          defaultValue: `${workspaceData.total}`,
        })}
        actions={(
          <AddButton onClick={() => setOpen(true)}>
            Добавить товар
          </AddButton>
        )}
        controls={workspaceControls}
        rows={workspaceData.rows}
        columns={workspaceColumns}
        loading={workspaceData.loading}
        error={workspaceData.error}
        onRetry={workspaceData.refetch}
        onRefetch={workspaceData.refetch}
        renderCell={renderCell}
        getRowId={(row) => row?.id}
        getRowKey={(row) => String(row?.id || row?.name || '')}
        onRowClick={(row) => row?.id && openDetail(row.id)}
        sortKey={workspaceData.query.sort}
        sortDir={workspaceData.query.dir}
        onSort={workspaceData.setSort}
        columnState={columnState}
        onColumnStateChange={handleColumnStateChange}
        emptyState={{
          title: hasAnyFilter ? 'Товары не найдены' : 'Нет товаров',
          description: hasAnyFilter ? 'Измените поиск или фильтры.' : 'Создайте первый товар.',
        }}
        errorState={{
          title: t('pim.products.errorTitle', 'Не удалось загрузить товары'),
          description: String(
            productsError?.data?.message
            || productsError?.data?.error
            || productsError?.message
            || t('common.error', 'Error')
          ),
          retryLabel: t('list.refresh', 'Refresh'),
        }}
        labels={workspaceLabels}
        pagination={workspaceData.pagination}
      />

      <Modal
        open={open}
        onClose={() => {
          if (creating) return;
          setOpen(false);
          setCreateError('');
          setCreateLookupError('');
        }}
        title="Новый товар"
        size="md"
        footer={(
          <>
            <Modal.Button onClick={() => setOpen(false)}>Отмена</Modal.Button>
            <Modal.Button
              variant="primary"
              form="product-create-form"
              disabled={creating}
            >
              {creating ? 'Создание...' : 'Создать'}
            </Modal.Button>
          </>
        )}
      >
        <form id="product-create-form" className={s.form} onSubmit={onSubmitCreate}>
          <label className={s.field}>
            <span className={s.label}>Название*</span>
            <TextField
              inputClassName={s.input}
              value={createForm.name}
              onValueChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
              placeholder="Например: iPhone 15 Pro Max"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Категория</span>
            <AutocompleteField
              value={selectedCategoryOption}
              inputValue={categorySearch}
              onInputChange={(next) => {
                setCategorySearch(next);
                if (selectedCategoryOption && normalizeText(next) !== normalizeText(selectedCategoryOption.name)) {
                  setCreateForm((prev) => ({ ...prev, primaryCategoryId: '' }));
                }
              }}
              options={categoryAutocompleteOptions}
              onSelect={(opt) => {
                if (!opt) return;
                setCreateForm((prev) => ({ ...prev, primaryCategoryId: String(opt.id) }));
                setCategorySearch(opt.name || '');
              }}
              placeholder="Начните вводить категорию"
              hint="Начните вводить название"
              emptyLabel="Ничего не найдено"
              searchingLabel="Поиск..."
              loading={searchingCategories}
              opaque
              showCreateAction={shouldShowCreateCategory}
              createActionLabel={`Создать категорию «${String(categorySearch || '').trim()}»`}
              createActionLoading={creatingCategory}
              onCreateAction={createCategoryFromSearch}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Производитель</span>
            <AutocompleteField
              value={selectedBrandOption}
              inputValue={brandSearch}
              onInputChange={(next) => {
                setBrandSearch(next);
                if (selectedBrandOption && normalizeText(next) !== normalizeText(selectedBrandOption.name)) {
                  setCreateForm((prev) => ({ ...prev, brandId: '' }));
                }
              }}
              options={brandAutocompleteOptions}
              onSelect={(opt) => {
                if (!opt) return;
                setCreateForm((prev) => ({ ...prev, brandId: String(opt.id) }));
                setBrandSearch(opt.name || '');
              }}
              placeholder="Начните вводить производителя"
              hint="Начните вводить название"
              emptyLabel="Ничего не найдено"
              searchingLabel="Поиск..."
              loading={searchingBrands}
              opaque
              showCreateAction={shouldShowCreateBrand}
              createActionLabel={`Создать производителя «${String(brandSearch || '').trim()}»`}
              createActionLoading={creatingBrand}
              onCreateAction={createBrandFromSearch}
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>SKU</span>
            <TextField
              inputClassName={s.input}
              value={createForm.sku}
              onValueChange={(value) => setCreateForm((prev) => ({ ...prev, sku: value }))}
              placeholder="Артикул"
            />
          </label>

          {createError ? <div className={s.error}>{createError}</div> : null}
          {createLookupError ? <div className={s.error}>{createLookupError}</div> : null}
        </form>
      </Modal>
    </>
  );
}
