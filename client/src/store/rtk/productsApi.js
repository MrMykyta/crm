import { crmApi } from './crmApi';

// stripCompanyId: вспомогательная логика для слоя RTK Query.
const stripCompanyId = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    value.delete('companyId');
    return value;
  }
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

// buildParams: собирает итоговую структуру данных для слоя RTK Query.
const buildParams = (args = {}) => {
  const src = stripCompanyId(args) || {};
  const params = {};
  Object.entries(src).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = value;
  });
  return params;
};

// normalizeList: нормализует входные/выходные данные для слоя RTK Query.
const normalizeList = (resp) => {
  const items = Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.items)
      ? resp.items
      : Array.isArray(resp)
        ? resp
        : [];

  const meta = resp?.meta || {};
  const total = Number(meta.count ?? resp?.total ?? items.length) || 0;
  const page = Number(meta.page ?? resp?.page ?? 1) || 1;
  const limit = Number(meta.limit ?? resp?.limit ?? 25) || 25;
  const totalPages = Number(meta.totalPages ?? (Math.ceil(total / Math.max(limit, 1)) || 1));

  return { items, total, page, limit, totalPages };
};

// mapLookupList: преобразует данные в нужный формат для слоя RTK Query.
const mapLookupList = (resp) => {
  const items = Array.isArray(resp?.data)
    ? resp.data
    : Array.isArray(resp?.items)
      ? resp.items
      : Array.isArray(resp)
        ? resp
        : [];
  return { items };
};

export const productsApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({
    listProducts: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/products',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: normalizeList,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'ProductList', id: 'LIST' },
        ...(res?.items || []).map((item) => ({ type: 'Product', id: item.id })),
      ],
      keepUnusedDataFor: 60,
    }),

    getProduct: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/products/${encodeURIComponent(id)}`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'Product', id }],
    }),

    createProduct: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/products',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'ProductList', id: 'LIST' }],
    }),

    updateProduct: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/products/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // onQueryStarted: запускает побочные эффекты жизненного цикла запроса.
async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data) return;
          dispatch(productsApi.util.upsertQueryData('getProduct', id, data));
        } catch {}
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'Product', id },
        { type: 'ProductList', id: 'LIST' },
      ],
    }),

    updateProductDescription: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, description }) => ({
        url: `/products/${encodeURIComponent(id)}/description`,
        method: 'PATCH',
        body: { description },
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // onQueryStarted: запускает побочные эффекты жизненного цикла запроса.
async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data) return;
          dispatch(productsApi.util.upsertQueryData('getProduct', id, data));
        } catch {}
      },
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'Product', id },
        { type: 'ProductList', id: 'LIST' },
      ],
    }),

    getProductPrices: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/products/${encodeURIComponent(id)}/prices`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? { purchase: [], sale: [] },
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'ProductPrice', id }],
    }),

    createProductPrice: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, payload }) => ({
        url: `/products/${encodeURIComponent(productId)}/prices`,
        method: 'POST',
        body: payload,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductPrice', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    updateProductPrice: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, priceId, payload }) => ({
        url: `/products/${encodeURIComponent(productId)}/prices/${encodeURIComponent(priceId)}`,
        method: 'PUT',
        body: payload,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductPrice', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    deleteProductPrice: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, priceId }) => ({
        url: `/products/${encodeURIComponent(productId)}/prices/${encodeURIComponent(priceId)}`,
        method: 'DELETE',
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductPrice', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    getProductSpecifications: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/products/${encodeURIComponent(id)}/specifications`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => {
        const items = Array.isArray(resp?.data) ? resp.data : [];
        return { items };
      },
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'ProductSpec', id }],
    }),

    createProductSpecification: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, payload }) => ({
        url: `/products/${encodeURIComponent(productId)}/specifications`,
        method: 'POST',
        body: payload,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductSpec', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    updateProductSpecification: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, specificationId, payload }) => ({
        url: `/products/${encodeURIComponent(productId)}/specifications/${encodeURIComponent(specificationId)}`,
        method: 'PUT',
        body: payload,
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductSpec', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    deleteProductSpecification: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ productId, specificationId }) => ({
        url: `/products/${encodeURIComponent(productId)}/specifications/${encodeURIComponent(specificationId)}`,
        method: 'DELETE',
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { productId }) => [
        { type: 'ProductSpec', id: productId },
        { type: 'Product', id: productId },
      ],
    }),

    getProductMovements: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, ...params } = {}) => ({
        url: `/products/${encodeURIComponent(id)}/movements`,
        method: 'GET',
        params: buildParams(params),
      }),
      transformResponse: normalizeList,
      keepUnusedDataFor: 30,
    }),

    listBrandsLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/brands',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'BrandLookup', id: 'LIST' },
        ...((res?.items || []).map((item) => ({ type: 'BrandLookup', id: item.id }))),
      ],
      keepUnusedDataFor: 300,
    }),

    createBrandLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/brands',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'BrandLookup', id: 'LIST' }],
    }),

    deleteBrandLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload } = {}) => ({
        url: `/brands/${encodeURIComponent(id)}`,
        method: 'DELETE',
        body: stripCompanyId(payload || {}),
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, arg) => [
        { type: 'BrandLookup', id: 'LIST' },
        { type: 'BrandLookup', id: arg?.id },
      ],
    }),

    updateBrandLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/brands/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'BrandLookup', id: 'LIST' },
        { type: 'BrandLookup', id },
      ],
    }),

    getBrandUsage: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/brands/${encodeURIComponent(id)}/usage`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'BrandLookup', id }],
    }),

    mergeBrandLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, targetId }) => ({
        url: `/brands/${encodeURIComponent(id)}/merge`,
        method: 'POST',
        body: { targetId },
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id, targetId }) => [
        { type: 'BrandLookup', id: 'LIST' },
        { type: 'BrandLookup', id },
        { type: 'BrandLookup', id: targetId },
        { type: 'ProductList', id: 'LIST' },
      ],
    }),

    listCategoriesLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/categories',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (res) => [
        { type: 'CategoryLookup', id: 'LIST' },
        ...((res?.items || []).map((item) => ({ type: 'CategoryLookup', id: item.id }))),
      ],
      keepUnusedDataFor: 300,
    }),

    createCategoryLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => ({
        url: '/categories',
        method: 'POST',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
      invalidatesTags: [{ type: 'CategoryLookup', id: 'LIST' }],
    }),

    deleteCategoryLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload } = {}) => ({
        url: `/categories/${encodeURIComponent(id)}`,
        method: 'DELETE',
        body: stripCompanyId(payload || {}),
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, arg) => [
        { type: 'CategoryLookup', id: 'LIST' },
        { type: 'CategoryLookup', id: arg?.id },
      ],
    }),

    updateCategoryLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, payload }) => ({
        url: `/categories/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: stripCompanyId(payload),
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id }) => [
        { type: 'CategoryLookup', id: 'LIST' },
        { type: 'CategoryLookup', id },
      ],
    }),

    getCategoryUsage: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (id) => ({
        url: `/categories/${encodeURIComponent(id)}/usage`,
        method: 'GET',
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_res, _err, id) => [{ type: 'CategoryLookup', id }],
    }),

    mergeCategoryLookup: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ id, targetId }) => ({
        url: `/categories/${encodeURIComponent(id)}/merge`,
        method: 'POST',
        body: { targetId },
      }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => resp?.data ?? resp,
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_res, _err, { id, targetId }) => [
        { type: 'CategoryLookup', id: 'LIST' },
        { type: 'CategoryLookup', id },
        { type: 'CategoryLookup', id: targetId },
        { type: 'ProductList', id: 'LIST' },
      ],
    }),

    listUomsLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/uoms',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
      keepUnusedDataFor: 300,
    }),

    listProductTypesLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/product-types',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
      keepUnusedDataFor: 300,
    }),

    listTaxCategoriesLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/tax-categories',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
      keepUnusedDataFor: 300,
    }),

    listShippingClassesLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/shipping-classes',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
      keepUnusedDataFor: 300,
    }),

    listPriceListsLookup: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (args = {}) => ({
        url: '/price-lists',
        method: 'GET',
        params: buildParams(args),
      }),
      transformResponse: mapLookupList,
      keepUnusedDataFor: 300,
    }),
  }),
  overrideExisting: true,
});

export const {
  useListProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useUpdateProductDescriptionMutation,
  useGetProductPricesQuery,
  useCreateProductPriceMutation,
  useUpdateProductPriceMutation,
  useDeleteProductPriceMutation,
  useGetProductSpecificationsQuery,
  useCreateProductSpecificationMutation,
  useUpdateProductSpecificationMutation,
  useDeleteProductSpecificationMutation,
  useGetProductMovementsQuery,
  useListBrandsLookupQuery,
  useCreateBrandLookupMutation,
  useDeleteBrandLookupMutation,
  useUpdateBrandLookupMutation,
  useGetBrandUsageQuery,
  useMergeBrandLookupMutation,
  useListCategoriesLookupQuery,
  useCreateCategoryLookupMutation,
  useDeleteCategoryLookupMutation,
  useUpdateCategoryLookupMutation,
  useGetCategoryUsageQuery,
  useMergeCategoryLookupMutation,
  useListUomsLookupQuery,
  useListProductTypesLookupQuery,
  useListTaxCategoriesLookupQuery,
  useListShippingClassesLookupQuery,
  useListPriceListsLookupQuery,
} = productsApi;

