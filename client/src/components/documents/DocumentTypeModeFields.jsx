import { getDocumentTypeConfig } from "./documentTypeConfig";
import { DateField, NumberField } from "../ui/fields";
import styles from "./DocumentTypeModeFields.module.css";

function normalizeIntInput(value) {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Math.trunc(n);
}

function asValue(value) {
  if (value === undefined || value === null) return "";
  return value;
}

export default function DocumentTypeModeFields({
  type,
  value,
  onChange,
  disabled = false,
}) {
  const typeConfig = getDocumentTypeConfig(type);
  const terms = value && typeof value === "object" ? value : {};
  const showValidity = Boolean(typeConfig.sections.validity);
  const showPaymentTerms = Boolean(typeConfig.sections.paymentTerms);
  const showContractHelper = typeConfig.capabilities.requiresItems === false;

  if (!showValidity && !showPaymentTerms && !showContractHelper) {
    return null;
  }

  const setField = (field, nextValue) => {
    onChange?.({
      ...terms,
      [field]: nextValue,
    });
  };

  return (
    <div className={styles.modeGrid}>
      {showValidity ? (
        <section className={styles.group}>
          <div className={styles.groupHeader}>
            <h3 className={styles.groupTitle}>Срок действия</h3>
            <p className={styles.groupHint}>Период, в течение которого действуют условия документа.</p>
          </div>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>Действует с</span>
              <DateField
                value={asValue(terms.validFrom)}
                onValueChange={(value) => setField("validFrom", value)}
                inputClassName={styles.control}
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Действует до</span>
              <DateField
                value={asValue(terms.validTo)}
                onValueChange={(value) => setField("validTo", value)}
                inputClassName={styles.control}
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Срок (дней)</span>
              <NumberField
                emitAs="string"
                value={asValue(terms.validDays)}
                onValueChange={(raw) => setField("validDays", normalizeIntInput(raw))}
                inputClassName={styles.control}
                min="1"
                step="1"
                placeholder="Например: 14"
                disabled={disabled}
              />
            </label>
          </div>
        </section>
      ) : null}

      {showPaymentTerms ? (
        <section className={styles.group}>
          <div className={styles.groupHeader}>
            <h3 className={styles.groupTitle}>Условия оплаты</h3>
            <p className={styles.groupHint}>Параметры оплаты для платёжных документов.</p>
          </div>

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>Оплатить до</span>
              <DateField
                value={asValue(terms.paymentDueDate)}
                onValueChange={(value) => setField("paymentDueDate", value)}
                inputClassName={styles.control}
                disabled={disabled}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Срок оплаты (дней)</span>
              <NumberField
                emitAs="string"
                value={asValue(terms.paymentDays)}
                onValueChange={(raw) => setField("paymentDays", normalizeIntInput(raw))}
                inputClassName={styles.control}
                min="1"
                step="1"
                placeholder="Например: 7"
                disabled={disabled}
              />
            </label>
          </div>
        </section>
      ) : null}

      {showContractHelper ? (
        <section className={styles.group}>
          <p className={styles.helperText}>
            Режим договора: позиции не обязательны. Можно сохранить документ только с реквизитами и примечанием.
          </p>
        </section>
      ) : null}
    </div>
  );
}
