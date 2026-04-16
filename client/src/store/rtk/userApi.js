// src/store/rtk/userApi.js
// User API RTK endpoints: profile, preferences, and user-level updates.
// Important: when updating avatar, invalidate CompanyUser list so chat list avatars refresh.
import { crmApi } from './crmApi';

/** Нормализуем ответ сервера в единый формат */
const normalizePrefs = (raw) => {
  const pref = raw?.pref ?? raw ?? {};
  const themeMode = pref.themeMode ?? pref.theme ?? undefined;
  const lang      = pref.language ?? pref.lang ?? pref.locale ?? undefined;

  const appearance = { ...(pref.appearance || {}) };
  if (!appearance.backgroundPath && pref?.background?.url) {
    appearance.backgroundPath = String(pref.background.url);
  }
  return { themeMode, lang, appearance };
};

// buildSaveBody: собирает итоговую структуру данных для слоя RTK Query.
const buildSaveBody = ({ themeMode, lang, appearance } = {}) => {
  const body = {};

  if (typeof themeMode !== 'undefined') body.themeMode = themeMode;
  if (typeof lang !== 'undefined' && lang !== null) body.language = lang;

  const outApp = {};
  Object.entries(appearance || {}).forEach(([k, v]) => {
    if (typeof v !== 'undefined') outApp[k] = v;
  });

  const bgPath = outApp.backgroundPath ?? null;
  if (bgPath) {
    body.background = { url: bgPath };
  } else if ('backgroundPath' in outApp) {
    body.background = null;
  }

  body.appearance = outApp;
  return body;
};

// stripCompanyId: вспомогательная логика для слоя RTK Query.
const stripCompanyId = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    value.delete('companyId');
    return value;
  }
  if (value.constructor !== Object) return value;
  const { companyId, ...rest } = value;
  return rest;
};

export const userApi = crmApi.injectEndpoints({
    // endpoints: описывает набор endpoint-ов RTK Query.
endpoints: (build) => ({

    getMyPreferences: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => ({ url: '/system/me/preferences', method: 'GET' }),
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => normalizePrefs(resp),
      providesTags: [{ type: 'Preferences', id: 'me' }],
    }),

    saveMyPreferences: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (payload) => {
        const body = buildSaveBody(payload || {});
        return { url: '/system/me/preferences', method: 'PUT', body };
      },
            // transformResponse: нормализует ответ API перед записью в кэш.
transformResponse: (resp) => normalizePrefs(resp),
      invalidatesTags: [
        { type: 'Preferences', id: 'me' },
        { type: 'User', id: 'me' },
      ],
    }),

    getMe: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: () => ({ url: '/users/me', method: 'GET' }),
      providesTags: [{ type: 'User', id: 'me' }],
    }),

    updateMe: build.mutation({
      // PATCH /users/me — updates current user profile (incl. avatarUrl).
      query: (body) => ({ url: '/users/me', method: 'PATCH', body: stripCompanyId(body) }),
      // Invalidate both /users/me and company users list to refresh chat list avatars.
      invalidatesTags: [
        { type: 'User', id: 'me' },
        { type: 'CompanyUser', id: 'LIST' },
      ],
    }),

    getUserById: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (userId) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'GET',
      }),
            // providesTags: возвращает теги кэша для автообновления данных.
providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),

    updateUserById: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: ({ userId, body }) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'PATCH',
        body: stripCompanyId(body),
      }),
            // invalidatesTags: помечает теги кэша для рефетча связанных данных.
invalidatesTags: (_r, _e, { userId }) => [{ type: 'User', id: userId }],
    }),

    addMyContact: build.mutation({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (body) => ({
        url: '/users/me/contacts',
        method: 'POST',
        body: stripCompanyId(body),
      }),
      invalidatesTags: [{ type: 'User', id: 'me' }],
    }),

    /** 👇 НОВОЕ: lookup по email */
    lookupUserByEmail: build.query({
            // query: формирует параметры HTTP-запроса для endpoint-а.
query: (email) => ({
        url: '/users/lookup',
        method: 'GET',
        params: { email },      // crmApi сам подставит ?email=
      }),
      // на сервере ожидаем ответ вида { exists, user? }
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMyPreferencesQuery,
  useSaveMyPreferencesMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useUpdateMeMutation,
  useGetUserByIdQuery,
  useUpdateUserByIdMutation,
  useAddMyContactMutation,
  // 👇 хук для lookup
  useLookupUserByEmailQuery,
  useLazyLookupUserByEmailQuery,
} = userApi;

