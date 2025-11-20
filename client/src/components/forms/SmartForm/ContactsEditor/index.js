// src/components/forms/SmartForm/parts/ContactsEditor.jsx
import { useTranslation } from "react-i18next";
import s from "../SmartForm.module.css";
import ThemedSelect from "../../../inputs/RadixSelect";

const CHANNELS = ["email", "phone", "website", "telegram", "whatsapp", "linkedin"];

export default function ContactsEditor({ value = [], onChange }) {
  const { t } = useTranslation();

  const add = () =>
    onChange([
      ...value,
      { channel: "email", value: "", isPrimary: value.length === 0 },
    ]);

  const upd = (i, patch) =>
    onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const del = (i) => onChange(value.filter((_, idx) => idx !== i));

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
            <ThemedSelect
              className={s.input}
              value={c.channel || "email"}
              options={channelOptions}
              onChange={(next) => upd(i, { channel: next })}
              placeholder={t("common.select")}
            />
          </div>

          <input
            className={s.input}
            value={c.value}
            onChange={(e) => upd(i, { value: e.target.value })}
            placeholder={t("crm.form.placeholders.contactValue")}
          />

          <label className={s.chkLine}>
            <input
              type="radio"
              name="primaryContact"
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