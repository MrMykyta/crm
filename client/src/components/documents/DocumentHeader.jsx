import styles from "./DocumentHeader.module.css";
import { SelectField, TextField } from "../ui/fields";
import { DOCUMENT_TYPE_OPTIONS } from "./documentTypeConfig";
import { getDocumentStatusOptions } from "./documentStatusConfig";

export default function DocumentHeader({ value, onChange, disabled = false }) {
  const safeValue = value || {};
  const statusOptions = getDocumentStatusOptions(safeValue?.type);

  const setField = (field, nextValue) => {
    onChange?.({
      ...safeValue,
      [field]: nextValue,
    });
  };

  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span className={styles.label}>Тип документа</span>
        <SelectField
          value={safeValue.type}
          onValueChange={(value) => setField("type", value)}
          options={DOCUMENT_TYPE_OPTIONS}
          inputClassName={styles.control}
          disabled={disabled}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Направление</span>
        <SelectField
          value={safeValue.direction}
          onValueChange={(value) => setField("direction", value)}
          options={[
            { value: "sale", label: "Продажа" },
            { value: "purchase", label: "Закупка" },
          ]}
          inputClassName={styles.control}
          disabled={disabled}
        />
      </label>

      <label className={`${styles.field} ${styles.numberField}`}>
        <span className={styles.label}>Номер</span>
        <TextField
          type="text"
          value={safeValue.number}
          onValueChange={(value) => setField("number", value)}
          inputClassName={styles.control}
          placeholder="Например: FV/2026/0001"
          disabled={disabled}
        />
      </label>

      <label className={`${styles.field} ${styles.statusField}`}>
        <span className={styles.label}>Статус</span>
        <SelectField
          value={safeValue.status}
          onValueChange={(value) => setField("status", value)}
          options={statusOptions}
          inputClassName={styles.control}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
