// src/components/company/CompanySetup/index.jsx
import React from 'react';
import { Formik, Form, useField, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import s from '../../../styles/formGlass.module.css';
import ThemedSelect from '../../../components/inputs/RadixSelect';

import {
  useCreateCompanyMutation,
  useLoginFromCompanyMutation,
} from '../../../store/rtk/authApi';
import {
  useLazyGetMeQuery,
  useAddMyContactMutation,
} from '../../../store/rtk/userApi';

function FieldBlock({ as, name, label, children, ...props }) {
  const [field, meta, helpers] = useField(name);
  const isFilled = (field.value ?? '') !== '';
  const hasError = meta.touched && !!meta.error;

  if (as === 'select') {
    const options = React.Children.toArray(children).map((child) => ({
      value: child.props.value,
      label: child.props.children,
    }));
    return (
      <div className={`${s.field} ${isFilled ? s.filled : ''} ${hasError ? s.error : ''}`}>
        <label>{label}</label>
        <ThemedSelect
          value={field.value}
          onChange={(val) => helpers.setValue(val)}
          options={options}
          placeholder="—"
          size="md"
        />
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

export default function CompanySetup({ setUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [createCompany,   { isLoading: isCreating   }] = useCreateCompanyMutation();
  const [loginFromCompany,{ isLoading: isLoggingIn }] = useLoginFromCompanyMutation();
  const [addMyContact,    { isLoading: isSavingCnt  }] = useAddMyContactMutation();
  const [triggerGetMe] = useLazyGetMeQuery(); // 👈 вместо fetch('/users/me')

  const toNull = (v) => (v === '' ? null : v);

  const schema = Yup.object({
    name:      Yup.string().max(120, 'Too long').required(t('common.required')),
    legalName: Yup.string().max(160, 'Too long').transform(toNull).nullable(),
    taxId:     Yup.string().max(32,  'Too long').transform(toNull).nullable(),
    country:   Yup.string().length(2, 'ISO 2').required(t('common.required')),
    website:   Yup.string().url('Invalid URL').transform(toNull).nullable(),
  });

  return (
    <Formik
      initialValues={{ name:'', legalName:'', taxId:'', country:'PL', website:'' }}
      validationSchema={schema}
      onSubmit={async (values, { setSubmitting, setStatus }) => {
        setStatus(null);
        try {
          // 1) создаём компанию (authApi.onQueryStarted сам положит токены/activeCompanyId)
          const data = await createCompany(values).unwrap();

          const companyId =
            data?.activeCompanyId ||
            data?.companyId ||
            data?.company?.id ||
            null;

          // 2) получаем пользователя через RTK
          const user = await triggerGetMe().unwrap();

          // 3) создаём первичный контакт (email)
          if (companyId && user?.id && user?.email) {
            await addMyContact({
              companyId,
              ownerType: 'user',
              ownerId: user.id,
              channel: 'email',
              value: user.email,
              actorUserId: user.id,
              isPrimary: true,
            }).unwrap().catch(()=>{});
          }

          // 4) если бэк не вернул tokens — логин в компанию
          if (!data?.tokens && companyId) {
            const res = await loginFromCompany(companyId).unwrap().catch(()=>null);
            if (setUser && res?.safeUser) setUser(res.safeUser);
          }

          // 5) редирект
          navigate('/main');
        } catch (e) {
          const msg = e?.data?.error || e?.data?.message || e?.message || t('errors.createCompanyFailed');
          setStatus(msg);
        } finally {
          setSubmitting(false);
        }
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

          <button
            className={s.btn}
            type="submit"
            disabled={isSubmitting || isCreating || isLoggingIn || isSavingCnt}
          >
            {isSubmitting || isCreating || isLoggingIn || isSavingCnt
              ? t('common.saving')
              : t('company.continue')}
          </button>
        </Form>
      )}
    </Formik>
  );
}