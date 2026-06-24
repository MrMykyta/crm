// src/pages/CRM/CounterpartyDetailPage/index.js
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import EntityDetailPage from "../../../_scaffold/EntityDetailPage";
import DetailTabs from "../../../../components/data/DetailTabs";
import EntityNotesSection from "../../../../components/notes/EntityNotesSection";
import DataTable from "../../../../components/data/DataTable";
import AddButton from "../../../../components/buttons/AddButton/AddButton";
import ConfirmDialog from "../../../../components/dialogs/ConfirmDialog";
import useAclPermissions from "../../../../hooks/useAclPermissions";
import HtmlDescriptionSection from "../../../../components/data/HtmlDescriptionSection";
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
  useRemoveCounterpartyMutation,
  useUpdateCounterpartyMutation,
} from "../../../../store/rtk/counterpartyApi";
import { useListDepartmentsQuery } from "../../../../store/rtk/departmentsApi";
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
function CounterpartyDetailTabs({ tab, data, values, onChange, onSaveDescription }) {
  const counterpartyId = data?.id;

  if (tab === "overview") {
    const hasDescriptionField = Object.prototype.hasOwnProperty.call(values || {}, "description");
    const descriptionHtml = hasDescriptionField
      ? String(values?.description ?? "")
      : String(data?.description ?? "");

    return (
      <HtmlDescriptionSection
        title="Описание"
        value={descriptionHtml}
        editable={hasDescriptionField && typeof onSaveDescription === "function"}
        onSave={async (nextHtml) => {
          if (!hasDescriptionField || typeof onSaveDescription !== "function") return nextHtml;
          const finalHtml = await onSaveDescription(nextHtml, values);
          onChange?.("description", finalHtml);
          return finalHtml;
        }}
        placeholder="Опишите сущность: ключевые детали, договоренности, условия…"
        emptyText="Описание пока пустое. Нажмите «Редактировать», чтобы добавить HTML-описание."
        minHeight={340}
      />
    );
  }

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
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canUpdateCounterparty = can("counterparty:update");
  const canDeleteCounterparty = can("counterparty:delete");
  const canReadDepartments = can("department:read");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { data: departmentsData } = useListDepartmentsQuery(
    { includeArchived: true },
    { skip: !canReadDepartments }
  );
  const departments = useMemo(
    () => (Array.isArray(departmentsData) ? departmentsData : []),
    [departmentsData]
  );
  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) => department?.isActive !== false && !department?.deletedAt)
        .map((department) => ({
          value: String(department.id),
          label: department.name || department.code || String(department.id),
        })),
    [departments]
  );
  const schemaBuilder = useCallback(
    (i18n) =>
      counterpartyEntitySchema(i18n, {
        departmentOptions,
        includeDepartmentField: canReadDepartments,
      }).filter((field) => field?.name !== "description"),
    [canReadDepartments, departmentOptions]
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
  const [removeCounterparty, { isLoading: deleting }] = useRemoveCounterpartyMutation();
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

  const saveDescription = useCallback(
    async (nextHtml, currentValues = {}) => {
      const payload = {
        ...toApiCounterparty({
          ...currentValues,
          description: nextHtml,
        }),
        contacts: buildContactsPayload(contacts),
      };
      const saved = await save(id, payload);
      return saved?.description ?? nextHtml ?? "";
    },
    [contacts, id, save]
  );

  if (!base && fetchingDetail) return <Skeleton />;
  if (!base) return <Skeleton />;

  return (
    <>
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
        readOnly={!canUpdateCounterparty}
        clearDraftOnUnmount={true}
        payloadDeps={[contacts]}
        RightTabsComponent={(props) => (
          <CounterpartyDetailTabs
            {...props}
            onSaveDescription={saveDescription}
          />
        )}
        leftTop={canDeleteCounterparty ? (
          <div className={s.detailActions}>
            <button
              type="button"
              className={`${s.detailActionBtn} ${s.detailActionDanger}`}
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
            >
              {deleting ? t("common.loading", "Загрузка...") : t("common.delete", "Удалить")}
            </button>
          </div>
        ) : null}
        leftExtras={
          <>
            <CounterpartyContactsSection
              counterpartyId={id}
              counterpartyName={base?.shortName || base?.fullName || ''}
            />
            {canUpdateCounterparty ? (
              <ContactsEditor value={contacts} onChange={onChangeContacts} />
            ) : null}
          </>
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        title={t("crm.counterparties.confirmDeleteTitle", "Удалить контрагента?")}
        text={t(
          "crm.counterparties.confirmDeleteText",
          "Контрагент будет удалён или архивирован согласно настройкам системы."
        )}
        okText={t("common.delete", "Удалить")}
        cancelText={t("common.cancel", "Отмена")}
        danger
        loading={deleting}
        onOk={async () => {
          await removeCounterparty(id).unwrap();
          setDeleteOpen(false);
          navigate("/main/counterparties");
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
