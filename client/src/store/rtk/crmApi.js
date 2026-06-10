// src/store/rtk/crmApi.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setAuth, logout } from '../slices/authSlice';
import { apiBase } from '../../config/api';

/** ==============================================================
 *  SESSION CONTEXT — один источник правды (в памяти)
 *  ============================================================== */
const sessionCtx = { token: null, companyId: null };

export // setApiSession : set api session.
// setApiSession: изменяет значение состояния для слоя RTK Query.
const setApiSession = ({ token, companyId } = {}) => {
  if (typeof token !== 'undefined') sessionCtx.token = token || null;
  if (typeof companyId !== 'undefined') sessionCtx.companyId = companyId || null;

  try {
    if (typeof window !== 'undefined') {
      window.__AUTH_TOKEN__ = sessionCtx.token || null;
      window.__COMPANY_ID__ = sessionCtx.companyId || null;
    }
  } catch {}
};

export // getToken : get token.
// getToken: возвращает данные для слоя RTK Query.
const getToken = () => sessionCtx.token || null;
export // getCompanyId : get company id.
// getCompanyId: возвращает данные для слоя RTK Query.
const getCompanyId = () => sessionCtx.companyId || null;

/** ==============================================================
 *  LOCALSTORAGE HELPERS (прямо здесь, чтобы не было циклов)
 *  ============================================================== */

const LS_RT = 'rt';
const LS_CID = 'cid';

// saveRT: сохраняет данные для RTK Query.
const saveRT = (rt) => {
  try {
    rt ? localStorage.setItem(LS_RT, rt) : localStorage.removeItem(LS_RT);
  } catch {}
};
// loadRT: загружает данные для RTK Query.
const loadRT = () => {
  try {
    return localStorage.getItem(LS_RT) || null;
  } catch {
    return null;
  }
};

// saveCID: сохраняет данные для RTK Query.
const saveCID = (cid) => {
  try {
    cid
      ? localStorage.setItem(LS_CID, String(cid))
      : localStorage.removeItem(LS_CID);
  } catch {}
};
// loadCID: загружает данные для RTK Query.
const loadCID = () => {
  try {
    return localStorage.getItem(LS_CID) || null;
  } catch {
    return null;
  }
};

/** ==============================================================
 *  BASE QUERY (fetch)
 *  ============================================================== */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiBase,
  credentials: 'include',
    // prepareHeaders: вспомогательная логика для слоя RTK Query.
prepareHeaders: (headers) => {
    const token = getToken();
    const companyId = getCompanyId();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (companyId) headers.set('X-Company-Id', companyId);
    return headers;
  },
});

/** ==============================================================
 *  REAUTH WRAPPER с «мьютексом»
 *  ============================================================== */

let refreshingPromise = null;

// ensureRefreshed: вспомогательная логика для слоя RTK Query.
const ensureRefreshed = async (api, extraOptions) => {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const state = api.getState();

      const reduxRT = state?.auth?.refreshToken ?? null;
      const reduxCID = state?.auth?.companyId ?? null;

      const refreshToken = reduxRT || loadRT();
      const companyId = reduxCID || loadCID() || getCompanyId();

      if (!refreshToken) {
        api.dispatch(logout());
        setApiSession({ token: null, companyId: null });
        saveRT(null);
        saveCID(null);
        throw new Error('NO_REFRESH_TOKEN');
      }

      const refreshResp = await rawBaseQuery(
        {
          url: '/auth/refresh',
          method: 'POST',
          body: { refreshToken, companyId },
        },
        api,
        extraOptions
      );

      if (refreshResp.error) {
        api.dispatch(logout());
        setApiSession({ token: null, companyId: null });
        saveRT(null);
        saveCID(null);
        throw new Error('REFRESH_FAILED');
      }

      const data = refreshResp.data || {};

      const nextAccess =
        data.accessToken ??
        data.token ??
        data.tokens?.accessToken ??
        null;
      const nextRefresh =
        data.refreshToken ?? data.tokens?.refreshToken ?? refreshToken;
      const nextCompany =
        data.activeCompanyId ?? data.companyId ?? companyId;
      const user = data.user ?? state?.auth?.user ?? null;

      if (!nextAccess) {
        api.dispatch(logout());
        setApiSession({ token: null, companyId: null });
        saveRT(null);
        saveCID(null);
        throw new Error('REFRESH_NO_ACCESS');
      }

      saveRT(nextRefresh);
      saveCID(nextCompany);

      api.dispatch(
        setAuth({
          accessToken: nextAccess,
          refreshToken: nextRefresh,
          companyId: nextCompany,
          user,
        })
      );
      setApiSession({ token: nextAccess, companyId: nextCompany });

      return true;
    } finally {
      setTimeout(() => {
        refreshingPromise = null;
      }, 0);
    }
  })();

  return refreshingPromise;
};

const SHOULD_REFRESH = new Set([401, 408, 419, 440]);

// baseQueryWithReauth: вспомогательная логика для слоя RTK Query.
const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result?.error && SHOULD_REFRESH.has(result.error.status)) {
    try {
      await ensureRefreshed(api, extraOptions);
      result = await rawBaseQuery(args, api, extraOptions);
    } catch {
      return {
        error: { status: 401, data: { message: 'Unauthenticated' } },
      };
    }
  }

  return result;
};

/** ==============================================================
 *  API
 *  ============================================================== */
export const crmApi = createApi({
  reducerPath: 'crmApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User',
    'Preferences',
    'Company',
    'CompanyUser',
    'Notification',
    'ACL',
    'Task',
    'TaskList',
    'Counterparty',
    'Deal',
    'DealList',
    'Contact',
    'ContactList',
    'Note',
    'NoteList',
    'Product',
    'ProductList',
    'ProductPicker',
    'ProductVariant',
    'ProductSupplier',
    'VariantOption',
    'ProductPrice',
    'ProductSpec',
    'BrandLookup',
    'CategoryLookup',
    'Offer',
    'OfferList',
    'Order',
    'OrderList',
    'Invoice',
    'InvoiceList',
    'Document',
    'DocumentList',
    'DocumentNumberingSettings',
    'CompanyOrderSettings',
    'CompanyInvoiceSettings',
    'CompanyOfferSettings',
    'CompanyWarehouseDocumentSettings',
    'DocumentTemplate',
    'TemplateDraft',
    'WmsAdjustment',
    'WmsAdjustmentList',
    'WmsCycleCount',
    'WmsCycleCountList',
    'WmsReceipt',
    'WmsReceiptList',
    'WmsShipment',
    'WmsShipmentList',
    'WmsWarehouse',
    'WmsWarehouseList',
    'WmsLocation',
    'WmsLocationList',
    'WmsStockMove',
    'WmsStockMoveList',
    'WmsReservation',
    'WmsReservationList',
    'WmsLot',
    'WmsLotList',
    'WmsSerial',
    'WmsSerialList',
    'WmsParcel',
    'WmsParcelList',
    'WmsDocumentsUnified',
    'WmsCostingOpeningBalance',
    'WmsStockValuation',
    'WmsStockTurnover',
    'WmsStockAsOf',
    'WmsInventoryLedger',
    'WorkspaceViews',
  ],
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: () => ({}),
});

export default crmApi;
