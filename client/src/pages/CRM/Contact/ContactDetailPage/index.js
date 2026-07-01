import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Building2, UserRound } from "lucide-react";

import {
  DetailCard,
  DetailLayout,
  DetailSection,
} from "../../../../components/detail";
import ConfirmDialog from "../../../../components/dialogs/ConfirmDialog";
import {
  AutocompleteField,
  CheckboxField,
  SelectField,
  TextareaField,
  TextField,
} from "../../../../components/ui/fields";
import useAclPermissions from "../../../../hooks/useAclPermissions";
import {
  useCreateContactMutation,
  useDeleteContactMutation,
  useGetContactByIdQuery,
  useSetMainContactMutation,
  useUpdateContactMutation,
} from "../../../../store/rtk/contactsApi";
import { useGetCounterpartyLookupQuery } from "../../../../store/rtk/counterpartyApi";
import ContactPointsSection from "../../../../components/contacts/ContactPointsSection";
import s from "./ContactDetailPage.module.css";

const EMPTY_VALUES = {
  counterpartyId: "",
  counterpartyName: "",
  counterpartyType: "",
  firstName: "",
  middleName: "",
  lastName: "",
  displayName: "",
  jobTitle: "",
  department: "",
  status: "active",
  isPrimary: false,
  email: "",
  phone: "",
  notes: "",
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function formatDate(value, locale) {
  const text = asText(value);
  if (!text) return "—";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale || undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDisplayName(values) {
  const full = [values?.firstName, values?.lastName]
    .map(asText)
    .filter(Boolean)
    .join(" ");
  return full || asText(values?.displayName) || "—";
}

function getCounterpartyName(contact) {
  return (
    contact?.counterparty?.shortName ||
    contact?.counterparty?.fullName ||
    contact?.counterpartyName ||
    ""
  );
}

function getCounterpartyHref(type, id) {
  if (!id) return "";
  if (type === "lead") return `/main/leads/${id}`;
  if (type === "client") return `/main/clients/${id}`;
  return `/main/counterparties/${id}`;
}

function getStateValue(state, key) {
  if (!state || typeof state !== "object") return "";
  const value = state[key];
  return value == null ? "" : String(value);
}

function toFormContact(contact = {}) {
  return {
    ...EMPTY_VALUES,
    counterpartyId: contact?.counterpartyId || contact?.counterparty?.id || "",
    counterpartyName: getCounterpartyName(contact),
    counterpartyType: contact?.counterparty?.type || "",
    firstName: contact?.firstName || "",
    middleName: contact?.middleName || "",
    lastName: contact?.lastName || "",
    displayName: contact?.displayName || "",
    jobTitle: contact?.jobTitle || contact?.position || "",
    department: contact?.department || "",
    status: contact?.status || "active",
    isPrimary: Boolean(contact?.isPrimary ?? contact?.isMain),
    email: contact?.email || "",
    phone: contact?.phone || "",
    notes: contact?.notes || contact?.note || "",
    createdAt: contact?.createdAt || null,
    updatedAt: contact?.updatedAt || null,
  };
}

function trimOrNull(value) {
  const text = asText(value);
  return text || null;
}

function toApiContact(values = {}, { createMode = false } = {}) {
  const firstName = asText(values.firstName);
  const displayName = asText(values.displayName);
  const lastName = asText(values.lastName);

  return {
    counterpartyId: asText(values.counterpartyId),
    firstName: firstName || (createMode ? displayName || lastName : firstName),
    lastName: trimOrNull(values.lastName),
    position: trimOrNull(values.jobTitle),
    department: trimOrNull(values.department),
    email: trimOrNull(values.email),
    phone: trimOrNull(values.phone),
    note: trimOrNull(values.notes),
    isMain: Boolean(values.isPrimary),
  };
}

function getStatusTone(status) {
  return status === "inactive" ? "muted" : "success";
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

export default function ContactDetailPage({ createMode = false }) {
  const { id } = useParams();
  const isCreateMode = createMode || id === "new" || !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { can } = useAclPermissions();

  const [values, setValues] = useState(EMPTY_VALUES);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [counterpartySearchDebounced, setCounterpartySearchDebounced] = useState("");
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);

  const canDeleteContact = can("contact:delete");
  const canUpdateContact = can("contact:update");
  const canCreateContact = can("contact:create");
  const editable = isCreateMode ? canCreateContact : canUpdateContact;

  const {
    data: detail,
    isFetching: fetchingDetail,
    error: detailError,
  } = useGetContactByIdQuery(id, {
    skip: isCreateMode || !id,
    refetchOnMountOrArgChange: true,
  });

  const shouldSkipLookup = asText(counterpartySearchDebounced).length < 1;
  const { data: counterpartyOptions = [], isFetching: counterpartyLoading } =
    useGetCounterpartyLookupQuery(
      { term: counterpartySearchDebounced, limit: 12 },
      { skip: shouldSkipLookup }
    );

  const [createContact, { isLoading: creating }] = useCreateContactMutation();
  const [updateContact, { isLoading: updating }] = useUpdateContactMutation();
  const [deleteContact, { isLoading: deleting }] = useDeleteContactMutation();
  const [setMainContact, { isLoading: settingMain }] = useSetMainContactMutation();
  const saving = creating || updating || settingMain;

  const prefill = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    const state = location.state || {};
    const counterpartyId =
      getStateValue(state, "counterpartyId") ||
      params.get("counterpartyId") ||
      "";
    const counterpartyName =
      getStateValue(state, "counterpartyName") ||
      params.get("counterpartyName") ||
      "";
    const counterpartyType =
      getStateValue(state, "counterpartyType") ||
      params.get("counterpartyType") ||
      "";

    return {
      counterpartyId,
      counterpartyName,
      counterpartyType,
      returnTo: getStateValue(state, "returnTo") || params.get("returnTo") || "",
      returnLabel: getStateValue(state, "returnLabel") || params.get("returnLabel") || "",
    };
  }, [location.search, location.state]);

  const isCounterpartyLocked = isCreateMode && Boolean(prefill.counterpartyId);
  const backTarget = prefill.returnTo || "/main/contacts";

  useEffect(() => {
    const timer = setTimeout(() => {
      setCounterpartySearchDebounced(asText(counterpartySearch));
    }, 320);
    return () => clearTimeout(timer);
  }, [counterpartySearch]);

  useEffect(() => {
    if (isCreateMode) {
      const nextValues = {
        ...EMPTY_VALUES,
        counterpartyId: prefill.counterpartyId,
        counterpartyName: prefill.counterpartyName,
        counterpartyType: prefill.counterpartyType,
      };
      setValues(nextValues);
      setSelectedCounterparty(prefill.counterpartyId ? {
        id: prefill.counterpartyId,
        name: prefill.counterpartyName || prefill.counterpartyId,
        type: prefill.counterpartyType || undefined,
      } : null);
      setCounterpartySearch(prefill.counterpartyName || prefill.counterpartyId || "");
      setDirty(false);
      setSaveError("");
      setErrors({});
      return;
    }

    if (!detail) return;

    const form = toFormContact(detail);
    setValues(form);
    setCounterpartySearch(form.counterpartyName);
    setSelectedCounterparty(form.counterpartyId ? {
      id: form.counterpartyId,
      name: form.counterpartyName || form.counterpartyId,
    } : null);
    setDirty(false);
    setSaveError("");
    setErrors({});
  }, [detail, isCreateMode, prefill.counterpartyId, prefill.counterpartyName, prefill.counterpartyType]);

  const setField = useCallback((key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaveError("");
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  }, []);

  const statusOptions = useMemo(() => [
    { value: "active", label: t("contacts.values.active", "Активный") },
    { value: "inactive", label: t("contacts.values.inactive", "Неактивный") },
  ], [t]);

  const statusLabel = values.status === "inactive"
    ? t("contacts.values.inactive", "Неактивный")
    : t("contacts.values.active", "Активный");

  const generatedDisplayName = useMemo(() => {
    return [values.firstName, values.lastName]
      .map(asText)
      .filter(Boolean)
      .join(" ");
  }, [values.firstName, values.lastName]);

  const title = isCreateMode
    ? t("contacts.detail.newTitle", "Новый контакт")
    : getDisplayName(values);

  const counterpartyLabel = values.counterpartyName || values.counterpartyId || "—";
  const subtitle = [
    counterpartyLabel !== "—" ? counterpartyLabel : null,
    values.jobTitle || values.department
      ? [values.jobTitle, values.department].filter(Boolean).join(" / ")
      : null,
    statusLabel,
  ].filter(Boolean).join(" · ");

  const counterpartyHref = getCounterpartyHref(values.counterpartyType, values.counterpartyId);

  const validate = useCallback(() => {
    const nextErrors = {};
    const hasName = Boolean(
      asText(values.firstName) ||
      asText(values.lastName) ||
      asText(values.displayName)
    );

    if (!asText(values.counterpartyId)) {
      nextErrors.counterpartyId = t(
        "contacts.validation.counterpartyRequired",
        "Выберите контрагента"
      );
    }

    if (!hasName) {
      nextErrors.name = t(
        "contacts.validation.nameRequired",
        "Введите имя, фамилию или отображаемое имя"
      );
    }

    if (values.email && !EMAIL_RX.test(asText(values.email))) {
      nextErrors.email = t("contacts.validation.emailInvalid", "Некорректный email");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [t, values]);

  const handleSave = useCallback(async () => {
    if (!editable || !validate()) return;

    try {
      setSaveError("");
      const payload = toApiContact(values, { createMode: isCreateMode });
      if (isCreateMode) {
        const created = await createContact(payload).unwrap();
        setDirty(false);
        navigate(`/main/contacts/${created.id}`, {
          state: prefill.returnTo ? {
            returnTo: prefill.returnTo,
            returnLabel: prefill.returnLabel,
            counterpartyId: values.counterpartyId,
            counterpartyName: values.counterpartyName,
            counterpartyType: values.counterpartyType,
          } : undefined,
        });
        return;
      }

      const saved = await updateContact({ id, payload }).unwrap();
      setValues(toFormContact(saved));
      setDirty(false);
    } catch (error) {
      const message = (
        error?.data?.message ||
        error?.data?.error ||
        error?.message ||
        t("common.error", "Error")
      );
      setSaveError(String(message));
      setErrors((current) => ({ ...current, form: String(message) }));
    }
  }, [createContact, editable, id, isCreateMode, navigate, prefill.returnLabel, prefill.returnTo, t, updateContact, validate, values]);

  const handleDelete = useCallback(async () => {
    if (isCreateMode || !id) return;
    await deleteContact(id).unwrap();
    setDeleteOpen(false);
    navigate(backTarget);
  }, [backTarget, deleteContact, id, isCreateMode, navigate]);

  const handleMakeMain = useCallback(async () => {
    if (isCreateMode || !id) return;
    try {
      const saved = await setMainContact(id).unwrap();
      setValues(toFormContact(saved));
      setDirty(false);
    } catch (error) {
      const message = error?.data?.message || error?.data?.error || error?.message || t("common.error", "Error");
      setSaveError(String(message));
    }
  }, [id, isCreateMode, setMainContact, t]);

  const sidebar = (
    <div className={s.sidebarStack}>
      <DetailSection
        title={t("contacts.detail.identity", "Идентификация")}
        subtitle={t("contacts.detail.identitySubtitle", "Имя, связь и роль")}
      >
        <div className={s.formGrid}>
          <TextField
            label={t("contacts.fields.firstName", "Имя")}
            value={values.firstName}
            onValueChange={(value) => setField("firstName", value)}
            error={errors.name}
            disabled={!editable}
            fullWidth
          />
          <TextField
            label={t("contacts.fields.lastName", "Фамилия")}
            value={values.lastName}
            onValueChange={(value) => setField("lastName", value)}
            error={!values.firstName ? errors.name : undefined}
            disabled={!editable}
            fullWidth
          />
          <div className={s.derivedNameCard}>
            <span className={s.derivedLabel}>{t("contacts.fields.displayName", "Отображаемое имя")}</span>
            <strong className={s.derivedValue}>{generatedDisplayName || t("contacts.hints.displayNameAutoEmpty", "Введите имя и фамилию")}</strong>
            <span className={s.derivedHint}>
              {generatedDisplayName
                ? t("contacts.hints.displayNameAuto", "Собирается автоматически из имени и фамилии")
                : t("contacts.hints.displayNameAutoEmpty", "Введите имя и фамилию")}
            </span>
          </div>
          <AutocompleteField
            label={t("contacts.fields.counterparty", "Контрагент")}
            required
            value={selectedCounterparty}
            inputValue={counterpartySearch}
            onInputChange={(value) => {
              if (isCounterpartyLocked) return;
              setCounterpartySearch(value);
              if (selectedCounterparty && value !== selectedCounterparty.name) {
                setSelectedCounterparty(null);
                setField("counterpartyId", "");
                setField("counterpartyName", "");
                setField("counterpartyType", "");
              }
            }}
            options={counterpartyOptions}
            onSelect={(option) => {
              if (!option) return;
              setSelectedCounterparty(option);
              setCounterpartySearch(option.name || "");
              setValues((current) => ({
                ...current,
                counterpartyId: String(option.id || ""),
                counterpartyName: option.name || "",
                counterpartyType: option.type || current.counterpartyType || "",
              }));
              setDirty(true);
              setErrors((current) => ({ ...current, counterpartyId: undefined, form: undefined }));
            }}
            placeholder={t("contacts.placeholders.counterparty", "Начните вводить название...")}
            helperText={values.counterpartyName}
            searchingLabel={t("contacts.hints.searching", "Поиск...")}
            emptyLabel={t("contacts.hints.empty", "Ничего не найдено")}
            loading={Boolean(counterpartySearchDebounced) && counterpartyLoading}
            getOptionPrimary={(option) => option?.name || String(option?.id || "")}
            getOptionSecondary={(option) => [option?.nip ? `NIP: ${option.nip}` : null, option?.city].filter(Boolean).join(" • ")}
            error={errors.counterpartyId}
            disabled={!editable || isCounterpartyLocked}
            fullWidth
            opaque
          />
          {counterpartyHref && !isCreateMode ? (
            <Link className={s.inlineLink} to={counterpartyHref}>
              {t("contacts.detail.openCounterparty", "Открыть связанную карточку")}
            </Link>
          ) : null}
          <TextField
            label={t("contacts.fields.position", "Должность")}
            value={values.jobTitle}
            onValueChange={(value) => setField("jobTitle", value)}
            disabled={!editable}
            fullWidth
          />
        </div>
      </DetailSection>

      <DetailSection
        title={t("contacts.detail.contactSettings", "Настройки контакта")}
        subtitle={t("contacts.detail.contactSettingsSubtitle", "Роль в карточке контрагента")}
      >
        <div className={s.formGrid}>
          <TextField
            label={t("contacts.fields.departmentNote", "Команда / отдел")}
            value={values.department}
            onValueChange={(value) => setField("department", value)}
            helperText={t("contacts.hints.departmentNote", "Свободная пометка. Она пока не меняет доступы и видимость.")}
            disabled={!editable}
            fullWidth
          />
          <SelectField
            label={t("contacts.fields.status", "Статус")}
            value={values.status}
            onValueChange={() => {}}
            options={statusOptions}
            disabled
            fullWidth
          />
          <CheckboxField
            checked={Boolean(values.isPrimary)}
            onValueChange={(checked) => setField("isPrimary", checked)}
            label={t("contacts.fields.isMain", "Основной контакт")}
            helperText={t("contacts.hints.mainContact", "Используется как основной контакт для этой компании.")}
            disabled={!editable}
          />
        </div>
      </DetailSection>
    </div>
  );

  const overviewTab = (
    <div className={s.contentStack}>
      {isCreateMode ? (
        <DetailCard
          title={t("contacts.detail.quickCommunication", "Быстрые контакты")}
          subtitle={t("contacts.detail.quickCommunicationSubtitle", "После создания контактные данные можно вести как Contact Points")}
        >
          <div className={s.formGridTwo}>
            <TextField
              label={t("contacts.fields.email", "Email")}
              type="email"
              value={values.email}
              onValueChange={(value) => setField("email", value)}
              error={errors.email}
              disabled={!editable}
              fullWidth
            />
            <TextField
              label={t("contacts.fields.phone", "Телефон")}
              value={values.phone}
              onValueChange={(value) => setField("phone", value)}
              disabled={!editable}
              fullWidth
            />
          </div>
        </DetailCard>
      ) : null}

      <DetailCard title={t("contacts.tabs.overview", "Описание")}>
        <TextareaField
          label={t("contacts.fields.notes", "Описание")}
          value={values.notes}
          onValueChange={(value) => setField("notes", value)}
          minRows={8}
          disabled={!editable}
          fullWidth
        />
      </DetailCard>
    </div>
  );

  const contactPointsTab = !isCreateMode ? (
    <ContactPointsSection
      ownerType="contact"
      ownerId={id}
      title={t("contacts.contactPoints.title", "Контактные данные контактного лица")}
      subtitle={t("contacts.contactPoints.subtitle", "Телефон, email и публичные каналы этого человека")}
      emptyTitle={t("contacts.contactPoints.emptyTitle", "Контактные данные не добавлены")}
      emptyText={t("contacts.contactPoints.emptyText", "Добавьте телефон, email или мессенджер контактного лица.")}
      createTitle={t("contacts.contactPoints.createTitle", "Новые контактные данные")}
      editTitle={t("contacts.contactPoints.editTitle", "Редактировать контактные данные")}
      channelKeys={["phone", "email", "whatsapp", "telegram", "messenger", "website", "linkedin", "custom"]}
    />
  ) : null;

  const additionalTab = (
    <DetailCard title={t("contacts.tabs.additional", "Дополнительно")}>
      <dl className={s.metaList}>
        <div>
          <dt>{t("contacts.meta.createdAt", "Создан")}</dt>
          <dd>{formatDate(values.createdAt, i18n.language)}</dd>
        </div>
        <div>
          <dt>{t("contacts.meta.updatedAt", "Обновлен")}</dt>
          <dd>{formatDate(values.updatedAt, i18n.language)}</dd>
        </div>
        <div>
          <dt>{t("contacts.fields.counterparty", "Контрагент")}</dt>
          <dd>{counterpartyLabel}</dd>
        </div>
      </dl>
    </DetailCard>
  );

  const tabs = [
    {
      key: "overview",
      label: t("contacts.tabs.overview", "Описание"),
      children: overviewTab,
    },
    !isCreateMode ? {
      key: "contactPoints",
      label: t("contacts.tabs.contactPoints", "Контакты"),
      children: contactPointsTab,
    } : null,
    {
      key: "additional",
      label: t("contacts.tabs.additional", "Дополнительно"),
      children: additionalTab,
    },
  ].filter(Boolean);

  if (!isCreateMode && fetchingDetail && !detail) return <Skeleton />;

  if (!isCreateMode && detailError && !detail) {
    const message = detailError?.data?.message || detailError?.data?.error || t("contacts.messages.notFound", "Контакт не найден");
    return <div className={s.missingCard}>{message}</div>;
  }

  return (
    <>
      <DetailLayout
        mode="entity"
        breadcrumbs={[
          { label: t("menu.crm", "CRM") },
          { label: t("contacts.title", "Контактные лица"), to: "/main/contacts" },
          { label: isCreateMode ? t("common.new", "Новый") : title },
        ]}
        title={title}
        subtitle={subtitle}
        icon={<UserRound size={18} aria-hidden="true" />}
        status={{ value: values.status, label: statusLabel, tone: getStatusTone(values.status) }}
        saveState={{
          saving,
          dirty,
          error: saveError,
          label: saveError || (saving
            ? t("common.saving", "Сохранение...")
            : dirty
              ? t("common.unsaved", "Есть изменения")
              : ""),
        }}
        smartButtons={[
          {
            key: "counterparty",
            label: t("contacts.fields.counterparty", "Контрагент"),
            value: values.counterpartyName ? <Building2 size={15} aria-hidden="true" /> : "—",
            hidden: !values.counterpartyName,
            to: counterpartyHref && !isCreateMode ? counterpartyHref : undefined,
          },
        ]}
        actions={[
          {
            key: "back",
            label: prefill.returnLabel
              ? t("contacts.actions.backToEntity", {
                name: prefill.returnLabel,
                defaultValue: "К карточке",
              })
              : t("contacts.actions.back", "К контактам"),
            onClick: () => navigate(backTarget),
          },
          {
            key: "makeMain",
            label: settingMain
              ? t("common.loading", "Загрузка...")
              : t("contacts.actions.makeMain", "Сделать основным"),
            hidden: isCreateMode || values.isPrimary,
            disabled: settingMain,
            onClick: handleMakeMain,
          },
          {
            key: "delete",
            label: deleting ? t("common.loading", "Загрузка...") : t("common.delete", "Удалить"),
            destructive: true,
            hidden: isCreateMode || !canDeleteContact,
            disabled: deleting,
            onClick: () => setDeleteOpen(true),
          },
        ]}
        primaryAction={{
          key: isCreateMode ? "create" : "save",
          label: isCreateMode ? t("contacts.actions.create", "Создать контакт") : t("common.save", "Сохранить"),
          disabled: saving || !editable,
          onClick: handleSave,
        }}
        sidebar={sidebar}
        tabs={tabs}
      />
      {errors.form ? <div className={s.formError}>{errors.form}</div> : null}
      <ConfirmDialog
        open={deleteOpen}
        title={t("contacts.confirm.deleteTitle", "Удалить контакт?")}
        text={t("contacts.confirm.delete", "Удалить контакт?")}
        okText={t("common.delete", "Удалить")}
        cancelText={t("common.cancel", "Отмена")}
        danger
        loading={deleting}
        onOk={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
