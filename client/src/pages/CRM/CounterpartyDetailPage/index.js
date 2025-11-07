// src/pages/CRM/CounterpartyDetailPage/index.js
import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import EntityDetailPage from "../../_scaffold/EntityDetailPage";
import {
  counterpartySchema,
  toFormCounterparty,
  toApiCounterparty
} from "../../../schemas/counterparty.schema";
import ContactsEditor from "../../../components/forms/SmartForm/ContactsEditor";
import { buildContactsPayload } from "../../../utils/buildContactsPayload";

import {
  useGetCounterpartyQuery,
  useUpdateCounterpartyMutation,
} from "../../../store/rtk/counterpartyApi";

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

export default function CounterpartyDetailPage() {
  const { id } = useParams();

  const { data: base, isFetching } = useGetCounterpartyQuery(id);
  const [updateCounterparty, { isLoading: saving }] = useUpdateCounterpartyMutation();

  const [contacts, setContacts] = useState([]);

  // гидрация контактов из base
  useEffect(() => {
    if (!base) return;
    const initial = toFormCounterparty(base).contacts;
    setContacts(Array.isArray(initial) ? initial : []);
  }, [base]);

  const onChangeContacts = (list) => setContacts(list);

  // ⚠️ Хуки — только до любых return!
  const save = useCallback(
    async (entityId, payload) => {
      const saved = await updateCounterparty({
        id: entityId,
        body: payload,
        method: 'PUT',
      }).unwrap();

      if (Array.isArray(saved?.contacts)) {
        setContacts(toFormCounterparty(saved).contacts);
      }
      return saved;
    },
    [updateCounterparty]
  );

  // ранние выходы — после всех хуков
  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <EntityDetailPage
      id={id}
      tabs={TABS}
      tabsNamespace="crm.counterparty.detail"
      schemaBuilder={counterpartySchema}
      toForm={(d) => ({ ...toFormCounterparty(d), contacts: undefined })}
      toApi={toApiCounterparty}
      isSaving={saving}

      // ВСЕГДА добавляем contacts в payload
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

      leftExtras={<ContactsEditor value={contacts} onChange={onChangeContacts} />}
    />
  );
}