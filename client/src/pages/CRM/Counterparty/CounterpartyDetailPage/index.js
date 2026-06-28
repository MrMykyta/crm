import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Building2, CheckCircle2, Info, Loader2, RefreshCw, XCircle } from "lucide-react";

import {
  DetailCard,
  DetailLayout,
  DetailSection,
} from "../../../../components/detail";
import AddButton from "../../../../components/buttons/AddButton/AddButton";
import ConfirmDialog from "../../../../components/dialogs/ConfirmDialog";
import EntityNotesSection from "../../../../components/notes/EntityNotesSection";
import DataTable from "../../../../components/data/DataTable";
import HtmlDescriptionSection from "../../../../components/data/HtmlDescriptionSection";
import CounterpartyContactsSection from "../../../../components/contacts/CounterpartyContactsSection";
import { SelectField, TextField } from "../../../../components/ui/fields";
import useAclPermissions from "../../../../hooks/useAclPermissions";
import { getCountryOptions } from "../../../../utils/countries";
import { buildContactsPayload } from "../../../../utils/buildContactsPayload";
import {
  COUNTERPARTY_MAX,
  toApiCounterparty,
  toFormCounterparty,
} from "../../../../schemas/counterparty.schema";
import {
  useCreateCounterpartyMutation,
  useGetCounterpartyQuery,
  useLazyLookupRegistryQuery,
  useRemoveCounterpartyMutation,
  useUpdateCounterpartyMutation,
} from "../../../../store/rtk/counterpartyApi";
import { useListDepartmentsQuery } from "../../../../store/rtk/departmentsApi";
import { useListOffersQuery } from "../../../../store/rtk/offersApi";
import { useListOrdersQuery } from "../../../../store/rtk/ordersApi";
import s from "./CounterpartyDetailPage.module.css";

const CONTRAGENT_TYPES = ["partner", "supplier", "manufacturer"];
const COUNTERPARTY_STATUSES = ["potential", "active", "inactive"];
const REGISTRY_FIELDS = [
  "shortName",
  "fullName",
  "nip",
  "regon",
  "krs",
  "country",
  "city",
  "postalCode",
  "street",
  "isCompany",
];
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];
const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
const TAX_ID_INPUT_MAX = 32;
const PERSON_NAME_MAX = 100;

const EMPTY_VALUES = {
  shortName: "",
  fullName: "",
  firstName: "",
  lastName: "",
  pesel: "",
  birthDate: "",
  nip: "",
  regon: "",
  krs: "",
  bdo: "",
  country: "",
  city: "",
  postalCode: "",
  street: "",
  description: "",
  departmentId: "",
  type: "partner",
  status: "active",
  isCompany: true,
};

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeNip(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function parseTaxIdInput(input) {
  const raw = asText(input);
  const compact = raw.toUpperCase().replace(/[\s.-]/g, "");
  const digitsOnly = compact.match(/^\d{10}$/);
  const prefixed = compact.match(/^([A-Z]{2})(\d{10})$/);
  const validFormat = Boolean(digitsOnly || prefixed);
  const country = prefixed ? prefixed[1] : "PL";
  const localValue = digitsOnly ? compact : (prefixed ? prefixed[2] : "");
  const kind = country === "PL" ? "nip" : "vat";

  return {
    raw,
    normalized: compact,
    country,
    kind,
    value: localValue,
    validFormat,
    error: raw && !validFormat ? "invalid_format" : null,
    hasExplicitCountry: Boolean(prefixed),
    unsupported: validFormat && country !== "PL",
  };
}

function isValidPolishNip(value) {
  const nip = normalizeNip(value);
  if (nip.length !== 10) return false;
  const checksum = NIP_WEIGHTS.reduce((sum, weight, index) => sum + Number(nip[index]) * weight, 0) % 11;
  return checksum !== 10 && checksum === Number(nip[9]);
}

function normalizePesel(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
}

function isValidPesel(value) {
  const pesel = normalizePesel(value);
  if (pesel.length !== 11) return false;
  const sum = PESEL_WEIGHTS.reduce((acc, weight, index) => acc + Number(pesel[index]) * weight, 0);
  const checksum = (10 - (sum % 10)) % 10;
  return checksum === Number(pesel[10]);
}

function deriveBirthDateFromPesel(value) {
  const pesel = normalizePesel(value);
  if (!isValidPesel(pesel)) return "";
  const yearPart = Number(pesel.slice(0, 2));
  const monthCode = Number(pesel.slice(2, 4));
  const day = Number(pesel.slice(4, 6));
  const ranges = [
    { min: 1, max: 12, century: 1900, offset: 0 },
    { min: 21, max: 32, century: 2000, offset: 20 },
    { min: 41, max: 52, century: 2100, offset: 40 },
    { min: 61, max: 72, century: 2200, offset: 60 },
    { min: 81, max: 92, century: 1800, offset: 80 },
  ];
  const range = ranges.find((item) => monthCode >= item.min && monthCode <= item.max);
  if (!range) return "";
  const year = range.century + yearPart;
  const month = monthCode - range.offset;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calculateAge(birthDate, now = new Date()) {
  const text = asText(birthDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  let age = now.getFullYear() - year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getPeselGender(value) {
  const pesel = normalizePesel(value);
  if (!isValidPesel(pesel)) return "";
  return Number(pesel[9]) % 2 === 1 ? "male" : "female";
}

function buildPersonDisplayName(firstName, lastName) {
  return [asText(firstName), asText(lastName)].filter(Boolean).join(" ");
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

function normalizeLocale(language) {
  if (language === "pl") return "pl-PL";
  if (language === "en") return "en-US";
  if (language === "ua" || language === "uk") return "uk-UA";
  return "ru-RU";
}

function formatDateTime(value, locale) {
  const text = asText(value);
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusTone(status) {
  if (status === "active") return "success";
  if (status === "inactive") return "muted";
  return "warning";
}

function Skeleton() {
  return (
    <div className={s.skeleton}>
      <div />
      <span />
      <span />
    </div>
  );
}

function EmptyRelationState({ title, text }) {
  return (
    <div className={s.relationEmpty}>
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
    </div>
  );
}

function CounterpartyOffersTab({ counterpartyId }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const { data, isLoading, isFetching, isError, error } = useListOffersQuery(
    { counterpartyId, limit: 10, page: 1 },
    { skip: !counterpartyId, refetchOnMountOrArgChange: true }
  );
  const rows = data?.items || [];

  const columns = useMemo(() => ([
    {
      key: "number",
      title: t("crm.counterpartyDetail.relations.number"),
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
      title: t("crm.counterpartyDetail.relations.status"),
      width: 140,
      render: (row) => t(`statuses.${asText(row?.status).toLowerCase()}`, row?.status || "—"),
    },
    {
      key: "totalGross",
      title: t("crm.counterpartyDetail.relations.totalGross"),
      width: 170,
      align: "right",
      render: (row) => formatMoney(row?.totalGross, row?.currency || row?.currencyCode || "PLN", locale),
    },
    {
      key: "validUntil",
      title: t("crm.counterpartyDetail.relations.validUntil"),
      width: 180,
      render: (row) => formatDate(row?.validUntil || row?.createdAt, locale),
    },
  ]), [locale, navigate, t]);

  const openCreate = () => navigate(`/main/oms/offers/new?counterpartyId=${counterpartyId}`);

  return (
    <DetailCard
      title={t("crm.counterpartyDetail.tabs.offers")}
      actions={(
        <AddButton onClick={openCreate}>
          {t("crm.counterparties.offers.new")}
        </AddButton>
      )}
    >
      {isError ? (
        <div className={s.errorState}>{error?.data?.message || error?.error || t("crm.counterpartyDetail.messages.loadFailed")}</div>
      ) : null}
      {(isLoading || isFetching) || rows.length > 0 ? (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading || isFetching}
          emptyStateText={t("crm.counterparties.offers.empty")}
        />
      ) : (
        <EmptyRelationState
          title={t("crm.counterpartyDetail.empty.offersTitle")}
          text={t("crm.counterpartyDetail.empty.offersText")}
        />
      )}
    </DetailCard>
  );
}

function CounterpartyOrdersTab({ counterpartyId }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = normalizeLocale(i18n.language);
  const { data, isLoading, isFetching, isError, error } = useListOrdersQuery(
    { counterpartyId, limit: 10, page: 1 },
    { skip: !counterpartyId, refetchOnMountOrArgChange: true }
  );
  const rows = data?.items || [];

  const columns = useMemo(() => ([
    {
      key: "number",
      title: t("crm.counterpartyDetail.relations.number"),
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
      title: t("crm.counterpartyDetail.relations.status"),
      width: 140,
      render: (row) => t(`statuses.${asText(row?.status).toLowerCase()}`, row?.status || "—"),
    },
    {
      key: "totalGross",
      title: t("crm.counterpartyDetail.relations.totalGross"),
      width: 170,
      align: "right",
      render: (row) => formatMoney(row?.totalGross, row?.currencyCode || row?.currency || "PLN", locale),
    },
    {
      key: "placedAt",
      title: t("crm.counterpartyDetail.relations.placedAt"),
      width: 170,
      render: (row) => formatDate(row?.placedAt || row?.createdAt, locale),
    },
  ]), [locale, navigate, t]);

  const openCreate = () => navigate(`/main/oms/orders/new?counterpartyId=${counterpartyId}`);

  return (
    <DetailCard
      title={t("crm.counterpartyDetail.tabs.orders")}
      actions={(
        <AddButton onClick={openCreate}>
          {t("crm.counterparties.orders.new")}
        </AddButton>
      )}
    >
      {isError ? (
        <div className={s.errorState}>{error?.data?.message || error?.error || t("crm.counterpartyDetail.messages.loadFailed")}</div>
      ) : null}
      {(isLoading || isFetching) || rows.length > 0 ? (
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading || isFetching}
          emptyStateText={t("crm.counterparties.orders.empty")}
        />
      ) : (
        <EmptyRelationState
          title={t("crm.counterpartyDetail.empty.ordersTitle")}
          text={t("crm.counterpartyDetail.empty.ordersText")}
        />
      )}
    </DetailCard>
  );
}

function pickName(values) {
  if (values && values.isCompany === false) {
    return buildPersonDisplayName(values.firstName, values.lastName) ||
      asText(values.shortName) ||
      asText(values.fullName);
  }
  return asText(values.shortName) ||
    asText(values.fullName) ||
    buildPersonDisplayName(values.firstName, values.lastName);
}

function normalizeSubtitleToken(value) {
  return asText(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function appendUniqueSubtitlePart(parts, value, seen) {
  const text = asText(value);
  const key = normalizeSubtitleToken(text);
  if (!text || !key || seen.has(key)) return;
  seen.add(key);
  parts.push(text);
}

function normalizeValuesForApi(values) {
  const name = pickName(values);
  const personFullName = [asText(values.firstName), asText(values.lastName)].filter(Boolean).join(" ");
  return {
    ...values,
    shortName: asText(values.shortName) || name,
    fullName: values.isCompany ? (asText(values.fullName) || name) : (personFullName || name),
    type: CONTRAGENT_TYPES.includes(values.type) ? values.type : "partner",
    status: COUNTERPARTY_STATUSES.includes(values.status) ? values.status : "active",
  };
}

function toDetailFormCounterparty(counterparty) {
  const form = toFormCounterparty(counterparty);
  return {
    ...form,
    firstName: counterparty?.firstName ?? "",
    lastName: counterparty?.lastName ?? "",
    pesel: counterparty?.pesel ?? "",
    birthDate: counterparty?.birthDate ?? "",
  };
}

function registryToCounterpartyValues(registry) {
  const taxIds = registry?.taxIds || {};
  const address = registry?.address || {};
  const legalName = asText(registry?.legalName);
  const shortName = asText(registry?.shortName) || legalName;
  return {
    shortName,
    fullName: legalName || shortName,
    nip: normalizeNip(taxIds.nip || registry?.nip),
    regon: asText(taxIds.regon || registry?.regon).replace(/\D/g, ""),
    krs: asText(taxIds.krs || registry?.krs).replace(/\D/g, ""),
    country: asText(address.country || registry?.country || "PL").toUpperCase().slice(0, 2),
    city: asText(address.city),
    postalCode: asText(address.postalCode),
    street: asText(address.street),
    isCompany: registry?.isCompany !== false,
  };
}

function applyRegistryValuesToForm(currentValues, registry) {
  const mapped = registryToCounterpartyValues(registry);
  const nextValues = { ...currentValues };
  REGISTRY_FIELDS.forEach((field) => {
    const next = mapped[field];
    if (typeof next === "boolean" || asText(next)) {
      nextValues[field] = next;
    }
  });
  return { mapped, nextValues };
}

function buildRegistryDiffRows(values, registry, t) {
  const mapped = registryToCounterpartyValues(registry);
  return REGISTRY_FIELDS
    .map((field) => {
      const next = mapped[field];
      const current = values[field];
      const comparableCurrent = typeof current === "boolean" ? current : asText(current);
      const comparableNext = typeof next === "boolean" ? next : asText(next);
      if (comparableNext === "" || comparableCurrent === comparableNext) return null;
      return {
        field,
        label: t(`crm.form.fields.${field}`, field),
        current: typeof current === "boolean" ? (current ? t("common.yes", "Yes") : t("common.no", "No")) : (asText(current) || "—"),
        next: typeof next === "boolean" ? (next ? t("common.yes", "Yes") : t("common.no", "No")) : comparableNext,
      };
    })
    .filter(Boolean);
}

function summarizeRegistryAddress(registry) {
  const address = registry?.address || {};
  return [address.street, address.postalCode, address.city, address.country].map(asText).filter(Boolean).join(", ");
}

function isRegistryTestEnv(registry) {
  return String(registry?.registryEnv || "").toLowerCase() === "test";
}

function isRegistryMock(registry) {
  const source = registry?.source;
  return Boolean(registry?.mock) ||
    (Array.isArray(source) && source.includes("MOCK_GUS")) ||
    asText(source).includes("MOCK_GUS");
}

function formatRegistrySource(source, registryEnv) {
  const base = Array.isArray(source) && source.length
    ? source.filter(Boolean).join(", ")
    : (asText(source) || "GUS");
  return String(registryEnv || "").toLowerCase() === "test" ? `${base} TEST` : base;
}

function formatRegistryCache(cache, t) {
  if (!cache) return "";
  if (cache.stale) return t("crm.counterpartyDetail.registry.cacheStale");
  return cache.hit
    ? t("crm.counterpartyDetail.registry.cacheHit")
    : t("crm.counterpartyDetail.registry.cacheMiss");
}

function buildRegistryVerifiedState(registry, nip) {
  if (!registry?.found) return null;
  const verifiedAt = new Date().toISOString();
  return {
    nip: normalizeNip(nip || registry?.taxIds?.nip || registry?.nip),
    source: registry.source,
    registryEnv: registry.registryEnv,
    fetchedAt: registry.fetchedAt,
    verifiedAt,
    mock: Boolean(registry.mock),
    snapshot: registry,
  };
}

function buildRegistryVerifiedFromCounterparty(counterparty) {
  if (!counterparty?.registryVerified) return null;
  return {
    nip: normalizeNip(counterparty.nip || counterparty.registrySnapshot?.taxIds?.nip),
    source: counterparty.registryVerifiedSource || counterparty.registrySnapshot?.source,
    registryEnv: counterparty.registryVerifiedEnv || counterparty.registrySnapshot?.registryEnv,
    fetchedAt: counterparty.registryVerifiedAt || counterparty.registrySnapshot?.fetchedAt,
    verifiedAt: counterparty.registryVerifiedAt,
    mock: Boolean(counterparty.registryVerifiedMock || counterparty.registrySnapshot?.mock),
    snapshot: counterparty.registrySnapshot || null,
  };
}

function registryValuesMatchForm(values, verified) {
  if (!verified?.snapshot) return Boolean(verified);
  const mapped = registryToCounterpartyValues(verified.snapshot);
  return REGISTRY_FIELDS.every((field) => {
    const next = mapped[field];
    if (typeof next !== "boolean" && !asText(next)) return true;
    if (field === "isCompany") return Boolean(values[field]) === Boolean(next);
    return asText(values[field]) === asText(next);
  });
}

function buildRegistryVerificationPayload(verified) {
  if (!verified?.snapshot) return undefined;
  return {
    verified: true,
    verifiedAt: verified.verifiedAt || new Date().toISOString(),
    source: verified.source,
    registryEnv: verified.registryEnv,
    mock: Boolean(verified.mock),
    snapshot: verified.snapshot,
  };
}

function RegistryVerifiedBadge({ verified, locale, onRefresh, refreshing, t }) {
  if (!verified) return null;
  const source = formatRegistrySource(verified.source, verified.registryEnv);
  const sandbox = isRegistryTestEnv(verified);
  const mock = isRegistryMock(verified);
  return (
    <div className={s.registryVerified}>
      <div className={s.registryVerifiedText}>
        <span><CheckCircle2 size={14} aria-hidden="true" />{t("crm.counterpartyDetail.registry.verifiedSource", { source })}</span>
        <small>{t("crm.counterpartyDetail.registry.lastChecked", { date: formatDateTime(verified.fetchedAt, locale) })}</small>
        {mock ? <small className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.mockHint")}</small> : null}
        {!mock && sandbox ? <small className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.sandboxHint")}</small> : null}
      </div>
      <button
        type="button"
        className={s.registryIconButton}
        onClick={onRefresh}
        disabled={refreshing}
        title={t("crm.counterpartyDetail.registry.refresh")}
      >
        <RefreshCw size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function RegistryLookupCard({
  state,
  diffRows,
  locale,
  detailsOpen,
  applyLabel,
  applying = false,
  onApply,
  onIgnore,
  onRefresh,
  onToggleDetails,
  t,
}) {
  if (!state || state.status === "idle" || state.hiddenAfterApply) return null;

  if (state.status === "loading") {
    return (
      <div className={`${s.registryCard} ${s.registryCardLoading}`}>
        <Loader2 size={16} aria-hidden="true" className={s.spinIcon} />
        <span>{t("crm.counterpartyDetail.registry.checking")}</span>
      </div>
    );
  }

  if (state.status === "not_found") {
    const source = formatRegistrySource(state.data?.source, state.data?.registryEnv);
    const baseSource = formatRegistrySource(state.data?.source);
    const sandbox = isRegistryTestEnv(state.data);
    const mock = isRegistryMock(state.data);
    const cacheLabel = formatRegistryCache(state.data?.cache, t);
    return (
      <div className={`${s.registryCard} ${s.registryCardMuted}`}>
        <XCircle size={16} aria-hidden="true" />
        <div>
          <div className={s.registryHeader}>
            <strong>{t("crm.counterpartyDetail.registry.notFoundTitle")}</strong>
            <span className={s.registrySource}>{source}</span>
          </div>
          <p>{t("crm.counterpartyDetail.registry.notFoundText")}</p>
          <div className={s.registryMeta}>
            <span>{t("crm.counterpartyDetail.registry.source", { source: baseSource })}</span>
            {state.data?.fetchedAt ? <span>{t("crm.counterpartyDetail.registry.updatedAt", { date: formatDateTime(state.data.fetchedAt, locale) })}</span> : null}
            {cacheLabel ? <span>{cacheLabel}</span> : null}
            {mock ? <span className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.mockHint")}</span> : null}
            {!mock && sandbox ? <span className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.sandboxHint")}</span> : null}
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "unsupported") {
    return (
      <div className={`${s.registryCard} ${s.registryCardWarning}`}>
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>{t("crm.counterpartyDetail.registry.unsupportedTitle", { country: state.country })}</strong>
          <p>{t("crm.counterpartyDetail.registry.unsupportedText")}</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    const code = state.error?.data?.code || state.error?.code;
    const isConfig = code === "CONFIG_MISSING";
    return (
      <div className={`${s.registryCard} ${s.registryCardWarning}`}>
        <AlertTriangle size={16} aria-hidden="true" />
        <div>
          <strong>{isConfig ? t("crm.counterpartyDetail.registry.configMissingTitle") : t("crm.counterpartyDetail.registry.errorTitle")}</strong>
          <p>{isConfig ? t("crm.counterpartyDetail.registry.configMissingText") : t("crm.counterpartyDetail.registry.errorText")}</p>
        </div>
      </div>
    );
  }

  const registry = state.data;
  const source = formatRegistrySource(registry?.source, registry?.registryEnv);
  const baseSource = formatRegistrySource(registry?.source);
  const sandbox = isRegistryTestEnv(registry);
  const mock = isRegistryMock(registry);
  const address = summarizeRegistryAddress(registry);
  const cacheLabel = formatRegistryCache(registry?.cache, t);
  const hasDetails = Boolean(registry?.legalForm || registry?.registrationDate || registry?.vatStatus || (Array.isArray(registry?.pkd) && registry.pkd.length));
  const hasDiff = diffRows.length > 0;

  return (
    <div className={s.registryCard}>
      <div className={s.registryHeader}>
        <span className={s.registryStatus}><CheckCircle2 size={16} aria-hidden="true" />{t("crm.counterpartyDetail.registry.foundTitle")}</span>
        <span className={s.registrySource}>{source}</span>
      </div>
      <div className={s.registryCompany}>
        <strong>{registry?.legalName || registry?.shortName || registry?.taxIds?.nip || "—"}</strong>
        {address ? <span>{address}</span> : null}
      </div>
      <dl className={s.registryFacts}>
        {registry?.taxIds?.nip ? <div><dt>{t("crm.form.fields.nip")}</dt><dd>{registry.taxIds.nip}</dd></div> : null}
        {registry?.taxIds?.regon ? <div><dt>{t("crm.form.fields.regon")}</dt><dd>{registry.taxIds.regon}</dd></div> : null}
        {registry?.taxIds?.krs ? <div><dt>{t("crm.form.fields.krs")}</dt><dd>{registry.taxIds.krs}</dd></div> : null}
      </dl>
      <div className={s.registryMeta}>
        <span>{t("crm.counterpartyDetail.registry.source", { source: baseSource })}</span>
        <span>{t("crm.counterpartyDetail.registry.updatedAt", { date: formatDateTime(registry?.fetchedAt, locale) })}</span>
        {cacheLabel ? <span>{cacheLabel}</span> : null}
        {mock ? <span className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.mockHint")}</span> : null}
        {!mock && sandbox ? <span className={s.registrySandboxHint}>{t("crm.counterpartyDetail.registry.sandboxHint")}</span> : null}
      </div>
      {hasDiff ? (
        <div className={s.registryDiff}>
          <strong>{t("crm.counterpartyDetail.registry.diffTitle")}</strong>
          {diffRows.slice(0, 5).map((row) => (
            <div className={s.registryDiffRow} key={row.field}>
              <span>{row.label}</span>
              <p><em>{row.current}</em><b>→</b><strong>{row.next}</strong></p>
            </div>
          ))}
          {diffRows.length > 5 ? <small>{t("crm.counterpartyDetail.registry.moreDiffs", { count: diffRows.length - 5 })}</small> : null}
        </div>
      ) : null}
      {detailsOpen && hasDetails ? (
        <dl className={s.registryDetails}>
          {registry.legalForm ? <div><dt>{t("crm.counterpartyDetail.registry.legalForm")}</dt><dd>{registry.legalForm}</dd></div> : null}
          {registry.registrationDate ? <div><dt>{t("crm.counterpartyDetail.registry.registrationDate")}</dt><dd>{formatDate(registry.registrationDate, locale)}</dd></div> : null}
          {registry.vatStatus ? <div><dt>{t("crm.counterpartyDetail.registry.vatStatus")}</dt><dd>{registry.vatStatus}</dd></div> : null}
          {Array.isArray(registry.pkd) && registry.pkd.length ? <div><dt>{t("crm.counterpartyDetail.registry.pkd")}</dt><dd>{registry.pkd.join(", ")}</dd></div> : null}
        </dl>
      ) : null}
      <div className={s.registryActions}>
        <button type="button" className={s.registryPrimaryButton} onClick={onApply} disabled={applying}>
          {applying ? t("common.saving") : (applyLabel || (hasDiff ? t("crm.counterpartyDetail.registry.applyChanges") : t("crm.counterpartyDetail.registry.apply")))}
        </button>
        {hasDetails ? (
          <button type="button" className={s.registryGhostButton} onClick={onToggleDetails} disabled={applying}>
            <Info size={14} aria-hidden="true" />{t("crm.counterpartyDetail.registry.details")}
          </button>
        ) : null}
        <button type="button" className={s.registryGhostButton} onClick={onRefresh} disabled={applying}>
          <RefreshCw size={14} aria-hidden="true" />{t("crm.counterpartyDetail.registry.refresh")}
        </button>
        <button type="button" className={s.registryGhostButton} onClick={onIgnore} disabled={applying}>
          {t("crm.counterpartyDetail.registry.ignore")}
        </button>
      </div>
    </div>
  );
}

function validateValues(values, t) {
  const errors = {};
  if (!pickName(values)) {
    errors.name = t("crm.counterpartyDetail.validation.nameRequired");
    errors.shortName = errors.name;
  }

  if (!values.isCompany) {
    if (!asText(values.firstName)) errors.firstName = t("crm.counterpartyDetail.validation.firstNameRequired");
    if (!asText(values.lastName)) errors.lastName = t("crm.counterpartyDetail.validation.lastNameRequired");
    if (!asText(values.shortName)) errors.shortName = t("crm.counterpartyDetail.validation.displayNameRequired");
    if (asText(values.pesel) && !isValidPesel(values.pesel)) errors.pesel = t("crm.counterpartyDetail.validation.invalidPesel");
  }

  Object.entries(COUNTERPARTY_MAX).forEach(([key, max]) => {
    if (values[key] !== undefined && values[key] !== null && String(values[key]).length > max) {
      errors[key] = t("crm.form.errors.max", { max });
    }
  });
  if (String(values.firstName || "").length > PERSON_NAME_MAX) errors.firstName = t("crm.form.errors.max", { max: PERSON_NAME_MAX });
  if (String(values.lastName || "").length > PERSON_NAME_MAX) errors.lastName = t("crm.form.errors.max", { max: PERSON_NAME_MAX });

  if (values.isCompany && values.nip) {
    if (!/^\d+$/.test(values.nip)) errors.nip = t("crm.form.errors.digitsOnly");
    else if (values.nip.length !== 10) errors.nip = t("crm.form.errors.nipLen");
    else if (String(values.country || "").toUpperCase() === "PL" && !isValidPolishNip(values.nip)) errors.nip = t("crm.form.errors.nipChecksum");
  }
  if (values.regon && !/^\d+$/.test(values.regon)) errors.regon = t("crm.form.errors.digitsOnly");
  if (values.krs && !/^\d+$/.test(values.krs)) errors.krs = t("crm.form.errors.digitsOnly");
  if (!values.isCompany && values.pesel && !/^\d+$/.test(values.pesel)) errors.pesel = t("crm.counterpartyDetail.validation.invalidPesel");
  if (values.country && !/^[A-Za-z]{2}$/.test(values.country)) errors.country = t("crm.form.errors.countryIso");

  return errors;
}

function getTaxIdValidationError(parsed, t) {
  if (!asText(parsed?.raw)) return undefined;
  if (!parsed.validFormat) return t("crm.form.errors.taxIdFormat");
  if (parsed.country === "PL" && !isValidPolishNip(parsed.value)) return t("crm.form.errors.nipChecksum");
  return undefined;
}

export default function CounterpartyDetailPage({ createMode = false, entityType = "counterparty" }) {
  const { id } = useParams();
  const isCreateMode = createMode || id === "new" || !id;
  const isClientMode = entityType === "client";
  const isLeadMode = entityType === "lead";
  const listRoute = isClientMode ? "/main/clients" : isLeadMode ? "/main/leads" : "/main/counterparties";
  const detailRoute = isClientMode ? "/main/clients" : isLeadMode ? "/main/leads" : "/main/counterparties";
  const fixedType = isClientMode ? "client" : isLeadMode ? "lead" : null;
  const createDefaults = useMemo(() => ({
    ...EMPTY_VALUES,
    type: fixedType || EMPTY_VALUES.type,
    status: isLeadMode ? "potential" : EMPTY_VALUES.status,
  }), [fixedType, isLeadMode]);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedTab = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("tab") || "";
  }, [location.search]);
  const { can } = useAclPermissions();
  const locale = normalizeLocale(i18n.language);
  const canUpdateCounterparty = can("counterparty:update");
  const canCreateCounterparty = can("counterparty:create");
  const canDeleteCounterparty = can("counterparty:delete");
  const canReadDepartments = can("department:read");
  const editable = isCreateMode ? canCreateCounterparty : canUpdateCounterparty;

  const [values, setValues] = useState(EMPTY_VALUES);
  const [contacts, setContacts] = useState([]);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [registryState, setRegistryState] = useState({ status: "idle" });
  const [registryDetailsOpen, setRegistryDetailsOpen] = useState(false);
  const [registryVerified, setRegistryVerified] = useState(null);
  const [registryApplyStatus, setRegistryApplyStatus] = useState("idle");
  const [registryApplyMessage, setRegistryApplyMessage] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [birthDateDerivedFromPesel, setBirthDateDerivedFromPesel] = useState(false);
  const [taxIdInput, setTaxIdInput] = useState("");
  const registryLookupSeq = useRef(0);
  const registryVerifiedRef = useRef(null);
  const loadedCounterpartyKeyRef = useRef("");

  const { data: departmentsData } = useListDepartmentsQuery(
    { includeArchived: true },
    { skip: !canReadDepartments }
  );

  useEffect(() => {
    if (requestedTab) setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleActiveTabChange = useCallback((key) => {
    setActiveTab(key);
  }, []);
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
  const countryOptions = useMemo(
    () => getCountryOptions(i18n.language).map((country) => ({
      value: country.code,
      label: country.label,
    })),
    [i18n.language]
  );

  const { data: detail, isFetching: fetchingDetail } = useGetCounterpartyQuery(id, {
    skip: isCreateMode || !id,
    refetchOnMountOrArgChange: true,
  });
  const [createCounterparty, { isLoading: creating }] = useCreateCounterpartyMutation();
  const [updateCounterparty, { isLoading: updating }] = useUpdateCounterpartyMutation();
  const [removeCounterparty, { isLoading: deleting }] = useRemoveCounterpartyMutation();
  const [lookupRegistry] = useLazyLookupRegistryQuery();
  const saving = creating || updating;

  useEffect(() => {
    registryVerifiedRef.current = registryVerified;
  }, [registryVerified]);

  useEffect(() => {
    if (isCreateMode) {
      setValues(createDefaults);
      setContacts([]);
      setErrors({});
      setDirty(false);
      setTaxIdInput("");
      setRegistryState({ status: "idle" });
      setRegistryVerified(null);
      setDisplayNameTouched(false);
      setBirthDateDerivedFromPesel(false);
      setRegistryApplyStatus("idle");
      setRegistryApplyMessage("");
      return;
    }
    if (!detail) return;
    const detailKey = String(detail.id || id || "");
    const detailChanged = loadedCounterpartyKeyRef.current !== detailKey;
    loadedCounterpartyKeyRef.current = detailKey;
    const form = toDetailFormCounterparty(detail);
    const normalizedFormNip = normalizeNip(form.nip);
    const routeVerified = location.state?.registryVerified;
    const persistedVerified = buildRegistryVerifiedFromCounterparty(detail);
    const preservedVerified = routeVerified || persistedVerified || registryVerifiedRef.current;
    const nextVerified = form.isCompany && preservedVerified?.nip === normalizedFormNip ? preservedVerified : null;
    setValues({ ...EMPTY_VALUES, ...form, type: fixedType || form.type, contacts: undefined });
    setContacts(Array.isArray(form.contacts) ? form.contacts : []);
    setErrors({});
    setDirty(false);
    setTaxIdInput(form.nip || "");
    setDisplayNameTouched(false);
    setBirthDateDerivedFromPesel(false);
    setRegistryState(nextVerified
      ? { status: "idle", nip: nextVerified.nip, hiddenAfterApply: true }
      : { status: "idle" }
    );
    setRegistryVerified(nextVerified);
    if (detailChanged) {
      setRegistryApplyStatus("idle");
      setRegistryApplyMessage("");
    }
  }, [createDefaults, detail, fixedType, id, isCreateMode, location.state]);

  const setField = useCallback((field, value) => {
    setValues((current) => {
      let nextValue = value;
      if (field === "country") nextValue = String(value || "").toUpperCase().slice(0, COUNTERPARTY_MAX.country);
      if (typeof nextValue === "string" && COUNTERPARTY_MAX[field]) {
        nextValue = nextValue.slice(0, COUNTERPARTY_MAX[field]);
      }
      return { ...current, [field]: nextValue };
    });
    setErrors((current) => ({ ...current, [field]: undefined, name: undefined }));
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setDirty(true);
  }, []);

  const setPersonNameField = useCallback((field, value) => {
    setValues((current) => {
      const nextValue = String(value || "").slice(0, PERSON_NAME_MAX);
      const nextValues = { ...current, [field]: nextValue };
      if (!displayNameTouched) {
        nextValues.shortName = buildPersonDisplayName(nextValues.firstName, nextValues.lastName).slice(0, COUNTERPARTY_MAX.shortName);
      }
      return nextValues;
    });
    setErrors((current) => ({ ...current, [field]: undefined, shortName: undefined, name: undefined }));
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setDirty(true);
  }, [displayNameTouched]);

  const setDisplayNameField = useCallback((value) => {
    setDisplayNameTouched(true);
    setField("shortName", value);
  }, [setField]);

  const setPeselField = useCallback((value) => {
    setValues((current) => ({ ...current, pesel: normalizePesel(value) }));
    setErrors((current) => ({ ...current, pesel: undefined }));
    setDirty(true);
  }, []);

  const setBirthDateField = useCallback((value) => {
    setBirthDateDerivedFromPesel(false);
    setField("birthDate", value);
  }, [setField]);

  const handleSubjectChange = useCallback((subject) => {
    const isCompany = subject !== "person";
    setValues((current) => ({
      ...current,
      isCompany,
      ...(isCompany ? { pesel: "", birthDate: "" } : { fullName: "", nip: "", regon: "", krs: "" }),
    }));
    setDisplayNameTouched(false);
    setBirthDateDerivedFromPesel(false);
    setErrors((current) => ({
      ...current,
      isCompany: undefined,
      firstName: undefined,
      lastName: undefined,
      pesel: undefined,
      birthDate: undefined,
      shortName: undefined,
      nip: undefined,
      regon: undefined,
      krs: undefined,
    }));
    setRegistryDetailsOpen(false);
    setRegistryVerified(null);
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setRegistryState({ status: "idle" });
    if (!isCompany) {
      setTaxIdInput("");
    }
    setDirty(true);
  }, []);

  useEffect(() => {
    if (values.isCompany) return;
    const derivedBirthDate = deriveBirthDateFromPesel(values.pesel);
    if (!derivedBirthDate) return;
    if (asText(values.birthDate) && !birthDateDerivedFromPesel) return;
    if (values.birthDate === derivedBirthDate) {
      if (!birthDateDerivedFromPesel) setBirthDateDerivedFromPesel(true);
      return;
    }
    setValues((current) => {
      if (current.isCompany || current.pesel !== values.pesel) return current;
      return { ...current, birthDate: derivedBirthDate };
    });
    setBirthDateDerivedFromPesel(true);
    setErrors((current) => ({ ...current, birthDate: undefined }));
    setDirty(true);
  }, [birthDateDerivedFromPesel, values.birthDate, values.isCompany, values.pesel]);

  const applyPeselBirthDateSuggestion = useCallback(() => {
    const derivedBirthDate = deriveBirthDateFromPesel(values.pesel);
    if (!derivedBirthDate) return;
    setValues((current) => ({ ...current, birthDate: derivedBirthDate }));
    setBirthDateDerivedFromPesel(true);
    setErrors((current) => ({ ...current, birthDate: undefined }));
    setDirty(true);
  }, [values.pesel]);

  const buildPayloadForValues = useCallback((nextValues, nextVerified = registryVerified) => {
    const normalized = normalizeValuesForApi(nextValues);
    const payload = {
      ...toApiCounterparty(normalized),
      ...(fixedType ? { type: fixedType } : null),
      contacts: buildContactsPayload(contacts),
      firstName: nextValues.isCompany ? null : (asText(nextValues.firstName) || null),
      lastName: nextValues.isCompany ? null : (asText(nextValues.lastName) || null),
      pesel: nextValues.isCompany ? null : (normalizePesel(nextValues.pesel) || null),
      birthDate: nextValues.isCompany ? null : (asText(nextValues.birthDate) || null),
    };
    if (!nextValues.isCompany) {
      payload.nip = null;
      payload.regon = null;
      payload.krs = null;
    }
    if (nextValues.isCompany && nextVerified && registryValuesMatchForm(nextValues, nextVerified)) {
      const registryVerification = buildRegistryVerificationPayload(nextVerified);
      if (registryVerification) payload.registryVerification = registryVerification;
    }
    return payload;
  }, [contacts, fixedType, registryVerified]);

  const buildPayload = useCallback(
    () => buildPayloadForValues(values, registryVerified),
    [buildPayloadForValues, registryVerified, values]
  );

  const taxIdParse = useMemo(() => parseTaxIdInput(taxIdInput), [taxIdInput]);
  const normalizedNip = normalizeNip(values.nip);
  const taxIdChecksumError = Boolean(asText(taxIdInput)) &&
    taxIdParse.validFormat &&
    taxIdParse.country === "PL" &&
    !isValidPolishNip(taxIdParse.value);
  const taxIdChecksumHint = t("crm.form.hints.nipChecksumLocal");
  const taxIdHelperText = registryState.status === "loading"
    ? t("crm.counterpartyDetail.registry.checking")
    : taxIdChecksumError
      ? taxIdChecksumHint
      : t("crm.form.hints.taxIdFormat");
  // Registry lookup is intentionally gated: strict format -> PL checksum -> GUS request.
  const registryEligible = editable &&
    Boolean(values.isCompany) &&
    String(values.country || "").toUpperCase() === "PL" &&
    taxIdParse.validFormat &&
    !taxIdParse.unsupported &&
    isValidPolishNip(normalizedNip);

  const taxIdError = useMemo(() => {
    if (errors.nip) return errors.nip;
    return getTaxIdValidationError(taxIdParse, t);
  }, [errors.nip, t, taxIdParse]);

  const handleTaxIdChange = useCallback((input) => {
    const nextInput = String(input || "").slice(0, TAX_ID_INPUT_MAX);
    const parsed = parseTaxIdInput(nextInput);
    setTaxIdInput(nextInput);
    setValues((current) => {
      const nextValues = {
        ...current,
        nip: parsed.value,
      };
      const currentCountry = String(current.country || "").toUpperCase();
      if (parsed.validFormat && parsed.hasExplicitCountry) {
        nextValues.country = parsed.country.slice(0, COUNTERPARTY_MAX.country);
      } else if (parsed.validFormat && parsed.country === "PL" && isValidPolishNip(parsed.value) && (!currentCountry || currentCountry === "PL")) {
        nextValues.country = "PL";
      }
      return nextValues;
    });
    setErrors((current) => ({ ...current, nip: undefined, country: undefined }));
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setDirty(true);
  }, []);

  const runRegistryLookup = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!registryEligible) return null;
    const seq = registryLookupSeq.current + 1;
    registryLookupSeq.current = seq;
    setRegistryDetailsOpen(false);
    setRegistryState({ status: "loading", nip: normalizedNip });
    try {
      const data = await lookupRegistry({
        country: "PL",
        kind: "nip",
        value: normalizedNip,
        forceRefresh,
      }).unwrap();
      if (registryLookupSeq.current !== seq) return data;
      setRegistryState({
        status: data?.found ? "found" : "not_found",
        data,
        nip: normalizedNip,
        hiddenAfterApply: false,
      });
      return data;
    } catch (error) {
      if (registryLookupSeq.current !== seq) return null;
      setRegistryState({ status: "error", error, nip: normalizedNip });
      return null;
    }
  }, [lookupRegistry, normalizedNip, registryEligible]);

  useEffect(() => {
    if (
      registryVerified &&
      (registryVerified.nip !== normalizedNip ||
        !values.isCompany ||
        String(values.country || "").toUpperCase() !== "PL" ||
        taxIdParse.unsupported ||
        !registryValuesMatchForm(values, registryVerified))
    ) {
      setRegistryVerified(null);
      setRegistryState((current) => (
        current.hiddenAfterApply && current.nip === normalizedNip
          ? { status: "idle", nip: normalizedNip, hiddenAfterApply: false }
          : current
      ));
    }
  }, [normalizedNip, registryVerified, taxIdParse.unsupported, values]);

  useEffect(() => {
    if (editable && values.isCompany && taxIdParse.validFormat && taxIdParse.unsupported && asText(taxIdInput)) {
      if (registryState.status !== "unsupported" || registryState.country !== taxIdParse.country || registryState.nip !== taxIdParse.value) {
        setRegistryState({
          status: "unsupported",
          country: taxIdParse.country,
          kind: taxIdParse.kind,
          nip: taxIdParse.value,
        });
      }
      return undefined;
    }
    if (!registryEligible) {
      if (registryState.status !== "idle") {
        setRegistryState({ status: "idle" });
      }
      return undefined;
    }
    if (registryState.hiddenAfterApply && registryState.nip === normalizedNip) {
      return undefined;
    }
    if (
      registryState.nip === normalizedNip &&
      ["loading", "found", "not_found", "error"].includes(registryState.status)
    ) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      runRegistryLookup();
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [editable, normalizedNip, registryEligible, registryState.country, registryState.hiddenAfterApply, registryState.nip, registryState.status, runRegistryLookup, taxIdInput, taxIdParse.country, taxIdParse.kind, taxIdParse.unsupported, taxIdParse.validFormat, taxIdParse.value, values.isCompany]);

  const registryDiffRows = useMemo(
    () => (registryState.data?.found ? buildRegistryDiffRows(values, registryState.data, t) : []),
    [registryState.data, t, values]
  );

  const handleApplyRegistry = useCallback(async () => {
    if (!registryState.data?.found) return;
    const { mapped, nextValues } = applyRegistryValuesToForm(values, registryState.data);
    const nextNip = normalizeNip(mapped.nip || nextValues.nip);
    const verified = buildRegistryVerifiedState(registryState.data, nextNip);
    setValues(nextValues);
    setTaxIdInput(nextNip);
    setRegistryVerified(verified);
    setSaveError("");
    setRegistryApplyMessage("");

    if (isCreateMode) {
      setDirty(true);
      setRegistryApplyStatus("idle");
      setRegistryState({ status: "idle", nip: verified?.nip || nextNip, hiddenAfterApply: true });
      return;
    }

    if (!editable) {
      setDirty(true);
      return;
    }

    const nextErrors = validateValues(nextValues, t);
    const nextTaxIdError = nextValues.isCompany ? getTaxIdValidationError(parseTaxIdInput(nextNip), t) : undefined;
    if (nextTaxIdError) nextErrors.nip = nextTaxIdError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setDirty(true);
      setRegistryApplyStatus("error");
      setRegistryApplyMessage(t("crm.counterpartyDetail.messages.saveFailed"));
      return;
    }

    setRegistryApplyStatus("saving");
    try {
      const payload = buildPayloadForValues(nextValues, verified);
      const saved = await updateCounterparty({ id, body: payload, method: "PUT" }).unwrap();
      const form = toDetailFormCounterparty(saved);
      const persistedVerified = buildRegistryVerifiedFromCounterparty(saved) || verified;
      setValues({ ...EMPTY_VALUES, ...form, type: fixedType || form.type, contacts: undefined });
      setContacts(Array.isArray(form.contacts) ? form.contacts : []);
      setTaxIdInput(form.nip || nextNip);
      setRegistryVerified(persistedVerified);
      setRegistryState({ status: "idle", nip: persistedVerified?.nip || nextNip, hiddenAfterApply: true });
      setDirty(false);
      setSaveError("");
      setRegistryApplyStatus("success");
      setRegistryApplyMessage(t("crm.counterpartyDetail.registry.applySaved"));
    } catch (error) {
      const message = error?.data?.message || error?.message || t("crm.counterpartyDetail.messages.saveFailed");
      setSaveError(message);
      setDirty(true);
      setRegistryApplyStatus("error");
      setRegistryApplyMessage(message);
    }
  }, [buildPayloadForValues, editable, fixedType, id, isCreateMode, registryState.data, t, updateCounterparty, values]);

  const handleIgnoreRegistry = useCallback(() => {
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setRegistryState((current) => ({ status: "idle", nip: current.nip, hiddenAfterApply: true }));
  }, []);

  const handleRefreshRegistry = useCallback(() => {
    setRegistryApplyStatus("idle");
    setRegistryApplyMessage("");
    setRegistryState((current) => ({ ...current, hiddenAfterApply: false }));
    runRegistryLookup({ forceRefresh: true });
  }, [runRegistryLookup]);

  const handleSave = useCallback(async () => {
    if (!editable) return null;
    const nextErrors = validateValues(values, t);
    const nextTaxIdError = values.isCompany ? getTaxIdValidationError(taxIdParse, t) : undefined;
    if (nextTaxIdError) nextErrors.nip = nextTaxIdError;
    setErrors(nextErrors);
    setSaveError("");
    if (Object.keys(nextErrors).length) return null;

    const payload = buildPayload();
    try {
      if (isCreateMode) {
        const created = await createCounterparty(payload).unwrap();
        const createdId = created?.id;
        if (createdId) {
          navigate(`${detailRoute}/${createdId}`, {
            replace: true,
            state: registryVerified ? { registryVerified } : undefined,
          });
        } else {
          navigate(listRoute, { replace: true });
        }
        return created;
      }

      const saved = await updateCounterparty({ id, body: payload, method: "PUT" }).unwrap();
      if (Array.isArray(saved?.contacts)) {
        setContacts(toDetailFormCounterparty(saved).contacts);
      }
      setDirty(false);
      return saved;
    } catch (error) {
      const message = error?.data?.message || error?.message || t("crm.counterpartyDetail.messages.saveFailed");
      setSaveError(message);
      return null;
    }
  }, [buildPayload, createCounterparty, detailRoute, editable, id, isCreateMode, listRoute, navigate, registryVerified, t, taxIdParse, updateCounterparty, values]);

  const handleSaveDescription = useCallback(async (nextHtml) => {
    setField("description", nextHtml);
    if (isCreateMode) return nextHtml;
    const nextValues = { ...values, description: nextHtml };
    const payload = buildPayloadForValues(nextValues, registryVerified);
    const saved = await updateCounterparty({ id, body: payload, method: "PUT" }).unwrap();
    setDirty(false);
    return saved?.description ?? nextHtml ?? "";
  }, [buildPayloadForValues, id, isCreateMode, registryVerified, setField, updateCounterparty, values]);

  const title = isCreateMode
    ? (isLeadMode
      ? t("crm.leadDetail.create.title", "Новый лид")
      : isClientMode
      ? t("crm.clientDetail.create.title", "Новый клиент")
      : t("crm.counterpartyDetail.create.title"))
    : pickName(values) || t("crm.counterpartyDetail.untitled");
  const statusLabel = t(`crm.enums.status.${values.status}`, values.status || "—");
  const typeLabel = values.type ? t(`crm.enums.type.${values.type}`, values.type) : "";
  const subjectLabel = values.isCompany
    ? t("crm.form.subject.company")
    : t("crm.form.subject.person");
  const subtitle = isCreateMode
    ? (isLeadMode
      ? t("crm.leadDetail.create.subtitle", "Заполните данные лида и создайте карточку.")
      : isClientMode
      ? t("crm.clientDetail.create.subtitle", "Заполните данные клиента и создайте карточку.")
      : t("crm.counterpartyDetail.create.subtitle"))
    : (() => {
      const parts = [];
      const seen = new Set([normalizeSubtitleToken(title)]);
      if (values.isCompany) {
        appendUniqueSubtitlePart(parts, values.fullName, seen);
        appendUniqueSubtitlePart(parts, values.nip ? `NIP ${values.nip}` : "", seen);
      } else {
        appendUniqueSubtitlePart(parts, subjectLabel, seen);
      }
      appendUniqueSubtitlePart(parts, typeLabel, seen);
      appendUniqueSubtitlePart(parts, statusLabel, seen);
      return parts.join(" · ");
    })();
  const counterpartyName = pickName(values);
  const registrySystemInfo = values.isCompany ? (registryVerified || registryState.data || null) : null;
  const registrySystemSource = registrySystemInfo
    ? formatRegistrySource(registrySystemInfo.source, registrySystemInfo.registryEnv)
    : "";
  const showRegistryVerified = Boolean(values.isCompany && registryVerified) && !["found", "loading"].includes(registryState.status);
  const registryApplying = registryApplyStatus === "saving";
  const peselBirthDate = !values.isCompany ? deriveBirthDateFromPesel(values.pesel) : "";
  const normalizedPesel = normalizePesel(values.pesel);
  const hasPesel = Boolean(normalizedPesel);
  const peselIsComplete = normalizedPesel.length === 11;
  const peselIsValid = Boolean(!values.isCompany && peselIsComplete && isValidPesel(normalizedPesel));
  const peselInlineError = !values.isCompany && peselIsComplete && !peselIsValid
    ? t("crm.counterpartyDetail.validation.invalidPesel")
    : errors.pesel;
  const peselGender = peselIsValid ? getPeselGender(normalizedPesel) : "";
  const personAge = !values.isCompany ? calculateAge(values.birthDate) : null;
  const showPersonIdentitySummary = !values.isCompany &&
    (!hasPesel || peselIsValid) &&
    (peselIsValid || personAge !== null || Boolean(values.birthDate));
  const showPeselBirthDateSuggestion = Boolean(
    peselBirthDate &&
    values.birthDate &&
    values.birthDate !== peselBirthDate &&
    !birthDateDerivedFromPesel
  );

  const typeOptions = useMemo(
    () => (fixedType ? [fixedType] : CONTRAGENT_TYPES).map((type) => ({ value: type, label: t(`crm.enums.type.${type}`) })),
    [fixedType, t]
  );
  const statusOptions = useMemo(
    () => COUNTERPARTY_STATUSES.map((status) => ({ value: status, label: t(`crm.enums.status.${status}`) })),
    [t]
  );
  const subjectOptions = useMemo(
    () => [
      { value: "company", label: t("crm.form.subject.company") },
      { value: "person", label: t("crm.form.subject.person") },
    ],
    [t]
  );

  const sidebar = (
    <div className={s.sidebarStack}>
      <DetailSection title={t("crm.counterpartyDetail.sections.identity")}>
        <div className={s.formStack}>
          <SelectField
            id="counterparty-subject"
            label={t("crm.form.fields.subject")}
            value={values.isCompany ? "company" : "person"}
            onValueChange={handleSubjectChange}
            options={subjectOptions}
            disabled={!editable}
            searchable={false}
          />
          {values.isCompany ? (
            <>
              <TextField
                id="counterparty-short-name"
                label={t("crm.form.fields.shortName")}
                value={values.shortName}
                onValueChange={(next) => setField("shortName", next)}
                placeholder={t("crm.form.placeholders.shortName")}
                error={errors.shortName}
                maxLength={COUNTERPARTY_MAX.shortName}
                required
                disabled={!editable}
              />
              <TextField
                id="counterparty-full-name"
                label={t("crm.form.fields.fullName")}
                value={values.fullName}
                onValueChange={(next) => setField("fullName", next)}
                placeholder={t("crm.form.placeholders.fullName")}
                error={errors.fullName}
                maxLength={COUNTERPARTY_MAX.fullName}
                disabled={!editable}
              />
            </>
          ) : (
            <>
              <div className={s.twoColumn}>
                <TextField
                  id="counterparty-first-name"
                  label={t("crm.form.fields.firstName")}
                  value={values.firstName}
                  onValueChange={(next) => setPersonNameField("firstName", next)}
                  placeholder={t("crm.form.placeholders.firstName")}
                  error={errors.firstName}
                  maxLength={PERSON_NAME_MAX}
                  required
                  disabled={!editable}
                />
                <TextField
                  id="counterparty-last-name"
                  label={t("crm.form.fields.lastName")}
                  value={values.lastName}
                  onValueChange={(next) => setPersonNameField("lastName", next)}
                  placeholder={t("crm.form.placeholders.lastName")}
                  error={errors.lastName}
                  maxLength={PERSON_NAME_MAX}
                  required
                  disabled={!editable}
                />
              </div>
              <TextField
                id="counterparty-display-name"
                label={t("crm.form.fields.displayName")}
                value={values.shortName}
                onValueChange={setDisplayNameField}
                placeholder={t("crm.form.placeholders.displayName")}
                error={errors.shortName}
                maxLength={COUNTERPARTY_MAX.shortName}
                required
                disabled={!editable}
              />
              <div className={s.twoColumn}>
                <TextField
                  id="counterparty-pesel"
                  label={t("crm.form.fields.pesel")}
                  value={values.pesel}
                  onValueChange={setPeselField}
                  onInput={(event) => setPeselField(event.currentTarget.value)}
                  placeholder={t("crm.form.placeholders.pesel")}
                  error={peselInlineError}
                  maxLength={11}
                  inputMode="numeric"
                  disabled={!editable}
                />
                <TextField
                  id="counterparty-birth-date"
                  type="date"
                  label={t("crm.form.fields.birthDate")}
                  value={values.birthDate}
                  onValueChange={setBirthDateField}
                  onInput={(event) => setBirthDateField(event.currentTarget.value)}
                  error={errors.birthDate}
                  disabled={!editable}
                />
              </div>
              {showPeselBirthDateSuggestion ? (
                <div className={s.peselBirthDateSuggestion}>
                  <span>{t("crm.form.hints.peselBirthDate", { date: peselBirthDate })}</span>
                  <button type="button" onClick={applyPeselBirthDateSuggestion} disabled={!editable}>
                    {t("crm.form.actions.applyBirthDate")}
                  </button>
                </div>
              ) : null}
              {showPersonIdentitySummary ? (
                <div className={s.personIdentitySummary}>
                  {peselIsValid ? (
                    <div className={s.personIdentitySummaryStatus}>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      <span>{t("crm.form.personIntel.peselValid")}</span>
                    </div>
                  ) : null}
                  <dl>
                    {values.birthDate && !peselIsValid ? (
                      <div>
                        <dt>{t("crm.form.fields.birthDate")}: </dt>
                        <dd>{values.birthDate}</dd>
                      </div>
                    ) : null}
                    {personAge !== null ? (
                      <div>
                        <dt>{t("crm.form.personIntel.age")}: </dt>
                        <dd>{personAge}</dd>
                      </div>
                    ) : null}
                    {peselGender ? (
                      <div>
                        <dt>{t("crm.form.personIntel.gender")}: </dt>
                        <dd>{t(`crm.form.personIntel.${peselGender}`)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}
            </>
          )}
          <div className={s.twoColumn}>
            <SelectField
              id="counterparty-type"
              label={t("crm.form.fields.type")}
              value={values.type}
              onValueChange={(next) => setField("type", next)}
              options={typeOptions}
              disabled={!editable || Boolean(fixedType)}
              searchable={false}
            />
            <SelectField
              id="counterparty-status"
              label={t("crm.form.fields.status")}
              value={values.status}
              onValueChange={(next) => setField("status", next)}
              options={statusOptions}
              disabled={!editable}
              searchable={false}
            />
          </div>
          {canReadDepartments ? (
            <SelectField
              id="counterparty-department"
              label={t("crm.form.fields.department")}
              value={values.departmentId || ""}
              onValueChange={(next) => setField("departmentId", next || "")}
              options={departmentOptions}
              placeholder={t("crm.form.placeholders.department")}
              clearable
              searchable
              disabled={!editable}
            />
          ) : null}
        </div>
      </DetailSection>
      {values.isCompany ? (
        <DetailSection
          title={t("crm.counterpartyDetail.sections.registration")}
          subtitle={t("crm.counterpartyDetail.sections.registrationHint")}
        >
          <div className={s.formStack}>
            <div className={s.taxIdFieldStack}>
              <TextField
                id="counterparty-nip"
                label={t("crm.form.fields.nipVat")}
                value={taxIdInput}
                onValueChange={handleTaxIdChange}
                placeholder={t("crm.form.placeholders.nipVat")}
                error={taxIdError}
                helperText={taxIdHelperText}
                maxLength={TAX_ID_INPUT_MAX}
                inputMode="text"
                loading={registryState.status === "loading"}
                disabled={!editable}
              />
              {taxIdChecksumError ? (
                <div className={s.taxIdLocalHint}>{taxIdChecksumHint}</div>
              ) : null}
            </div>
            <RegistryVerifiedBadge
              verified={showRegistryVerified ? registryVerified : null}
              locale={locale}
              onRefresh={handleRefreshRegistry}
              refreshing={registryState.status === "loading"}
              t={t}
            />
            {registryApplyMessage ? (
              <div className={`${s.registryApplyNotice} ${registryApplyStatus === "error" ? s.registryApplyNoticeError : ""}`}>
                {registryApplyStatus === "error" ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                <span>{registryApplyMessage}</span>
              </div>
            ) : null}
            <RegistryLookupCard
              state={registryState}
              diffRows={registryDiffRows}
              locale={locale}
              detailsOpen={registryDetailsOpen}
              applyLabel={isCreateMode ? t("crm.counterpartyDetail.registry.apply") : t("crm.counterpartyDetail.registry.applyGus")}
              applying={registryApplying}
              onApply={handleApplyRegistry}
              onIgnore={handleIgnoreRegistry}
              onRefresh={handleRefreshRegistry}
              onToggleDetails={() => setRegistryDetailsOpen((current) => !current)}
              t={t}
            />
            <div className={s.twoColumn}>
              <TextField
                id="counterparty-regon"
                label={t("crm.form.fields.regon")}
                value={values.regon}
                onValueChange={(next) => setField("regon", next.replace(/[^\d]/g, ""))}
                error={errors.regon}
                maxLength={COUNTERPARTY_MAX.regon}
                inputMode="numeric"
                disabled={!editable}
              />
              <TextField
                id="counterparty-krs"
                label={t("crm.form.fields.krs")}
                value={values.krs}
                onValueChange={(next) => setField("krs", next.replace(/[^\d]/g, ""))}
                error={errors.krs}
                maxLength={COUNTERPARTY_MAX.krs}
                inputMode="numeric"
                disabled={!editable}
              />
            </div>
          </div>
        </DetailSection>
      ) : null}
    </div>
  );

  const descriptionPanel = useMemo(() => (
    <div className={s.tabStack}>
      <HtmlDescriptionSection
        title={t("crm.counterpartyDetail.description.title")}
        value={values.description || ""}
        editable={editable}
        onSave={handleSaveDescription}
        placeholder={t("crm.counterpartyDetail.description.placeholder")}
        emptyText={t("crm.counterpartyDetail.description.emptyText")}
        minHeight={320}
        className={s.descriptionSection}
      />
      {saveError ? <div className={s.errorState}>{saveError}</div> : null}
    </div>
  ), [
    editable,
    handleSaveDescription,
    saveError,
    t,
    values.description,
  ]);

  const addressPanel = useMemo(() => (
    <div className={s.tabStack}>
      <DetailSection
        title={t("crm.counterpartyDetail.sections.address")}
        subtitle={t("crm.counterpartyDetail.sections.addressHint")}
      >
        <div className={s.formStack}>
          <SelectField
            id="counterparty-country"
            label={t("crm.form.fields.country")}
            value={values.country || ""}
            onValueChange={(next) => setField("country", next || "")}
            options={[{ value: "", label: t("common.none") }, ...countryOptions]}
            searchable
            disabled={!editable}
            error={errors.country}
          />
          <div className={s.twoColumn}>
            <TextField
              id="counterparty-postal-code"
              label={t("crm.form.fields.postalCode")}
              value={values.postalCode}
              onValueChange={(next) => setField("postalCode", next)}
              placeholder={t("crm.form.placeholders.postalCode")}
              maxLength={COUNTERPARTY_MAX.postalCode}
              disabled={!editable}
            />
            <TextField
              id="counterparty-city"
              label={t("crm.form.fields.city")}
              value={values.city}
              onValueChange={(next) => setField("city", next)}
              maxLength={COUNTERPARTY_MAX.city}
              disabled={!editable}
            />
          </div>
          <TextField
            id="counterparty-street"
            label={t("crm.form.fields.street")}
            value={values.street}
            onValueChange={(next) => setField("street", next)}
            maxLength={COUNTERPARTY_MAX.street}
            disabled={!editable}
          />
        </div>
      </DetailSection>
    </div>
  ), [
    countryOptions,
    editable,
    errors.country,
    setField,
    t,
    values.city,
    values.country,
    values.postalCode,
    values.street,
  ]);

  const additionalPanel = useMemo(() => (
    <div className={s.tabStack}>
      <DetailSection title={t("crm.counterpartyDetail.sections.meta")}>
        <div className={s.systemStack}>
          <TextField
            id="counterparty-system-bdo"
            label={t("crm.form.fields.bdo")}
            value={values.bdo}
            onValueChange={(next) => setField("bdo", next)}
            error={errors.bdo}
            maxLength={COUNTERPARTY_MAX.bdo}
            disabled={!editable}
          />
          <div className={s.metaRows}>
            <div><span>{t("crm.counterpartyDetail.fields.id")}</span><strong>{id}</strong></div>
            <div><span>{t("crm.counterpartyDetail.fields.createdAt")}</span><strong>{formatDate(detail?.createdAt, locale)}</strong></div>
            <div><span>{t("crm.counterpartyDetail.fields.updatedAt")}</span><strong>{formatDate(detail?.updatedAt, locale)}</strong></div>
            {registrySystemSource ? (
              <div><span>{t("crm.counterpartyDetail.fields.registrySource")}</span><strong>{registrySystemSource}</strong></div>
            ) : null}
            {registrySystemInfo?.fetchedAt ? (
              <div><span>{t("crm.counterpartyDetail.fields.registryCheckedAt")}</span><strong>{formatDateTime(registrySystemInfo.fetchedAt, locale)}</strong></div>
            ) : null}
          </div>
        </div>
      </DetailSection>
    </div>
  ), [detail?.createdAt, detail?.updatedAt, editable, errors.bdo, id, locale, registrySystemInfo?.fetchedAt, registrySystemSource, setField, t, values.bdo]);

  const tabs = useMemo(() => {
    const baseTabs = [
      {
        key: "overview",
        label: t("crm.counterpartyDetail.tabs.overview"),
        children: descriptionPanel,
        keepMounted: true,
      },
      {
        key: "address",
        label: t("crm.counterpartyDetail.tabs.address"),
        children: addressPanel,
        keepMounted: true,
      },
    ];
    if (isCreateMode) return baseTabs;
    return [
      ...baseTabs,
      {
        key: "notes",
        label: t("crm.counterpartyDetail.tabs.notes"),
        children: (
          <div className={`${s.tabStack} ${s.glassPanel} ${s.notesGlass}`}>
            <EntityNotesSection
              ownerType="counterparty"
              ownerId={id}
              title={t("crm.counterpartyDetail.notesTitle")}
              className={s.embeddedSection}
              limit={8}
              hideFiltersWhenEmpty
              hidePagerWhenSingle
              emptyTitle={t("crm.counterpartyDetail.empty.notesTitle")}
              emptyText={t("crm.counterpartyDetail.empty.notesText")}
              addNoteLabel={t("crm.counterpartyDetail.empty.addNote")}
            />
          </div>
        ),
      },
      {
        key: "contacts",
        label: t("crm.counterpartyDetail.tabs.contacts"),
        children: (
          <div className={`${s.tabStack} ${s.glassPanel} ${s.contactsGlass}`}>
            <CounterpartyContactsSection
              counterpartyId={id}
              counterpartyName={counterpartyName}
            />
          </div>
        ),
      },
      {
        key: "offers",
        label: t("crm.counterpartyDetail.tabs.offers"),
        children: <CounterpartyOffersTab counterpartyId={id} />,
      },
      {
        key: "orders",
        label: t("crm.counterpartyDetail.tabs.orders"),
        children: <CounterpartyOrdersTab counterpartyId={id} />,
      },
      {
        key: "additional",
        label: t("crm.counterpartyDetail.tabs.additional"),
        children: additionalPanel,
      },
    ];
  }, [additionalPanel, addressPanel, counterpartyName, descriptionPanel, id, isCreateMode, t]);

  const activeDetailTab = tabs.some((tab) => tab?.key === activeTab && !tab.hidden)
    ? activeTab
    : undefined;

  if (!isCreateMode && fetchingDetail && !detail) return <Skeleton />;
  if (!isCreateMode && !fetchingDetail && !detail) return <Skeleton />;

  return (
    <>
      <DetailLayout
        mode="entity"
        breadcrumbs={[
          { label: t("menu.crm", "CRM") },
          { label: isLeadMode ? t("crm.titles.leads", "Лиды") : isClientMode ? t("crm.titles.clients", "Клиенты") : t("crm.titles.counterparties"), to: listRoute },
          { label: isCreateMode ? t("common.new") : title },
        ]}
        title={title}
        subtitle={subtitle}
        icon={<Building2 size={18} aria-hidden="true" />}
        status={{ value: values.status, label: statusLabel, tone: getStatusTone(values.status) }}
        saveState={{
          saving,
          dirty,
          error: saveError,
          label: saveError || (saving
            ? t("common.saving")
            : dirty
              ? t("common.unsaved")
              : t("common.saved")),
        }}
        actions={[
          {
            key: "back",
            label: isLeadMode
              ? t("crm.leadDetail.actions.back", "К списку лидов")
              : isClientMode
                ? t("crm.clientDetail.actions.back", "К списку клиентов")
                : t("crm.counterpartyDetail.actions.back"),
            onClick: () => navigate(listRoute),
          },
          {
            key: "delete",
            label: deleting ? t("common.loading") : t("common.delete"),
            destructive: true,
            hidden: isCreateMode || !canDeleteCounterparty,
            disabled: deleting,
            onClick: () => setDeleteOpen(true),
          },
        ]}
        primaryAction={{
          key: isCreateMode ? "create" : "save",
          label: isCreateMode ? t("crm.counterpartyDetail.actions.create") : t("common.save"),
          disabled: saving || !editable,
          onClick: handleSave,
        }}
        sidebar={sidebar}
        tabs={tabs}
        activeTab={activeDetailTab}
        onActiveTabChange={handleActiveTabChange}
      />
      <ConfirmDialog
        open={deleteOpen}
        title={t("crm.counterparties.confirmDeleteTitle")}
        text={t("crm.counterparties.confirmDeleteText")}
        okText={t("common.delete")}
        cancelText={t("common.cancel")}
        danger
        loading={deleting}
        onOk={async () => {
          await removeCounterparty(id).unwrap();
          setDeleteOpen(false);
          navigate(listRoute);
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
