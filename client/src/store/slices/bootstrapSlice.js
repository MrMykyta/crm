import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { companyUsersApi } from '../rtk/companyUsersApi';
import { counterpartyApi } from '../rtk/counterpartyApi';
import { sessionApi } from '../rtk/sessionApi';
import { setAuth } from './authSlice';
import { setApiSession } from '../rtk/crmApi';

/**
 * 1) Тихий refresh через RTK endpoint
 */
export const tryRefreshSession = createAsyncThunk(
  'bootstrap/tryRefreshSession',
  async (_arg, { dispatch, getState }) => {
    try {
      const data = await dispatch(sessionApi.endpoints.refresh.initiate()).unwrap();
      const token =
        data?.accessToken || data?.token || data?.tokens?.accessToken || null;
      const companyId = data?.activeCompanyId || data?.companyId || null;
      const user = data?.user ?? null;

      if (token) {
        dispatch(setAuth({ token, companyId, user }));
        setApiSession({ token, companyId });
        return { ok: true, companyId, user };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }
);

/**
 * 2) Прогрев данных (если авторизованы)
 */
export const bootstrapLoad = createAsyncThunk(
  'bootstrap/load',
  async (_arg, { dispatch, getState }) => {
    const token = getState()?.auth?.accessToken;
    if (!token) return { companyUsers: [], counterparties: [], roles: [] };

    const results = await Promise.allSettled([
      dispatch(
        companyUsersApi.endpoints.listCompanyUsers.initiate(
          { page: 1, limit: 200, sort: 'lastName', dir: 'ASC' },
          { forceRefetch: true }
        )
      ),
      dispatch(
        counterpartyApi.endpoints.listCounterparties.initiate(
          { limit: 500 },
          { forceRefetch: true }
        )
      ),
    ]);

    const safe = (r) => (r?.value?.data ?? r?.value ?? []);
    const usersRes = safe(results[0]);
    const countersRes = safe(results[1]);

    const companyUsers = Array.isArray(usersRes?.items) ? usersRes.items : (usersRes?.data ?? usersRes ?? []);
    const counterparties = Array.isArray(countersRes?.items) ? countersRes.items : (countersRes?.data ?? countersRes ?? []);

    // Поддержка легаси-хуков, читающих localStorage.companyMembers
    try {
      localStorage.setItem('companyMembers', JSON.stringify(companyUsers || []));
      window.dispatchEvent(new StorageEvent('storage', { key: 'companyMembers' }));
    } catch {}

    return { companyUsers, counterparties, roles: [] };
  }
);

/**
 * 3) Композитная инициализация
 */
export const bootstrapInit = createAsyncThunk(
  'bootstrap/init',
  async (_arg, { dispatch, getState }) => {
    await dispatch(tryRefreshSession());
    await dispatch(bootstrapLoad());
    const st = getState().bootstrap;
    return {
      companyUsers: st.companyUsers,
      counterparties: st.counterparties,
      roles: st.roles,
    };
  }
);

const bootstrapSlice = createSlice({
  name: 'bootstrap',
  initialState: {
    companyUsers: [],
    counterparties: [],
    roles: [],
    loaded: false,
    checked: false,
  },
  reducers: {
    setChecked: (s, a) => { s.checked = !!a.payload; },
  },
  extraReducers: (b) => {
    b.addCase(bootstrapLoad.fulfilled, (state, action) => {
      Object.assign(state, action.payload, { loaded: true });
    });
    b.addCase(bootstrapInit.fulfilled, (state) => {
      state.checked = true;
    });
    b.addCase(bootstrapInit.rejected, (state) => {
      state.checked = true;
    });
    b.addCase(tryRefreshSession.rejected, () => {
      // no-op
    });
  },
});

export const { setChecked } = bootstrapSlice.actions;
export default bootstrapSlice.reducer;