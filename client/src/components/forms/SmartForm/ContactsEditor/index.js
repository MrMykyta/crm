// src/components/forms/SmartForm/parts/ContactsEditor.jsx
import React from "react";
import { useTranslation } from "react-i18next";
import s from "../SmartForm.module.css";
import { SelectField, TextField } from "../../../ui/fields";

const CHANNELS = ["email", "phone", "website", "telegram", "whatsapp", "linkedin"];

// Компонент ContactsEditor: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function ContactsEditor({ value = [], onChange }) {
  const { t } = useTranslation();
  const primaryId = React.useId();
  const primaryName = `primaryContact-${primaryId.replace(/:/g, "")}`;

    // add: добавляет элемент в локальное состояние компонента.
const add = () =>
    onChange([
      ...value,
      { channel: "email", value: "", isPrimary: value.length === 0 },
    ]);

    // upd: вспомогательная логика компонента.
const upd = (i, patch) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

    // del: вспомогательная логика компонента.
const del = (i) => onChange(value.filter((_, idx) => idx !== i));

    // setPrimary: обновляет состояние компонента.
const setPrimary = (i) =>
    onChange(value.map((c, idx) => ({ ...c, isPrimary: idx === i })));

  const channelOptions = CHANNELS.map((v) => ({
    value: v,
    label: t(`crm.channels.${v}`),
  }));

  return (
    <div className={s.contacts}>
      <div className={s.contactsHead}>
        <div className={s.sectionTitle}>{t("crm.form.sections.contacts")}</div>
        <button type="button" className={s.btnAdd} onClick={add}>
          {t("crm.form.actions.addContact")}
        </button>
      </div>

      {value.length === 0 && (
        <div className={s.muted}>{t("crm.form.hints.noContacts")}</div>
      )}

      {value.map((c, i) => (
        <div key={i} className={s.contactRow}>
          <div style={{ minWidth: 180 }}>
            <SelectField
              value={c.channel || "email"}
              options={channelOptions}
              onValueChange={(next) => upd(i, { channel: next })}
              placeholder={t("common.select")}
              fullWidth
            />
          </div>

          <TextField
            value={c.value || ""}
            onValueChange={(next) => upd(i, { value: next })}
            placeholder={t("crm.form.placeholders.contactValue")}
            fullWidth
          />

          <label className={s.chkLine}>
            <input
              type="radio"
              name={primaryName}
              checked={!!c.isPrimary}
              onChange={() => setPrimary(i)}
            />
            {t("crm.form.fields.primary")}
          </label>

          <button
            type="button"
            className={s.btnDel}
            onClick={() => del(i)}
          >
            {t("crm.form.actions.remove")}
          </button>
        </div>
      ))}
    </div>
  );
}
