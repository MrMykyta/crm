// src/store/rtk/sessionApi.js
import { crmApi, setApiSession } from './crmApi';
import { setAuth, logout } from '../slices/authSlice';
import { bootstrapLoad, setChecked } from '../slices/bootstrapSlice';
import { initSocket, destroySocket } from '../../sockets/io';
import { resetApp } from '..'; // <-- импортируем из store/index.js

/** ====== simple storage helpers ====== */
const LS_RT = 'rt';
const LS_CID = 'cid';

const saveRT = (rt) => {
  try {
    rt ? localStorage.setItem(LS_RT, rt) : localStorage.removeItem(LS_RT);
  } catch {}
};
const loadRT = () => {
  try {
    return localStorage.getItem(LS_RT) || null;
  } catch {
    return null;
  }
};

const saveCID = (cid) => {
  try {
    cid
      ? localStorage.setItem(LS_CID, String(cid))
      : localStorage.removeItem(LS_CID);
  } catch {}
};
const loadCID = () => {
  try {
    return localStorage.getItem(LS_CID) || null;
  } catch {
    return null;
  }
};

export const sessionApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    /** ====== LOGIN ====== */
    login: build.mutation({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data = {} } = await queryFulfilled;

          const accessToken =
            data.accessToken ?? data.token ?? data.tokens?.accessToken ?? null;
          const refreshToken =
            data.refreshToken ?? data.tokens?.refreshToken ?? null;
          const companyId = data.activeCompanyId ?? data.companyId ?? null;
          const user = data.user ?? null;

          if (accessToken) {
            saveRT(refreshToken);
            saveCID(companyId);

            // новый сокет под нового юзера
            destroySocket();
            initSocket(accessToken);

            dispatch(
              setAuth({ accessToken, refreshToken, companyId, user })
            );
            setApiSession({ token: accessToken, companyId });

            dispatch(bootstrapLoad());
            dispatch(setChecked(true));
          }
        } catch (err) {
          console.error('[sessionApi.login] failed', err);
          // даже при ошибке логина checked=true, чтоб не был серый экран
          dispatch(setChecked(true));
        }
      },
    }),

    /** ====== REFRESH ====== */
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

          const accessToken =
            data.accessToken ?? data.token ?? data.tokens?.accessToken ?? null;
          const refreshToken =
            data.refreshToken ?? data.tokens?.refreshToken ?? null;
          const companyIdResp =
            data.activeCompanyId ??
            data.companyId ??
            arg?.companyId ??
            loadCID();
          const user = data.user ?? null;

          if (!accessToken) {
            destroySocket();
            if (!silent) {
              dispatch(logout());
              setApiSession({ token: null, companyId: null });
              saveRT(null);
              saveCID(null);
            }
            dispatch(setChecked(true));
            return;
          }

          saveRT(refreshToken);
          saveCID(companyIdResp);

          dispatch(
            setAuth({
              accessToken,
              refreshToken,
              companyId: companyIdResp,
              user,
            })
          );
          setApiSession({ token: accessToken, companyId: companyIdResp });

          dispatch(bootstrapLoad());
          initSocket(accessToken);
          dispatch(setChecked(true));
        } catch (err) {
          console.error('[sessionApi.refresh] failed', err);
          destroySocket();
          if (!silent) {
            dispatch(logout());
            setApiSession({ token: null, companyId: null });
            saveRT(null);
            saveCID(null);
          }
          dispatch(setChecked(true));
        }
      },
    }),

    /** ====== LOGOUT ====== */
    logout: build.mutation({
      query: () => {
        const rt = loadRT();
        return {
          url: '/auth/logout',
          method: 'POST',
          body: rt ? { refreshToken: rt } : {},
        };
      },
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (err) {
          console.error('[sessionApi.logout] server logout failed', err);
        } finally {
          // 1) убиваем сокет
          destroySocket();

          // 2) глобально чистим весь Redux (auth, bootstrap, chat, crmApi cache и т.д.)
          dispatch(resetApp());

          // 3) чистим sessionCtx + localStorage
          setApiSession({ token: null, companyId: null });
          saveRT(null);
          saveCID(null);

          // 4) помечаем, что проверка завершена,
          // чтобы AppShell не показывал серый экран
          dispatch(setChecked(true));
        }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
} = sessionApi;

export const sessionStorageHelpers = { loadRT, loadCID, saveRT, saveCID };