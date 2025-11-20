// src/pages/CRM/ClientDetailPage/index.js
import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import EntityDetailPage from "../../../_scaffold/EntityDetailPage";
import {
  counterpartyClientSchema,
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

// для клиентов можно взять такой же набор табов, как у контрагентов
const TABS = [
  { key: "overview",  label: "Описание" },
  { key: "notes",     label: "Заметки" },
  { key: "files",     label: "Файлы" },
  { key: "orders",    label: "Заказы" },
  { key: "invoices",  label: "Фактуры" },
  { key: "history",   label: "История изменений" },
  { key: "reminders", label: "Напоминания" },
  { key: "documents", label: "Документы" },
  { key: "settings",  label: "Настройки" },
  { key: "tasks",     label: "Задания" },
];

// такой же дефолтный запрос, как на ClientsPage
const DEFAULT_QUERY = {
  sort: "createdAt",
  dir: "DESC",
  limit: 25,
  type: "client",
};

export default function ClientDetailPage() {
  const { id } = useParams();

  // 1) пробуем взять клиента из списка клиентов (если список уже был открыт)
  const { data: listData } = useListCounterpartiesQuery(
    DEFAULT_QUERY,
    { refetchOnMountOrArgChange: false }
  );

  const cachedFromList = useMemo(() => {
    const items = listData?.items || [];
    return items.find((x) => String(x.id) === String(id));
  }, [listData, id]);

  // 2) детальная загрузка
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
        body: {
          ...payload,
          // на всякий случай ФИКСИРУЕМ тип на клиенте, даже если кто-то пошлёт другое
          type: "client",
        },
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
      tabsNamespace="crm.client.detail"
      schemaBuilder={counterpartyClientSchema}
      toForm={(d) => ({ ...toFormCounterparty(d), contacts: undefined })}
      toApi={toApiCounterparty}
      isSaving={saving}
      buildPayload={(basePayload) => ({
        ...basePayload,
        contacts: buildContactsPayload(contacts),
      })}
      load={async () => base}
      save={save}
      storageKeyPrefix="client"
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