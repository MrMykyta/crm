import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setAuth, logout } from '../slices/authSlice';

/** ==============================================================
 *  SESSION CONTEXT — один источник правды (в памяти)
 *  ============================================================== */
const sessionCtx = { token: null, companyId: null };

export const setApiSession = ({ token, companyId } = {}) => {
  if (typeof token !== 'undefined') sessionCtx.token = token || null;
  if (typeof companyId !== 'undefined') sessionCtx.companyId = companyId || null;

  try {
    if (typeof window !== 'undefined') {
      window.__AUTH_TOKEN__ = sessionCtx.token || null;
      window.__COMPANY_ID__ = sessionCtx.companyId || null;
    }
  } catch {}
};

export const getToken = () => sessionCtx.token || null;
export const getCompanyId = () => sessionCtx.companyId || null;

/** ==============================================================
 *  BASE QUERY (fetch)
 *  ============================================================== */
const baseUrl =
  (process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001') + '/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: 'include', // важен для refresh по cookie
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
 *  - при 401/408/419/440 → один общий refresh для всех запросов
 *  - если refresh ок → повторяем исходный запрос
 *  - если нет → чистый logout
 *  ============================================================== */

// общий промис «идет рефреш»
let refreshingPromise = null;

// функция запуска/ожидания рефреша
const ensureRefreshed = async (api, extraOptions) => {
  // если уже идёт refresh — просто дождёмся его завершения
  if (refreshingPromise) return refreshingPromise;

  // запускаем новый refresh (cookie-based)
  refreshingPromise = (async () => {
    try {
      const refreshResp = await rawBaseQuery(
        { url: '/auth/refresh', method: 'POST' },
        api,
        extraOptions
      );

      const data = refreshResp?.data;
      const nextToken =
        data?.accessToken || data?.tokens?.accessToken || data?.token || null;

      if (!nextToken) {
        // не удалось обновиться
        setApiSession({ token: null, companyId: null });
        api.dispatch(logout());
        throw new Error('REFRESH_FAILED');
      }

      const nextCompany = data?.activeCompanyId ?? data?.companyId ?? getCompanyId();
      const user        = data?.user ?? null;

      // обновляем контексты
      setApiSession({ token: nextToken, companyId: nextCompany });
      api.dispatch(setAuth({ accessToken: nextToken, companyId: nextCompany, user }));

      return true;
    } finally {
      // сбрасываем «мьютекс» после завершения любого исхода
      setTimeout(() => { refreshingPromise = null; }, 0);
    }
  })();

  return refreshingPromise;
};

// статусы, при которых пробуем refresh
const SHOULD_REFRESH = new Set([401, 408, 419, 440]);

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  // требуем рефреш?
  if (result?.error && SHOULD_REFRESH.has(result.error.status)) {
    try {
      // 1) гарантируем один refresh для всех
      await ensureRefreshed(api, extraOptions);

      // 2) повторяем исходный запрос уже с новым токеном
      result = await rawBaseQuery(args, api, extraOptions);
    } catch (e) {
      // refresh провалился → logout уже сделан в ensureRefreshed
      // возвращаем ту же ошибку, но без дополнительного «шума»
      return { error: { status: 401, data: { message: 'Unauthenticated' } } };
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
    'ACL',
    'Task',
    'TaskList',
    'Counterparty',
  ],
  endpoints: () => ({}),
});

export default crmApi;