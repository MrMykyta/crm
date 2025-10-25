import { useEffect, useState } from 'react';
import EntityDetailPage from '../../_scaffold/EntityDetailPage';
import AvatarEditable from "../../../components/media/AvatarEditable";
import { companySchema, toFormCompany, toApiCompany } from '../../../schemas/company.schema';
import { getCompanyById, updateCompanyById } from '../../../api/company';
import { uploadFile, attachFromUrl } from '../../../api/uploads';
import { useTopbar } from "../../../Providers/TopbarProvider";
import styles from './CompanyInfoPage.module.css';

function useCompanyId() {
  return localStorage.getItem('companyId');
}

function CompanyLogoHeader({ values, onChange, companyId }) {
  const uploader = (file) =>
    uploadFile("companies", companyId, file, { purpose: "avatar", companyId });
  const urlUploader = (url) =>
    attachFromUrl("companies", companyId, url, { purpose: "avatar", companyId });

  return (
    <div className={styles.headerCard}>
      <div className={styles.logoBlock}>
        <AvatarEditable
          value={values?.avatarUrl || ""}
          onChange={(url) => onChange?.("avatarUrl", url)}
          label="Изменить"
          size={128}
          uploader={uploader}
          urlUploader={urlUploader}
        />
      </div>

      <div className={styles.titleBlock}>
        <div className={styles.title}>{values?.name || "Компания"}</div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'overview', label: 'Общее' },
  { key: 'history',  label: 'История изменений' },
];

export default function CompanyInfoPage() {
  const companyId = useCompanyId();
  const [base, setBase] = useState(null);
  const { setTitle, setSubtitle, reset } = useTopbar();

  useEffect(() => {
    setTitle("Информация о компании");  // можно ключ перевода: 'company.settings'
    return () => reset();            // при выходе вернуть дефолтное значение
  }, [setTitle, setSubtitle, reset]);

  useEffect(() => {
    (async () => {
      const d = await getCompanyById(companyId);
      setBase(d);
    })().catch(console.error);
  }, [companyId]);

  if (!base) return null;

  const load = async () => base;

  const save = async (_id, payload) => {
    const saved = await updateCompanyById(companyId, payload);
    setBase(saved);
    return saved;
  };

  return (
    <EntityDetailPage
      id={companyId}
      tabs={TABS}
      schemaBuilder={companySchema}
      toForm={toFormCompany}
      toApi={toApiCompany}
      load={load}
      save={save}
      storageKeyPrefix="company"
      autosave={{ debounceMs: 500 }}
      clearDraftOnUnmount
      leftTop={({ values, onChange }) => (
        <CompanyLogoHeader
          companyId={companyId}
          values={values}        // ← живые значения формы
          onChange={onChange}    // ← обновляет форму напрямую
        />
      )}
    />
  );
}