// src/pages/CRM/CounterpartyDetailPage/index.js
import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import EntityDetailPage from "../../../_scaffold/EntityDetailPage";
import DetailTabs from "../../../../components/data/DetailTabs";
import EntityNotesSection from "../../../../components/notes/EntityNotesSection";
import {
  counterpartyEntitySchema,
  toFormCounterparty,
  toApiCounterparty
} from "../../../../schemas/counterparty.schema";
import ContactsEditor from "../../../../components/forms/SmartForm/ContactsEditor";
import { buildContactsPayload } from "../../../../utils/buildContactsPayload";
import CounterpartyContactsSection from "../../../../components/contacts/CounterpartyContactsSection";

import {
  useGetCounterpartyQuery,
  useListCounterpartiesQuery,
  useUpdateCounterpartyMutation,
} from "../../../../store/rtk/counterpartyApi";

// Компонент Skeleton: отвечает за отображение UI и обработку взаимодействий пользователя.
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

// 👉 дефолтный запрос ДОЛЖЕН совпадать со списком контрагентов
const DEFAULT_QUERY = {
  sort: "createdAt",
  dir: "DESC",
  limit: 25,
  excludeLeadClient: true, // ← убираем lead и client
};

// Компонент CounterpartyDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
function CounterpartyDetailTabs({ tab, data, values, onChange }) {
  if (tab === "notes") {
    return (
      <EntityNotesSection
        ownerType="counterparty"
        ownerId={data?.id}
        title="Заметки контрагента"
      />
    );
  }

  return <DetailTabs tab={tab} data={data} values={values} onChange={onChange} />;
}

// Компонент CounterpartyDetailPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CounterpartyDetailPage() {
  const { id } = useParams();
  const schemaBuilder = useCallback(
    (i18n) => counterpartyEntitySchema(i18n).filter((field) => field?.name !== "description"),
    []
  );

  // 1) пробуем взять сущность из списка контрагентов (без лидов/клиентов)
  const { data: listData } = useListCounterpartiesQuery(
    DEFAULT_QUERY,
    { refetchOnMountOrArgChange: false }
  );

  const cachedFromList = useMemo(() => {
    const items = listData?.items || [];
    return items.find((x) => String(x.id) === String(id));
  }, [listData, id]);

  // 2) детальный запрос всегда сверху
  const {
    data: detail,
    isFetching: fetchingDetail,
  } = useGetCounterpartyQuery(id, {
    refetchOnMountOrArgChange: true,
  });

  // 3) что показываем в UI
  const base = detail || cachedFromList || null;

  const [updateCounterparty, { isLoading: saving }] =
    useUpdateCounterpartyMutation();
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (!base) return;
    const initial = toFormCounterparty(base).contacts;
    setContacts(Array.isArray(initial) ? initial : []);
  }, [base]);

    // onChangeContacts: вспомогательная логика компонента.
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
      tabsNamespace="crm.counterparty.detail"
      schemaBuilder={schemaBuilder}
      toForm={(d) => ({ ...toFormCounterparty(d), contacts: undefined })}
      toApi={toApiCounterparty}
      isSaving={saving}
      buildPayload={(basePayload) => ({
        ...basePayload,
        contacts: buildContactsPayload(contacts),
      })}
      load={async () => base}
      save={save}
      storageKeyPrefix="counterparty"
      autosave={{ debounceMs: 500 }}
      saveOnExit={true}
      clearDraftOnUnmount={true}
      payloadDeps={[contacts]}
      RightTabsComponent={CounterpartyDetailTabs}
      leftExtras={
        <>
          <CounterpartyContactsSection
            counterpartyId={id}
            counterpartyName={base?.shortName || base?.fullName || ''}
          />
          <ContactsEditor value={contacts} onChange={onChangeContacts} />
        </>
      }
    />
  );
}

