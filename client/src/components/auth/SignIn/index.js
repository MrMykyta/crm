import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { login } from '../../../api/auth';
import { getMe } from '../../../api/user';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setTokens, setCompanyId } from '../../../api/session';
import { useTheme } from "../../../Providers/ThemeProvider";
import CompanySelect from '../../company/CompanySelect';
import ForgotPasswordModal from '../ForgotPasswordModal';
import s from '../../../styles/formGlass.module.css';

function InputField({ name, label, type = 'text', autoComplete }) {
  const [field] = useField(name);
  const filled = (field.value ?? '') !== '';
  return (
    <div className={`${s.field} ${filled ? s.filled : ''}`}>
      <input {...field} type={type} autoComplete={autoComplete} placeholder=" " />
      <label>{label}</label>
      <ErrorMessage name={name} component="div" className={s.err} />
    </div>
  );
}

export default function SignIn({ onSwitch, onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companiesModal, setCompaniesModal] = useState({ open: false, list: [], creds: null });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [emailForForgot, setEmailForForgot] = useState('');
  const { hydrateFromServer } = useTheme();


  const schema = Yup.object({
    email: Yup.string().email(t('common.invalidEmail')).required(t('common.required')),
    password: Yup.string().min(6, t('common.tooShort')).required(t('common.required')),
  });

  const initialValues = { email:'', password:'' };

  // Унифицированный апдейтер после удачного логина
  const finishLogin = async (payload) => {
    // Поддерживаем оба формата ответа:
    // A) { data: { tokens, activeCompanyId, user } }
    // B) { tokens, activeCompanyId, user } на верхнем уровне
    const d = payload?.data ?? payload ?? {};

    if (d.tokens) {
      await setTokens({accessToken: d.tokens.accessToken, refreshToken: d.tokens.refreshToken, activeCompanyId: d.activeCompanyId});
      await hydrateFromServer();
    } else if (d.activeCompanyId) {
      // если токен уже проставлен интерсептором/кукой — просто активируем компанию
      await setCompanyId(d.activeCompanyId);
    }

    // поднимаем пользователя в App (через AuthPage.setUser)
    if (d.user) {
      try { 
        const user = await getMe(d.userId);
        localStorage.setItem('user', JSON.stringify(user)); 
        onLogin?.(user);
      } catch {}
    }
    // после сохранения токенов/юзера
    window.dispatchEvent(new Event('auth:logged-in'));
    navigate('/main/pulpit', { replace: true });
  };

  const handleLogin = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    try {
      const res = await login(values.email, values.password);
      // кейс выбора компании
      if (res?.data?.selectCompany && Array.isArray(res.data.companies)) {
        setCompaniesModal({ open: true, list: res.data.companies, creds: values });
        return;
      }

      // «современный» ответ
      if (res?.data?.tokens || res?.data?.activeCompanyId || res?.data?.user) {
        await finishLogin(res);
        return;
      }

      // «плоский» ответ
      if (res?.tokens || res?.activeCompanyId || res?.user) {
        await finishLogin(res);
        return;
      }

      // fallback: если сервер не прислал ничего особенного, но не упал
      navigate('/main', { replace: true });
    } catch (e) {
      setStatus(t(e?.response?.data?.error) || t('errors.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCompany = async (choice) => {
    setCompaniesModal(m => ({ ...m, open: false }));
    if (!choice) return;

    if (choice === '__create__') {
      navigate('/auth/company-setup');
      return;
    }
    try {
      const { creds } = companiesModal;
      const res = await login(creds.email, creds.password, choice);
      await finishLogin(res);
    } catch {
      // если вдруг упало — снова показать модалку
      setCompaniesModal(m => ({ ...m, open: true }));
    }
  };

  return (
    <>
      <Formik initialValues={initialValues} validationSchema={schema} onSubmit={handleLogin}>
        {({ isSubmitting, status, values }) => (
          <Form className={s.form}>
            <InputField name="email" label={t('common.email')} type="email" autoComplete="email" />
            <InputField name="password" label={t('common.password')} type="password" autoComplete="current-password" />

            {status && <div className={s.err}>{status}</div>}

            <button className={s.btn} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.signingIn') : t('auth.signIn')}
            </button>

            <div className={s.footerRow}>
              <button type="button" className={s.link} onClick={onSwitch}>
                {t('auth.createAccount')}
              </button>
              <button
                type="button"
                className={s.ghost}
                onClick={() => { setEmailForForgot(values.email); setForgotOpen(true); }}
              >
                {t('auth.forgot')}
              </button>
            </div>
          </Form>
        )}
      </Formik>

      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={emailForForgot}
        onClose={() => setForgotOpen(false)}
      />

      <CompanySelect
        open={companiesModal.open}
        companies={companiesModal.list}
        onConfirm={confirmCompany}
        onCancel={() => setCompaniesModal(m => ({ ...m, open: false }))}
      />
    </>
  );
}





