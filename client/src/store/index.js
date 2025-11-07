import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from './slices/authSlice';
import bootstrapReducer from './slices/bootstrapSlice';
import lookupsReducer from './slices/lookupsSlice';
import { crmApi } from './rtk/crmApi';
import { initRealtime } from './rtk/realtime';

const store = configureStore({
  reducer: {
    auth: authReducer,
    bootstrap: bootstrapReducer,
    lookups: lookupsReducer,
    [crmApi.reducerPath]: crmApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(crmApi.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

setupListeners(store.dispatch);

// SSE после логина (когда есть токен и companyId)
let stopRealtime = null;
export function startRealtime() {
  if (stopRealtime) stopRealtime();
  stopRealtime = initRealtime(store);
}

export default store;