import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../../Providers/ThemeProvider";

// ⬇️ RTK Query login
import { useLoginMutation } from '../../../store/rtk/sessionApi';

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

export default function SignIn({ onSwitch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companiesModal, setCompaniesModal] = useState({ open: false, list: [], creds: null });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [emailForForgot, setEmailForForgot] = useState('');
  const { hydrateFromServer } = useTheme();

  const [login, { isLoading }] = useLoginMutation();

  const schema = Yup.object({
    email: Yup.string().email(t('common.invalidEmail')).required(t('common.required')),
    password: Yup.string().min(6, t('common.tooShort')).required(t('common.required')),
  });

  const initialValues = { email:'', password:'' };

  // Унифицированный «финиш логина»
  const finishLogin = async () => {
    try { await hydrateFromServer(); } catch {}
    // запускаем приложение
    window.dispatchEvent(new Event('auth:logged-in'));
    navigate('/main/pulpit', { replace: true });
  };

  const handleLogin = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    try {
      const res = await login({ email: values.email, password: values.password }).unwrap();

      // сервер может вернуть необходимость выбора компании
      if (res?.selectCompany && Array.isArray(res?.companies)) {
        setCompaniesModal({ open: true, list: res.companies, creds: values });
        return;
      }

      // обычный сценарий — onQueryStarted в sessionApi уже положил в Redux токен/user/companyId
      await finishLogin();
    } catch (e) {
      // пытаемся вытащить ошибку сервера (i18n-ключи поддерживаются)
      const msg = e?.data?.error || e?.error || e?.message || 'errors.loginFailed';
      setStatus(t(msg));
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
      await login({ email: creds.email, password: creds.password, companyId: choice }).unwrap();
      await finishLogin();
    } catch (e) {
      // если упало, снова показать модалку выбора
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

            <button className={s.btn} type="submit" disabled={isSubmitting || isLoading}>
              {(isSubmitting || isLoading) ? t('common.signingIn') : t('auth.signIn')}
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