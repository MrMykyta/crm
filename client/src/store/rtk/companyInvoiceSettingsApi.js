import { crmApi } from "./crmApi";

const DEFAULT_SETTINGS = {
  invoiceDefaultType: "invoice",
  invoiceDefaultPaymentMethod: "bank_transfer",
  invoiceDefaultPaymentTermDays: 30,
  invoiceDefaultCurrency: "PLN",
  invoiceStockUpdateMode: "disabled",
  invoiceAnnotationMode: "empty",
  invoiceAnnotationTemplateHtml: null,
  invoiceTypes: [],
};

const normalizeTypeRow = (row = {}) => {
  const nextSequence = Number(row?.nextSequence || 1);
  const rawLastSequence = Number(row?.lastSequence);
  const lastSequence = Number.isInteger(rawLastSequence) && rawLastSequence >= 0
    ? rawLastSequence
    : Math.max(nextSequence - 1, 0);
  const lastNumberRaw = String(row?.lastNumber ?? "").trim();

  return {
    typeKey: String(row?.typeKey || ""),
    label: String(row?.label || ""),
    enabled: Boolean(row?.enabled),
    numberingType: String(row?.numberingType || ""),
    numberPattern: String(row?.numberPattern || ""),
    lastSequence,
    lastNumber: lastSequence > 0 ? lastNumberRaw || "0" : "0",
    nextSequence,
    nextNumber: row?.nextNumber == null ? null : String(row?.nextNumber),
  };
};

const normalizeResponse = (response = {}) => ({
  ...DEFAULT_SETTINGS,
  ...(response || {}),
  invoiceDefaultPaymentTermDays: Number(response?.invoiceDefaultPaymentTermDays || 30),
  invoiceAnnotationTemplateHtml:
    response?.invoiceAnnotationTemplateHtml === null || response?.invoiceAnnotationTemplateHtml === undefined
      ? null
      : String(response.invoiceAnnotationTemplateHtml),
  invoiceTypes: Array.isArray(response?.invoiceTypes)
    ? response.invoiceTypes.map(normalizeTypeRow)
    : [],
});

export const companyInvoiceSettingsApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    getCompanyInvoiceSettings: build.query({
      query: () => ({
        url: "/company-settings/invoices",
        method: "GET",
      }),
      transformResponse: normalizeResponse,
      providesTags: [{ type: "CompanyInvoiceSettings", id: "CURRENT" }],
    }),

    updateCompanyInvoiceSettings: build.mutation({
      query: (payload = {}) => ({
        url: "/company-settings/invoices",
        method: "PUT",
        body: payload,
      }),
      transformResponse: normalizeResponse,
      invalidatesTags: [{ type: "CompanyInvoiceSettings", id: "CURRENT" }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetCompanyInvoiceSettingsQuery,
  useUpdateCompanyInvoiceSettingsMutation,
} = companyInvoiceSettingsApi;
