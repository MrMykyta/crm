// src/pages/CRM/LeadDetailPage/index.js
import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import EntityDetailPage from "../../../_scaffold/EntityDetailPage";
import {
  counterpartyLeadSchema,
  toFormCounterparty,
  toApiCounterparty,
} from "../../../../schemas/counterparty.schema";
import ContactsEditor from "../../../../components/forms/SmartForm/ContactsEditor";
import { buildContactsPayload } from "../../../../utils/buildContactsPayload";

import {
  useGetCounterpartyQuery,
  useListCounterpartiesQuery,
  useUpdateCounterpartyMutation,
} from "../../../../store/rtk/counterpartyApi";

function Skeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          height: 20,
          width: 240,
          borderRadius: 8,
          background:
            "color-mix(in srgb, var(--card-bg) 88%, transparent)",
        }}
      />
      <div
        style={{
          height: 12,
          width: 320,
          marginTop: 12,
          borderRadius: 8,
          background:
            "color-mix(in srgb, var(--card-bg) 88%, transparent)",
        }}
      />
    </div>
  );
}

// Можно потом кастомизировать табы под лиды (сделки, конверсия и т.п.)
const TABS = [
  { key: "overview",  label: "Описание" },
  { key: "notes",     label: "Заметки" },
  { key: "files",     label: "Файлы" },
  { key: "history",   label: "История изменений" },
  { key: "tasks",     label: "Задания" },
];

// 👇 тот же def query, что и на LeadsPage
const DEFAULT_QUERY = {
  sort: "createdAt",
  dir: "DESC",
  limit: 25,
  type: "lead",
};

export default function LeadDetailPage() {
  const { id } = useParams();

  // 1) вытаскиваем лида из списка лидов, если уже открыт список
  const { data: listData } = useListCounterpartiesQuery(
    DEFAULT_QUERY,
    { refetchOnMountOrArgChange: false }
  );

  const cachedFromList = useMemo(() => {
    const items = listData?.items || [];
    return items.find((x) => String(x.id) === String(id));
  }, [listData, id]);

  // 2) детальный запрос
  const {
    data: detail,
    isFetching: fetchingDetail,
  } = useGetCounterpartyQuery(id, {
    refetchOnMountOrArgChange: true,
  });

  const base = detail || cachedFromList || null;

  const [updateCounterparty, { isLoading: saving }] =
    useUpdateCounterpartyMutation();
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (!base) return;
    const initial = toFormCounterparty(base).contacts;
    setContacts(Array.isArray(initial) ? initial : []);
  }, [base]);

  const onChangeContacts = (list) => setContacts(list);

  const save = useCallback(
    async (entityId, payload) => {
      const saved = await updateCounterparty({
        id: entityId,
        body: payload,
        method: "PUT",
      }).unwrap();

      if (Array.isArray(saved?.contacts)) {
        setContacts(toFormCounterparty(saved).contacts);
      }
      return saved;
    },
    [updateCounterparty]
  );

  if (!base && fetchingDetail) return <Skeleton />;
  if (!base) return <Skeleton />;

  return (
    <EntityDetailPage
      id={id}
      tabs={TABS}
      tabsNamespace="crm.lead.detail"           // 👈 отдельный namespace
      schemaBuilder={counterpartyLeadSchema}
      toForm={(d) => ({ ...toFormCounterparty(d), contacts: undefined })}
      toApi={toApiCounterparty}
      isSaving={saving}
      buildPayload={(basePayload) => ({
        ...basePayload,
        contacts: buildContactsPayload(contacts),
      })}
      load={async () => base}
      save={save}
      storageKeyPrefix="lead"                  // 👈 отдельный storage-ключ
      autosave={{ debounceMs: 500 }}
      saveOnExit={true}
      clearDraftOnUnmount={true}
      payloadDeps={[contacts]}
      leftExtras={
        <ContactsEditor value={contacts} onChange={onChangeContacts} />
      }
    />
  );
}