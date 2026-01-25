import { crmApi, setApiSession } from './crmApi';
import { setAuth } from '../slices/authSlice';
import { bootstrapLoad } from '../slices/bootstrapSlice';

export const authApi = crmApi.injectEndpoints({
  endpoints: (build) => ({
    // регистрация
    registerUser: build.mutation({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    // подтверждение email
    verifyEmail: build.mutation({
      query: (token) => ({ url: '/auth/verify', method: 'GET', params: { token } }),
      async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          console.log(data);
          const accessToken = data?.tokens?.accessToken ?? data?.accessToken ?? null;
          const refreshToken = data?.tokens?.refreshToken ?? data?.refreshToken ?? null;
          const companyId = data?.activeCompanyId ?? data?.companyId ?? null;
          const user = data?.user ?? null;
          if (accessToken) {
            dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
            setApiSession({ token: accessToken, companyId });
            dispatch(bootstrapLoad());
          }
        } catch {}
      },
    }),
    resendVerification: build.mutation({
      query: (email) => ({ url: '/auth/resend-verification', method: 'POST', body: { email } }),
    }),
    // логин (если ты уже сделал в sessionApi.login — ок, дублировать не обязательно)
    login: build.mutation({
      query: ({ email, password, companyId }) => ({ url: '/auth/login', method: 'POST', body: { email, password, companyId } }),
      async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          const accessToken = data?.tokens?.accessToken ?? data?.accessToken ?? null;
          const refreshToken = data?.tokens?.refreshToken ?? data?.refreshToken ?? null;
          const companyId = data?.activeCompanyId ?? data?.companyId ?? null;
          const user = data?.user ?? null;
          dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
          setApiSession({ token: accessToken, companyId });
          dispatch(bootstrapLoad());
        } catch {}
      },
    }),
    loginFromCompany: build.mutation({
      query: (companyId) => ({ url: '/auth/login-from-company', method: 'POST', body: { companyId } }),
      async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          console.log(data);
          const accessToken = data?.tokens?.accessToken ?? data?.accessToken ?? null;
          const refreshToken = data?.tokens?.refreshToken ?? data?.refreshToken ?? null;
          const companyId = data?.activeCompanyId ?? data?.companyId ?? null;
          const user = data?.user ?? null;
          dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
          setApiSession({ token: accessToken, companyId });
          dispatch(bootstrapLoad());
        } catch {}
      },
    }),
    createCompany: build.mutation({
      query: (payload) => ({ url: '/companies', method: 'POST', body: payload }),
      async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
        try {
          const { data } = await queryFulfilled;
          const accessToken = data?.tokens?.accessToken ?? data?.accessToken ?? null;
          const refreshToken = data?.tokens?.refreshToken ?? data?.refreshToken ?? null;
          const companyId = data?.activeCompanyId ?? data?.companyId ?? data?.company?.id ?? null;
          const user = data?.user ?? null;
          if (accessToken) {
            dispatch(setAuth({ accessToken, refreshToken, companyId, user }));
            setApiSession({ token: accessToken, companyId });
            dispatch(bootstrapLoad());
          }
        } catch {}
      },
    }),
    // пароли
    requestPasswordReset: build.mutation({
      query: (email) => ({ url: '/auth/password/reset-request', method: 'POST', body: { email } }),
    }),
    resetPassword: build.mutation({
      query: ({ token, password }) => ({ url: '/auth/reset', method: 'POST', body: { token, password } }),
    }),
  }),
});

export const {
  useRegisterUserMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLoginMutation: useAuthLoginMutation, // если хочешь использовать именно из authApi
  useLoginFromCompanyMutation,
  useCreateCompanyMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
} = authApi;
