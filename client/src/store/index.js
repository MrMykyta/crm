// src/store/index.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import bootstrapReducer from './slices/bootstrapSlice';
import lookupsReducer from './slices/lookupsSlice';
import { crmApi } from './rtk/crmApi';
import { initRealtime } from './rtk/realtime';

// --- обычный комбинированный редьюсер ---
const appReducer = combineReducers({
  auth: authReducer,
  bootstrap: bootstrapReducer,
  lookups: lookupsReducer,
  chat: chatReducer,
  [crmApi.reducerPath]: crmApi.reducer,
});

// --- rootReducer с глобальным RESET ---
const rootReducer = (state, action) => {
  if (action.type === 'APP/RESET') {
    state = undefined;            // убиваем всё состояние, Redux сам поднимет initialState
  }
  return appReducer(state, action);
};

// экшен для ресета (будем дергать из sessionApi.logout)
export const resetApp = () => ({ type: 'APP/RESET' });

const store = configureStore({
  reducer: rootReducer,
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