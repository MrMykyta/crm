// src/pages/CRM/CounterpartyDetailPage/index.js
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import EntityDetailPage from "../../../_scaffold/EntityDetailPage";
import DetailTabs from "../../../../components/data/DetailTabs";
import EntityNotesSection from "../../../../components/notes/EntityNotesSection";
import DataTable from "../../../../components/data/DataTable";
import AddButton from "../../../../components/buttons/AddButton/AddButton";
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
import { useListOrdersQuery } from "../../../../store/rtk/ordersApi";
import { useListOffersQuery } from "../../../../store/rtk/offersApi";
import s from "./CounterpartyDetailPage.module.css";

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

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value, locale) {
  const text = asText(value);
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatMoney(value, currency = "PLN", locale = "en-US") {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value, 0))} ${asText(currency) || "PLN"}`;
}

function buildTabs(t) {
  return [
    { key: "overview", label: "Описание" },
    { key: "notes", label: "Заметки" },
    { key: "offers", label: t("crm.counterparties.tabs.offers", "Offers") },
    { key: "orders", label: t("crm.counterparties.tabs.orders", "Orders") },
    { key: "files", label: "Файлы" },
    { key: "invoices", label: "Фактуры" },
    { key: "history", label: "История изменений" },
    { key: "reminders", label: "Напоминания" },
    { key: "documents", label: "Документы" },
    { key: "settings", label: "Настройки" },
    { key: "tasks", label: "Задания" },
  ];
}

// 👉 дефолтный запрос ДОЛЖЕН совпадать со списком контрагентов
const DEFAULT_QUERY = {
  sort: "createdAt",
  dir: "DESC",
  limit: 25,
  excludeLeadClient: true, // ← убираем lead и client
};

function CounterpartyOffersTab({ counterpartyId }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === "pl" ? "pl-PL" : i18n.language === "en" ? "en-US" : "ru-RU";

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useListOffersQuery(
    { counterpartyId, limit: 10, page: 1 },
    { skip: !counterpartyId, refetchOnMountOrArgChange: true }
  );

  const rows = data?.items || [];

  const columns = useMemo(() => ([
    {
      key: "number",
      title: "Number",
      width: 220,
      render: (row) => (
        <button
          type="button"
          className={s.linkButton}
          onClick={() => navigate(`/main/oms/offers/${row.id}`)}
        >
          {row?.number || "—"}
        </button>
      ),
    },
    {
      key: "status",
      title: "Status",
      width: 140,
      render: (row) => t(`statuses.${asText(row?.status).toLowerCase()}`, row?.status || "—"),
    },
    {
      key: "totalGross",
      title: "Total gross",
      width: 170,
      align: "right",
      render: (row) => formatMoney(row?.totalGross, row?.currency || row?.currencyCode || "PLN", locale),
    },
    {
      key: "validUntil",
      title: "Valid until / Created",
      width: 180,
      render: (row) => formatDate(row?.validUntil || row?.createdAt, locale),
    },
  ]), [locale, navigate, t]);

  return (
    <section className={s.relatedSection}>
      <div className={s.relatedHeader}>
        <h3 className={s.relatedTitle}>{t("crm.counterparties.tabs.offers", "Offers")}</h3>
        <AddButton onClick={() => navigate(`/main/oms/offers/new?counterpartyId=${counterpartyId}`)}>
          {t("crm.counterparties.offers.new", "Nowa oferta / New offer")}
        </AddButton>
      </div>

      {isError ? (
        <div className={s.errorState}>{error?.data?.message || error?.error || "Failed to load offers"}</div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading || isFetching}
        emptyStateText={t("crm.counterparties.offers.empty", "Brak ofert dla tego kontrahenta")}
      />
    </section>
  );
}

function CounterpartyOrdersTab({ counterpartyId }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === "pl" ? "pl-PL" : i18n.language === "en" ? "en-US" : "ru-RU";

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useListOrdersQuery(
    { counterpartyId, limit: 10, page: 1 },
    { skip: !counterpartyId, refetchOnMountOrArgChange: true }
  );

  const rows = data?.items || [];

  const columns = useMemo(() => ([
    {
      key: "number",
      title: "Number",
      width: 220,
      render: (row) => (
        <button
          type="button"
          className={s.linkButton}
          onClick={() => navigate(`/main/oms/orders/${row.id}`)}
        >
          {row?.number || "—"}
        </button>
      ),
    },
    {
      key: "status",
      title: "Status",
      width: 140,
      render: (row) => t(`statuses.${asText(row?.status).toLowerCase()}`, row?.status || "—"),
    },
    {
      key: "totalGross",
      title: "Total gross",
      width: 170,
      align: "right",
      render: (row) => formatMoney(row?.totalGross, row?.currencyCode || row?.currency || "PLN", locale),
    },
    {
      key: "placedAt",
      title: "Placed / Created",
      width: 170,
      render: (row) => formatDate(row?.placedAt || row?.createdAt, locale),
    },
  ]), [locale, navigate, t]);

  return (
    <section className={s.relatedSection}>
      <div className={s.relatedHeader}>
        <h3 className={s.relatedTitle}>{t("crm.counterparties.tabs.orders", "Orders")}</h3>
        <AddButton onClick={() => navigate(`/main/oms/orders/new?counterpartyId=${counterpartyId}`)}>
          {t("crm.counterparties.orders.new", "Nowe zamówienie / New order")}
        </AddButton>
      </div>

      {isError ? (
        <div className={s.errorState}>{error?.data?.message || error?.error || "Failed to load orders"}</div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading || isFetching}
        emptyStateText={t("crm.counterparties.orders.empty", "Brak zamówień dla tego kontrahenta")}
      />
    </section>
  );
}

// Компонент CounterpartyDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
function CounterpartyDetailTabs({ tab, data, values, onChange }) {
  const counterpartyId = data?.id;

  if (tab === "notes") {
    return (
      <EntityNotesSection
        ownerType="counterparty"
        ownerId={counterpartyId}
        title="Заметки контрагента"
      />
    );
  }

  if (tab === "offers") {
    return <CounterpartyOffersTab counterpartyId={counterpartyId} />;
  }

  if (tab === "orders") {
    return <CounterpartyOrdersTab counterpartyId={counterpartyId} />;
  }

  return <DetailTabs tab={tab} data={data} values={values} onChange={onChange} />;
}

// Компонент CounterpartyDetailPage: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function CounterpartyDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const schemaBuilder = useCallback(
    (i18n) => counterpartyEntitySchema(i18n).filter((field) => field?.name !== "description"),
    []
  );
  const tabs = useMemo(() => buildTabs(t), [t]);

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
      tabs={tabs}
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
