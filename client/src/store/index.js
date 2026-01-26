// src/store/index.js
import { configureStore, combineReducers, createListenerMiddleware } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import authReducer, { setAuth, logout } from './slices/authSlice';
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

const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  actionCreator: setAuth,
  effect: (action, api) => {
    const prevCompanyId = api.getOriginalState()?.auth?.companyId ?? null;
    const hasCompanyId = Object.prototype.hasOwnProperty.call(action.payload || {}, 'companyId');
    const nextCompanyId = hasCompanyId ? action.payload.companyId : prevCompanyId;
    if (hasCompanyId && String(prevCompanyId || '') !== String(nextCompanyId || '')) {
      api.dispatch(crmApi.util.resetApiState());
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: logout,
  effect: (_action, api) => {
    api.dispatch(crmApi.util.resetApiState());
  },
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
  middleware: (getDefault) => getDefault().prepend(listenerMiddleware.middleware).concat(crmApi.middleware),
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
