// src/store/rtk/userApi.js
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

export const userApi = crmApi.injectEndpoints({
  endpoints: (build) => ({

    getMyPreferences: build.query({
      query: () => ({ url: '/system/me/preferences', method: 'GET' }),
      transformResponse: (resp) => normalizePrefs(resp),
      providesTags: [{ type: 'Preferences', id: 'me' }],
    }),

    saveMyPreferences: build.mutation({
      query: (payload) => {
        const body = buildSaveBody(payload || {});
        return { url: '/system/me/preferences', method: 'PUT', body };
      },
      transformResponse: (resp) => normalizePrefs(resp),
      invalidatesTags: [
        { type: 'Preferences', id: 'me' },
        { type: 'User', id: 'me' },
      ],
    }),

    getMe: build.query({
      query: () => ({ url: '/users/me', method: 'GET' }),
      providesTags: [{ type: 'User', id: 'me' }],
    }),

    updateMe: build.mutation({
      query: (body) => ({ url: '/users/me', method: 'PATCH', body }),
      invalidatesTags: [{ type: 'User', id: 'me' }],
    }),

    getUserById: build.query({
      query: (userId) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),

    updateUserById: build.mutation({
      query: ({ userId, body }) => ({
        url: `/users/${encodeURIComponent(userId)}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { userId }) => [{ type: 'User', id: userId }],
    }),

    addMyContact: build.mutation({
      query: (body) => ({
        url: '/users/me/contacts',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'User', id: 'me' }],
    }),

    /** 👇 НОВОЕ: lookup по email */
    lookupUserByEmail: build.query({
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