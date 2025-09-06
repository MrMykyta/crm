import { Formik, Form, useField, ErrorMessage } from 'formik';
import { getMe, updateMe } from '../../api/user';
import { loginFromCompany } from '../../api/auth';
import { refreshSession } from '../../api/session';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { createCompany } from '../../api/auth';
import { useTranslation } from 'react-i18next';
import s from '../../styles/formGlass.module.css';

// Универсальный блок: input или select, с плавающим лейблом и .filled
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
          await refreshSession(); // ожидаем { token, user }
          const user = await getMe(); // ожидаем { id, name, shortName, vat, domain, logoUrl,... }
          console.log('user:', user);
          const contacts = {
            companyId: company.activeCompanyId,
            ownerType: 'user',
            ownerId: user.id,
            channel: 'email',
            value: user.email,
            actorUserId: user.id,
            isPrimary: true
          };
          await updateMe(contacts);
          const res = await loginFromCompany(company.activeCompanyId);
          console.log('res:', res.safeUser);
          setUser(res.safeUser);
          navigate('/main');
        } catch (e) {
          setStatus(e?.response?.data?.message || t('errors.createCompanyFailed'));
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