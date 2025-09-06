import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { registerUser, resendVerification } from '../../api/auth';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import EmailVerificationModal from '../EmailVerificationModal';
import s from '../../styles/formGlass.module.css';

function InputField({ name, label, type = 'text', autoComplete }) {
  const [field, meta] = useField(name);
  const filled = (field.value ?? '') !== '';
  return (
    <div className={`${s.field} ${filled ? s.filled : ''}`}>
      <input {...field} type={type} autoComplete={autoComplete} placeholder=" " />
      <label>{label}</label>
      <ErrorMessage name={name} component="div" className={s.err} />
    </div>
  );
}

export default function SignUp() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [emailForVerify, setEmailForVerify] = useState('');

  const schema = Yup.object({
    firstName: Yup.string().max(50).required(t('common.required')),
    lastName:  Yup.string().max(50).required(t('common.required')),
    email:     Yup.string().email(t('common.invalidEmail')).required(t('common.required')),
    password:  Yup.string()
      .min(8, t('common.atLeast', { n: 8 }))
      .matches(/[A-Z]/, t('common.uppercase'))
      .matches(/[a-z]/, t('common.lowercase'))
      .matches(/[0-9]/, t('common.number'))
      .required(t('common.required')),
  });

  const initialValues = { firstName:'', lastName:'', email:'', password:'' };

  const onSubmit = async (values, { setSubmitting, setStatus }) => {
    setStatus(null);
    try {
      const res = await registerUser(values); // { email } ожидается
      const email = res?.email || values.email;
      setEmailForVerify(email);
      setModalOpen(true); // 👈 показываем окно
    } catch (e) {
      setStatus(e?.response?.data?.message || t('errors.registrationFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!emailForVerify) return;
    try {
      await resendVerification(emailForVerify);
      // можно показать toast/alert, оставлю простой вариант:
      
    } catch {
      alert(t('auth.verificationResendFail', 'Resend failed'));
    }
  };

  return (
    <>
      <Formik initialValues={initialValues} validationSchema={schema} onSubmit={onSubmit}>
        {({ isSubmitting, status }) => (
          <Form className={s.form}>
            <InputField name="firstName" label={t('auth.firstName') || 'First name'} autoComplete="given-name" />
            <InputField name="lastName"  label={t('auth.lastName')  || 'Last name'}  autoComplete="family-name" />
            <InputField name="email"     label={t('common.email')}   type="email" autoComplete="email" />
            <InputField name="password"  label={t('common.password')} type="password" autoComplete="new-password" />

            {status && <div className={s.err}>{status}</div>}

            <button className={s.btn} type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.creating') : t('auth.createAccount')}
            </button>
          </Form>
        )}
      </Formik>

      <EmailVerificationModal
        open={modalOpen}
        email={emailForVerify}
        onClose={() => setModalOpen(false)}
        onResend={handleResend}
      />
    </>
  );
}