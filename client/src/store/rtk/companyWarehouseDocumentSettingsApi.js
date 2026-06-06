import { crmApi } from "./crmApi";

const TYPE_ORDER = ["pz", "wz", "mm", "rw", "pw"];

const FALLBACK_TYPES = [
  {
    typeKey: "pz",
    label: "PZ",
    enabled: true,
    numberingType: "PZ",
    numberPattern: "PZ/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "PZ/2026/04/0001",
  },
  {
    typeKey: "wz",
    label: "WZ",
    enabled: true,
    numberingType: "WZ",
    numberPattern: "WZ/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "WZ/2026/04/0001",
  },
  {
    typeKey: "mm",
    label: "MM",
    enabled: true,
    numberingType: "MM",
    numberPattern: "MM/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "MM/2026/04/0001",
  },
  {
    typeKey: "rw",
    label: "RW",
    enabled: true,
    numberingType: "RW",
    numberPattern: "RW/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "RW/2026/04/0001",
  },
  {
    typeKey: "pw",
    label: "PW",
    enabled: true,
    numberingType: "PW",
    numberPattern: "PW/$Y/$M/$NY(4)",
    lastSequence: 0,
    lastNumber: "0",
    nextSequence: 1,
    nextNumber: "PW/2026/04/0001",
  },
];

const DEFAULT_SETTINGS = {
  warehouseDefaultDocumentType: "wz",
  warehouseDocumentTypes: FALLBACK_TYPES,
};

const sortTypes = (items = []) => {
  const order = TYPE_ORDER.reduce((acc, key, index) => {
    acc[key] = index;
    return acc;
  }, {});

  return [...items].sort((left, right) => {
    const li = Number.isInteger(order[left.typeKey]) ? order[left.typeKey] : 999;
    const ri = Number.isInteger(order[right.typeKey]) ? order[right.typeKey] : 999;
    return li - ri;
  });
};

const normalizeTypeRow = (row = {}, fallback = {}) => {
  const nextSequence = Number(row?.nextSequence || 1);
  const rawLastSequence = Number(row?.lastSequence);
  const lastSequence =
    Number.isInteger(rawLastSequence) && rawLastSequence >= 0
      ? rawLastSequence
      : Math.max(nextSequence - 1, 0);
  const lastNumberRaw = String(row?.lastNumber ?? "").trim();

  return {
    typeKey: String(row?.typeKey || fallback.typeKey || ""),
    label: String(row?.label || fallback.label || ""),
    enabled: row?.enabled === undefined ? Boolean(fallback.enabled) : Boolean(row.enabled),
    numberingType: String(row?.numberingType || fallback.numberingType || ""),
    numberPattern: String(row?.numberPattern || fallback.numberPattern || ""),
    lastSequence,
    lastNumber: lastSequence > 0 ? lastNumberRaw || "0" : "0",
    nextSequence,
    nextNumber: row?.nextNumber == null ? null : String(row.nextNumber),
  };
};

const normalizeResponse = (response = {}) => {
  const fromApi = new Map(
    (Array.isArray(response?.warehouseDocumentTypes) ? response.warehouseDocumentTypes : []).map((item) => [
      String(item?.typeKey || ""),
      item,
    ])
  );

  const warehouseDocumentTypes = sortTypes(
    FALLBACK_TYPES.map((fallback) => normalizeTypeRow(fromApi.get(fallback.typeKey) || {}, fallback))
  );

  const enabledRows = warehouseDocumentTypes.filter((row) => row.enabled);
  const fallbackDefault = enabledRows[0]?.typeKey || "wz";
  const providedDefault = String(response?.warehouseDefaultDocumentType || fallbackDefault).toLowerCase();
  const warehouseDefaultDocumentType = enabledRows.some((row) => row.typeKey === providedDefault)
    ? providedDefault
    : fallbackDefault;

  return {
    ...DEFAULT_SETTINGS,
    defaultWarehouseId: response?.defaultWarehouseId || null,
    warehouseDefaultDocumentType,
    warehouseDocumentTypes,
  };
};

export const companyWarehouseDocumentSettingsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getCompanyWarehouseDocumentSettings: build.query({
      query: () => ({
        url: "/company-settings/warehouse-documents",
        method: "GET",
      }),
      transformResponse: normalizeResponse,
      providesTags: [{ type: "CompanyWarehouseDocumentSettings", id: "CURRENT" }],
    }),

    updateCompanyWarehouseDocumentSettings: build.mutation({
      query: (payload = {}) => ({
        url: "/company-settings/warehouse-documents",
        method: "PUT",
        body: payload,
      }),
      transformResponse: normalizeResponse,
      invalidatesTags: [{ type: "CompanyWarehouseDocumentSettings", id: "CURRENT" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetCompanyWarehouseDocumentSettingsQuery,
  useUpdateCompanyWarehouseDocumentSettingsMutation,
} = companyWarehouseDocumentSettingsApi;
