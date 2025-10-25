import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import EntityDetailPage from "../../_scaffold/EntityDetailPage";
import { counterpartySchema, toFormCounterparty, toApiCounterparty } from "../../../schemas/counterparty.schema";
import { getCounterparty, updateCounterparty } from "../../../api/counterparties";
import ContactsEditor from "../../../components/forms/SmartForm/ContactsEditor";
import { buildContactsPayload } from "../../../utils/buildContactsPayload";

const TABS = [
  { key:"overview",   label:"Описание" },
  { key:"notes",      label:"Заметки" },
  { key:"files",      label:"Файлы" },
  { key:"orders",     label:"Заказы" },
  { key:"invoices",   label:"Фактуры" },
  { key:"history",    label:"История изменений" },
  { key:"reminders",  label:"Напоминания" },
];

export default function CounterpartyDetailPage(){
  const { id } = useParams();
  const [base, setBase] = useState(null);
  const [contacts, setContacts] = useState([]);

  useEffect(()=>{ (async()=>{
    const d = await getCounterparty(id);
    setBase(d);
    const initial = toFormCounterparty(d).contacts;
    setContacts(Array.isArray(initial) ? initial : []);
  })().catch(console.error); }, [id]);

  if(!base) return null;

  const onChangeContacts = (list) => setContacts(list);

  // Ответ API может НЕ включать contacts — не затираем локальные, если их нет в ответе
  const save = async (entityId, payload) => {
    const saved = await updateCounterparty(entityId, payload);
    setBase(saved);
    if (Array.isArray(saved?.contacts)) {
      setContacts(toFormCounterparty(saved).contacts);
    }
    return saved;
  };

  return (
    <EntityDetailPage
      id={id}
      tabs={TABS}
      schemaBuilder={counterpartySchema}
      toForm={(d)=>({ ...toFormCounterparty(d), contacts: undefined })}
      toApi={toApiCounterparty}

      // ВСЕГДА добавляем contacts в payload (стабильно собранные)
      buildPayload={(basePayload)=>({
        ...basePayload,
        contacts: buildContactsPayload(contacts),
      })}

      load={async()=>base}
      save={save}
      storageKeyPrefix="counterparty"
      autosave={{ debounceMs: 500 }}
      saveOnExit={true}          // не пишем черновик при закрытии вкладки
      clearDraftOnUnmount={true}  // вычищаем localStorage при выходе с карточки
      payloadDeps={[contacts]}    // автосейв реагирует на любые изменения контактов

      leftExtras={<ContactsEditor value={contacts} onChange={onChangeContacts} />}
    />
  );
}