import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import Modal from '../../../../components/Modal';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useOpenAsModal from '../../../../hooks/useOpenAsModal';
import { createProductListColumns } from '../../../../components/data/ListPage/columnSchemas/productsColumns';
import {
  useCreateBrandLookupMutation,
  useCreateCategoryLookupMutation,
  useCreateProductMutation,
  useListBrandsLookupQuery,
  useListCategoriesLookupQuery,
} from '../../../../store/rtk/productsApi';
import AutocompleteSelect from '../../../../components/shared/AutocompleteSelect';
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
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('pim.products');

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

  return (
    <>
      <ListPage
        ref={listRef}
        source="products"
        title={t('menu.products', 'Товары')}
        columns={columns}
        rowActions={rowActions}
        defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
        actions={(
          <AddButton onClick={() => setOpen(true)}>
            Добавить товар
          </AddButton>
        )}
        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
        columnVisibility={colVisibility}
        onColumnVisibilityChange={onColumnVisibilityChange}
        savedViews={savedViews}
        activeViewId={activeViewId}
        onSavedViewsChange={onSavedViewsChange}
        onActiveViewChange={onActiveViewChange}
        onResetColumns={resetGridPrefs}
        dynamicColumnsMode="custom-only"
        ToolbarComponent={(props) => (
          <FilterToolbar
            {...props}
            controls={[
              {
                type: 'search',
                key: 'search',
                placeholder: 'Поиск: название, SKU, EAN...',
                debounce: 350,
              },
              {
                type: 'select',
                key: 'categoryId',
                label: 'Категория',
                options: categoryOptions,
              },
              {
                type: 'select',
                key: 'brandId',
                label: 'Производитель',
                options: brandOptions,
              },
              {
                type: 'select',
                key: 'isSellable',
                label: 'Продаётся',
                options: [
                  { value: '', label: 'Любой' },
                  { value: 'true', label: 'Да' },
                  { value: 'false', label: 'Нет' },
                ],
              },
            ]}
          />
        )}
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
            <input
              className={s.input}
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Например: iPhone 15 Pro Max"
            />
          </label>

          <label className={s.field}>
            <span className={s.label}>Категория</span>
            <AutocompleteSelect
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
            <AutocompleteSelect
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
            <input
              className={s.input}
              value={createForm.sku}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, sku: e.target.value }))}
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

