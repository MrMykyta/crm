import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import s from '../../../styles/formGlass.module.css';

// ==== fetch shims ====
async function createCompany(values) {
  const res = await fetch('/api/companies', {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error('create company failed');
  return res.json();
}
async function refreshSession() {
  const res = await fetch('/api/auth/refresh', {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
  });
  if (!res.ok) return null;
  return res.json();
}
async function getMe() {
  const res = await fetch('/api/users/me', { credentials:'include' });
  if (!res.ok) throw new Error('get me failed');
  return res.json();
}
async function updateMeContact(contactPayload) {
  // скорректируй url под свой бэк, если отличается
  const res = await fetch('/api/users/me/contacts', {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(contactPayload),
  });
  if (!res.ok) throw new Error('contact update failed');
  return res.json().catch(()=>({ok:true}));
}
async function loginFromCompany(companyId) {
  const res = await fetch('/api/auth/login-from-company', {
    method:'POST',
    credentials:'include',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ companyId }),
  });
  if (!res.ok) throw new Error('login from company failed');
  return res.json();
}

// Универсальный блок
function FieldBlock({ as, name, label, children, ...props }) {
  const [field, meta] = useField(name);
  const isFilled = ((field.value ?? '') !== '');
  const hasError = meta.touched && !!meta.error;

  if (as === 'select') {
    return (
      <div className={`${s.field} ${isFilled ? s.filled : ''} ${hasError ? s.error : ''}`}>
        <div className={s.selectWrap}>
          <select {...field} {...props} className={s.select}>
            {children}
          </select>
        </div>
        <label>{label}</label>
        <ErrorMessage name={name} component="div" className={s.err} />
      </div>
    );
  }

  return (
    <div className={`${s.field} ${isFilled ? s.filled : ''} ${hasError ? s.error : ''}`}>
      <input {...field} {...props} placeholder=" " />
      <label>{label}</label>
      <ErrorMessage name={name} component="div" className={s.err} />
    </div>
  );
}

export default function CompanySetup({setUser}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const schema = Yup.object({
    name:      Yup.string().max(120, 'Too long').required(t('common.required')),
    legalName: Yup.string().max(160, 'Too long').nullable(),
    taxId:     Yup.string().max(32, 'Too long').nullable(),
    country:   Yup.string().length(2, 'ISO 2').required(t('common.required')),
    website:   Yup.string().url('Invalid URL').nullable(),
  });

  return (
    <Formik
      initialValues={{ name:'', legalName:'', taxId:'', country:'PL', website:'' }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, setStatus }) => {
        setStatus(null);
        try {
          const company = await createCompany(values);
          await refreshSession();
          const user = await getMe();

          const contacts = {
            companyId: company.activeCompanyId || company.id,
            ownerType: 'user',
            ownerId: user.id,
            channel: 'email',
            value: user.email,
            actorUserId: user.id,
            isPrimary: true
          };
          await updateMeContact(contacts);

          const res = await loginFromCompany(company.activeCompanyId || company.id);
          if (setUser && res?.safeUser) setUser(res.safeUser);
          navigate('/main');
        } catch (e) {
          setStatus(e?.message || t('errors.createCompanyFailed'));
        } finally { setSubmitting(false); }
      }}
    >
      {({ isSubmitting, status }) => (
        <Form className={s.form}>
          <FieldBlock name="name" label={t('company.name')} />
          <FieldBlock name="legalName" label={t('company.legalName')} />

          <FieldBlock as="select" name="country" label={t('company.country')}>
            <option value="PL">{t('countries.PL')}</option>
            <option value="UA">{t('countries.UA')}</option>
            <option value="DE">{t('countries.DE')}</option>
            <option value="CZ">{t('countries.CZ')}</option>
            <option value="LT">{t('countries.LT')}</option>
          </FieldBlock>

          <FieldBlock name="taxId" label={t('company.taxId')} />
          <FieldBlock name="website" label={t('company.website')} />
          <div className={s.hint}>{t('company.nipHint')}</div>

          {status && <div className={s.err}>{status}</div>}

          <button className={s.btn} type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : t('company.continue')}
          </button>
        </Form>
      )}
    </Formik>
  );
}