import styles from "./DocumentHeader.module.css";
import { DOCUMENT_TYPE_OPTIONS } from "./documentTypeConfig";
import { getDocumentStatusOptions } from "./documentStatusConfig";

export default function DocumentHeader({ value, onChange, disabled = false }) {
  const safeValue = value || {};
  const statusOptions = getDocumentStatusOptions(safeValue?.type);

  const handleFieldChange = (field) => (event) => {
    onChange?.({
      ...safeValue,
      [field]: event.target.value,
    });
  };

  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span className={styles.label}>Тип документа</span>
        <select
          value={safeValue.type}
          onChange={handleFieldChange("type")}
          className={styles.control}
          disabled={disabled}
        >
          {DOCUMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Направление</span>
        <select
          value={safeValue.direction}
          onChange={handleFieldChange("direction")}
          className={styles.control}
          disabled={disabled}
        >
          <option value="sale">Продажа</option>
          <option value="purchase">Закупка</option>
        </select>
      </label>

      <label className={`${styles.field} ${styles.numberField}`}>
        <span className={styles.label}>Номер</span>
        <input
          type="text"
          value={safeValue.number}
          onChange={handleFieldChange("number")}
          className={styles.control}
          placeholder="Например: FV/2026/0001"
          disabled={disabled}
        />
      </label>

      <label className={`${styles.field} ${styles.statusField}`}>
        <span className={styles.label}>Статус</span>
        <select
          value={safeValue.status}
          onChange={handleFieldChange("status")}
          className={styles.control}
          disabled={disabled}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
