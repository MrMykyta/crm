import styles from "./DocumentItemsTable.module.css";

function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export default function DocumentItemsTable({
  items,
  onItemChange,
  onAddRow,
  onRemoveRow,
  disabled = false,
  title = "Позиции документа",
  subtitle = "Главная рабочая зона: количество, цена и НДС по строкам.",
}) {
  return (
    <div className={styles.tableZone}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <button type="button" className={styles.addButton} onClick={onAddRow} disabled={disabled}>
          Добавить строку
        </button>
      </div>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colName}>Наименование</th>
              <th className={styles.colQuantity}>Кол-во</th>
              <th className={styles.colUnit}>Ед.</th>
              <th className={styles.colPrice}>Цена без НДС</th>
              <th className={styles.colVat}>VAT (%)</th>
              <th className={styles.numeric}>Сумма без НДС</th>
              <th className={styles.numeric}>НДС</th>
              <th className={styles.numeric}>Сумма с НДС</th>
              <th className={styles.colActions} />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.localId} className={styles.row}>
                <td>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => onItemChange(item.localId, "name", e.target.value)}
                    className={styles.input}
                    placeholder="Название позиции"
                    disabled={disabled}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.quantity}
                    step="0.001"
                    min="0"
                    onChange={(e) => onItemChange(item.localId, "quantity", e.target.value)}
                    className={styles.input}
                    disabled={disabled}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => onItemChange(item.localId, "unit", e.target.value)}
                    className={styles.input}
                    disabled={disabled}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.unitNet}
                    step="0.01"
                    min="0"
                    onChange={(e) => onItemChange(item.localId, "unitNet", e.target.value)}
                    className={styles.input}
                    disabled={disabled}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.vatRate}
                    step="0.01"
                    min="0"
                    onChange={(e) => onItemChange(item.localId, "vatRate", e.target.value)}
                    className={styles.input}
                    disabled={disabled}
                  />
                </td>
                <td className={`${styles.amount} ${styles.numeric}`}>{formatAmount(item.sumNet)}</td>
                <td className={`${styles.amount} ${styles.numeric}`}>{formatAmount(item.sumVat)}</td>
                <td className={`${styles.amount} ${styles.numeric} ${styles.amountStrong}`}>
                  {formatAmount(item.sumGross)}
                </td>
                <td className={styles.actionsCell}>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemoveRow(item.localId)}
                    disabled={disabled}
                    aria-label="Удалить строку"
                    title="Удалить строку"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
