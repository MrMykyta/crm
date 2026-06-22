import styles from "./DocumentMetaForm.module.css";
import { DateField, SelectField } from "../ui/fields";

export default function DocumentMetaForm({
  value,
  direction = "sale",
  clients = [],
  isClientsLoading = false,
  onChange,
  disabled = false,
}) {
  const setField = (field, nextValue) => {
    onChange?.({
      ...value,
      [field]: nextValue,
    });
  };

  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span className={styles.label}>
          Клиент
          {direction === "sale" ? " *" : ""}
        </span>
        <SelectField
          value={value.clientId}
          onValueChange={(nextValue) => setField("clientId", nextValue)}
          options={[
            { value: "", label: "Выберите клиента" },
            ...clients.map((client) => ({
              value: client.id,
              label: client.shortName || client.fullName || client.name || client.id,
            })),
          ]}
          inputClassName={styles.control}
          disabled={isClientsLoading || disabled}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Дата выставления *</span>
        <DateField
          value={value.issueDate}
          onValueChange={(nextValue) => setField("issueDate", nextValue)}
          inputClassName={styles.control}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
