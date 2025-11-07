import { useEffect } from "react";
import { useSelector } from "react-redux";
import EntityDetailPage from "../../_scaffold/EntityDetailPage";
import AvatarEditable from "../../../components/media/AvatarEditable";
import { companySchema, toFormCompany, toApiCompany } from "../../../schemas/company.schema";
import { useGetCompanyQuery, useUpdateCompanyMutation } from "../../../store/rtk/companyApi";
import { useUploadFileMutation, useAttachFromUrlMutation } from "../../../store/rtk/uploadApi";
import { useTopbar } from "../../../Providers/TopbarProvider";
import styles from "./CompanyInfoPage.module.css";

function CompanyLogoHeader({ values, onChange, companyId, uploadFile, attachFromUrl, currentUserId }) {
  const uploader = async (file) => {
    const res = await uploadFile({
      ownerType: "company",
      ownerId: companyId,
      file,
      purpose: "avatar",
      companyId,
      uploadedBy: currentUserId,
    }).unwrap();
    const url = res?.url || res?.data?.url || res?.path || "";
    return { url };
  };

  const urlUploader = async (url) => {
    const res = await attachFromUrl({
      ownerType: "company",
      ownerId: companyId,
      remoteUrl: url,
      purpose: "avatar",
      companyId,
      uploadedBy: currentUserId,
    }).unwrap();
    const out = res?.url || res?.data?.url || res?.path || "";
    return { url: out };
  };

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
  { key: "overview", label: "Общее" },
  { key: "history", label: "История изменений" },
];

export default function CompanyInfoPage() {
  const { setTitle, reset } = useTopbar();
  const companyId = useSelector((s) => s.auth.companyId);
  const currentUserId = useSelector((s) => s.auth.currentUser?.id);

  // ❗️Меняем useMemo -> useEffect, чтобы не сеттить стейт во время рендера
  useEffect(() => {
    setTitle("Информация о компании");
    return () => reset();
    // setTitle/reset приходят из контекста, их достаточно в deps
  }, [setTitle, reset]);

  const { data: company, isFetching } = useGetCompanyQuery(undefined, { skip: !companyId });
  const [updateCompany, { isLoading: saving }] = useUpdateCompanyMutation();
  const [uploadFile] = useUploadFileMutation();
  const [attachFromUrl] = useAttachFromUrlMutation();

  if (!companyId) return null;
  if (!company && isFetching) return null;
  if (!company) return null;

  const load = async () => company;
  const save = async (_id, payload) => {
    const saved = await updateCompany(payload).unwrap();
    return saved;
  };

  return (
    <EntityDetailPage
      id={companyId}
      tabs={TABS}
      tabsNamespace="company.info"
      schemaBuilder={companySchema}
      toForm={toFormCompany}
      toApi={toApiCompany}
      load={load}
      save={save}
      isSaving={saving}
      storageKeyPrefix="company"
      autosave={{ debounceMs: 500 }}
      clearDraftOnUnmount
      leftTop={({ values, onChange }) => (
        <CompanyLogoHeader
          companyId={companyId}
          currentUserId={currentUserId}
          values={values}
          onChange={onChange}
          uploadFile={uploadFile}
          attachFromUrl={attachFromUrl}
        />
      )}
    />
  );
}