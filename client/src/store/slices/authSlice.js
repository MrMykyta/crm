// src/store/slices/authSlice.js
import { createSlice } from '@reduxjs/toolkit';
import { setApiSession } from '../../store/rtk/crmApi';

// --------- helpers ----------
const getApiBase = () => {
  // если задан REACT_APP_API_URL — используем его, иначе относительный /api
  const base = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');
  return base ? `${base}/api` : '/api';
};

const initialState = {
  accessToken: null,
  refreshToken: null,
  companyId: null,
  currentUser: null,
  avatarRev: 0, // ревизия для busting кэша аватара
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Полная установка auth (логин/рефреш)
    setAuth: (state, action) => {
      const { accessToken, refreshToken, token, companyId, user } = action.payload || {};
      state.accessToken  = accessToken || token || null;
      state.refreshToken = (typeof refreshToken !== 'undefined') ? refreshToken : state.refreshToken;
      state.companyId    = (typeof companyId    !== 'undefined') ? companyId    : state.companyId;
      if (typeof user !== 'undefined') {
        state.currentUser = user;
      }
    },

    // Частичный патч currentUser (не затирая прочие поля)
    patchUser: (state, action) => {
      const patch = action.payload || {};
      if (!state.currentUser) state.currentUser = {};
      Object.assign(state.currentUser, patch);

      // Если обновляли avatarUrl — прибавим ревизию
      if (Object.prototype.hasOwnProperty.call(patch, 'avatarUrl')) {
        state.avatarRev += 1;
      }
    },

    // Полный логаут
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.companyId = null;
      state.currentUser = null;
      state.avatarRev = 0;
    },
  },
});

export const { setAuth, patchUser, logout } = authSlice.actions;
export default authSlice.reducer;

/* ===========================
   Селекторы
   =========================== */

export const selectUser = (s) => s.auth?.currentUser || null;

export const selectAvatarUrl = (s) => {
  const url = s.auth?.currentUser?.avatarUrl || null;
  if (!url) return null;
  const rev = s.auth?.avatarRev ?? 0;
  return url.includes('?') ? `${url}&v=${rev}` : `${url}?v=${rev}`;
};

/* ===========================
   Thunks / helpers
   =========================== */

// Безопасно записать auth во все места: redux + sessionCtx + localStorage
export const applyAuth = ({ token, accessToken, refreshToken, companyId, user } = {}) =>
  (dispatch, getState) => {
    const state = getState();
    const prev  = state.auth || {};

    const at  = accessToken || token || null;
    const cid = (typeof companyId !== 'undefined') ? companyId : prev.companyId;
    const me  = (typeof user !== 'undefined') ? user : prev.currentUser;

    // в Redux
    dispatch(setAuth({ accessToken: at, refreshToken, companyId: cid, user: me }));

    // в sessionCtx (для rtk/fetch prepareHeaders)
    setApiSession({ token: at, companyId: cid });

    // в localStorage (чтобы переживать перезагрузку вкладки)
    try {
      if (at)      localStorage.setItem('accessToken', at); else localStorage.removeItem('accessToken');
      if (cid)     localStorage.setItem('companyId', String(cid)); else localStorage.removeItem('companyId');
      if (me)      localStorage.setItem('user', JSON.stringify(me)); else localStorage.removeItem('user');
    } catch {}
  };

// Удобный thunk: только обновить пользователя (например после аплоада аватара)
export const applyUserPatch = (userPatch) => (dispatch, getState) => {
  const state = getState();
  const prev  = state.auth?.currentUser || null;
  const next  = { ...(prev || {}), ...(userPatch || {}) };

  dispatch(patchUser(userPatch)); // оптимистичный апдейт
  try { localStorage.setItem('user', JSON.stringify(next)); } catch {}
};

// Полный logout: дернуть бэк для чистки refresh и зачистить клиент
export const doLogout = () => async (dispatch) => {
  try {
    await fetch(`${getApiBase()}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {}
  setApiSession({ token: null, companyId: null });

  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('companyId');
    localStorage.removeItem('user');
  } catch {}

  dispatch(logout());

  // уводим на /auth, чтобы не оставаться на защищённых маршрутах
  if (typeof window !== 'undefined') window.location.replace('/auth');
};