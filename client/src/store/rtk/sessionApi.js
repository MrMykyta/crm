import { crmApi, setApiSession } from './crmApi';
import { setAuth, logout } from '../slices/authSlice';
import { bootstrapLoad } from '../slices/bootstrapSlice';

/** ====== simple storage helpers (без внешних зависимостей) ====== */
const LS_RT = 'rt';
const LS_CID = 'cid';

const saveRT = (rt) => { try { rt ? localStorage.setItem(LS_RT, rt) : localStorage.removeItem(LS_RT); } catch {} };
const loadRT = () => { try { return localStorage.getItem(LS_RT) || null; } catch { return null; } };

const saveCID = (cid) => { try { cid ? localStorage.setItem(LS_CID, String(cid)) : localStorage.removeItem(LS_CID); } catch {} };
const loadCID = () => { try { return localStorage.getItem(LS_CID) || null; } catch { return null; } };

export const sessionApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    /** ====== LOGIN ====== */
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data = {} } = await queryFulfilled;

          const accessToken  = data.accessToken ?? data.token ?? data.tokens?.accessToken ?? null;
          const refreshToken = data.refreshToken ?? data.tokens?.refreshToken ?? null;
          const companyId    = data.activeCompanyId ?? data.companyId ?? null;
          const user         = data.user ?? null;

          if (accessToken) {
            // persist для рефреша после перезагрузки
            saveRT(refreshToken);
            saveCID(companyId);

            dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
            setApiSession({ token: accessToken, companyId });
            dispatch(bootstrapLoad());
          }
        } catch (err) {
          console.error('[sessionApi.login] failed', err);
        }
      },
    }),

    /** ====== REFRESH (требует body: { refreshToken, companyId }) ====== 
     *  arg: { refreshToken?: string, companyId?: string|number, silent?: boolean }
     */
    refresh: build.mutation({
      query: ({ refreshToken, companyId }) => ({
        url: '/auth/refresh',
        method: 'POST',
        body: { refreshToken, companyId },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const silent = !!arg?.silent;
        try {
          const { data = {} } = await queryFulfilled;

          const accessToken  = data.accessToken ?? data.token ?? data.tokens?.accessToken ?? null;
          const refreshToken = data.refreshToken ?? data.tokens?.refreshToken ?? null;
          const companyId    = data.activeCompanyId ?? data.companyId ?? arg?.companyId ?? loadCID();
          const user         = data.user ?? null;

          if (!accessToken) {
            if (!silent) {
              dispatch(logout());
              setApiSession({ token: null, companyId: null });
              saveRT(null); saveCID(null);
            }
            return;
          }

          // обновим персист
          saveRT(refreshToken);
          saveCID(companyId);

          dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
          setApiSession({ token: accessToken, companyId });
          dispatch(bootstrapLoad());
        } catch (err) {
          if (!silent) {
            dispatch(logout());
            setApiSession({ token: null, companyId: null });
            saveRT(null); saveCID(null);
          }
        }
      },
    }),

    /** ====== LOGOUT ====== */
    logout: build.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch }) {
        dispatch(logout());
        setApiSession({ token: null, companyId: null });
        saveRT(null); saveCID(null);
      },
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation, useLogoutMutation } = sessionApi;

// экспорт вспомогалок, если пригодится снаружи (например в App.js)
export const sessionStorageHelpers = { loadRT, loadCID, saveRT, saveCID };