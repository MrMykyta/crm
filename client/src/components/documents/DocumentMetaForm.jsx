import styles from "./DocumentMetaForm.module.css";

export default function DocumentMetaForm({
  value,
  direction = "sale",
  clients = [],
  isClientsLoading = false,
  onChange,
  disabled = false,
}) {
  const handleFieldChange = (field) => (event) => {
    onChange?.({
      ...value,
      [field]: event.target.value,
    });
  };

  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span className={styles.label}>
          Клиент
          {direction === "sale" ? " *" : ""}
        </span>
        <select
          value={value.clientId}
          onChange={handleFieldChange("clientId")}
          className={styles.control}
          disabled={isClientsLoading || disabled}
        >
          <option value="">Выберите клиента</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.shortName || client.fullName || client.name || client.id}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Дата выставления *</span>
        <input
          type="date"
          value={value.issueDate}
          onChange={handleFieldChange("issueDate")}
          className={styles.control}
          disabled={disabled}
        />
      </label>
    </div>
  );
}
