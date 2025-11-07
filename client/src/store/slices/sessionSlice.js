// src/store/slices/sessionSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  token: null,
  user: null,
  companyId: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(state, { payload }) {
      state.token = payload.token ?? null;
      state.user = payload.user ?? null;
      state.companyId = payload.companyId ?? payload.user?.companyId ?? null;
    },
    clearSession() {
      return initialState;
    },
  },
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;