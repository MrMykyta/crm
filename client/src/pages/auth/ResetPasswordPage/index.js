import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import s from '../../../styles/formGlass.module.css';

// fetch shim
async function resetPassword(token, password) {
  const res = await fetch('/api/auth/reset', {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw new Error('reset failed');
  return res.json().catch(()=>({ ok:true }));
}

function InputField({ name, label, type='text', autoComplete }) {
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

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [sp] = useSearchParams();
  const token = sp.get('token');
  const navigate = useNavigate();

  const schema = Yup.object({
    password: Yup.string()
      .min(8, t('common.atLeast', { n: 8 }))
      .matches(/[A-Z]/, t('common.uppercase'))
      .matches(/[a-z]/, t('common.lowercase'))
      .matches(/[0-9]/, t('common.number'))
      .required(t('common.required')),
    confirm: Yup.string()
      .oneOf([Yup.ref('password')], t('auth.passwordsMustMatch', 'Passwords must match'))
      .required(t('common.required')),
  });

  const onSubmit = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    try {
      await resetPassword(token, values.password);
      setStatus({ ok: true });
      setTimeout(() => navigate('/auth'), 700);
    } catch {
      setStatus({ ok: false, msg: t('auth.resetInvalid', 'Invalid or expired link') });
    } finally { setSubmitting(false); }
  };

  if (!token) {
    return <div className={s.form} style={{ padding:16 }}>{t('auth.resetInvalid', 'Invalid or expired link')}</div>;
  }

  return (
    <div className={s.form} style={{ maxWidth: 520, margin:'24px auto' }}>
      <h2 style={{ textAlign:'center', color:'#e9edff' }}>{t('auth.setNewPassword', 'Set a new password')}</h2>
      <Formik initialValues={{ password:'', confirm:'' }} validationSchema={schema} onSubmit={onSubmit}>
        {({ isSubmitting, status }) => (
          <Form className={s.form}>
            <InputField name="password" label={t('common.password')} type="password" autoComplete="new-password" />
            <InputField name="confirm"  label={t('auth.confirmPassword', 'Confirm password')} type="password" autoComplete="new-password" />

            {status?.ok === false && <div className={s.err}>{status.msg}</div>}
            {status?.ok === true && <div style={{ color:'#79ffa9' }}>{t('auth.passwordUpdated', 'Password updated')}</div>}

            <button className={s.btn} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving', 'Saving…') : t('auth.updatePassword', 'Update password')}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}