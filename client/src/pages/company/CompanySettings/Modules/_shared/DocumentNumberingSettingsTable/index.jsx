import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildNumberPatternPreview,
  getNumberingTokenExamples,
  getNumberingTokenHintLines,
} from "../numberPatternUtils";
import s from "./DocumentNumberingSettingsTable.module.css";

export default function DocumentNumberingSettingsTable({
  rows = [],
  onRowsChange,
  errors = {},
  allowToggle = false,
  allowDisableLast = false,
  onToggleRow = null,
  disabled = false,
  title = "",
  hintButtonLabel = "",
  hintAvailableLabel = "",
  hintExamplesLabel = "",
  columns = {},
  hintLines = null,
  hintExamples = null,
}) {
  const { t } = useTranslation();
  const [hintOpen, setHintOpen] = useState(false);

  const defaultColumns = useMemo(
    () => ({
      documentType: t("companySettings.documents.numbering.columns.documentType"),
      numberPattern: t("companySettings.documents.numbering.columns.numberPattern"),
      lastNumber: t("companySettings.documents.numbering.columns.lastNumber"),
      nextNumber: t("companySettings.documents.numbering.columns.nextNumber"),
      enabled: t("companySettings.documents.numbering.columns.enabled"),
    }),
    [t]
  );

  const resolvedTitle = title || t("companySettings.documents.numbering.title");
  const resolvedHintButtonLabel =
    hintButtonLabel || t("companySettings.documents.numbering.hints.button");
  const resolvedHintAvailableLabel =
    hintAvailableLabel || t("companySettings.documents.numbering.hints.available");
  const resolvedHintExamplesLabel =
    hintExamplesLabel || t("companySettings.documents.numbering.hints.examples");
  const resolvedHintLines = hintLines || getNumberingTokenHintLines(t);
  const resolvedHintExamples = hintExamples || getNumberingTokenExamples();

  const resolvedColumns = useMemo(
    () => ({ ...defaultColumns, ...(columns || {}) }),
    [columns, defaultColumns]
  );

  const enabledCount = useMemo(
    () => (Array.isArray(rows) ? rows.filter((row) => Boolean(row?.enabled)).length : 0),
    [rows]
  );

  const setPattern = (typeKey, value) => {
    if (disabled) return;
    if (typeof onRowsChange !== "function") return;
    onRowsChange(
      (rows || []).map((row) =>
        row.typeKey === typeKey
          ? {
              ...row,
              numberPattern: value,
            }
          : row
      )
    );
  };

  const toggleRow = (row) => {
    if (!row || !row.typeKey) return;
    if (disabled) return;

    if (!allowDisableLast && row.enabled && enabledCount <= 1) {
      return;
    }

    if (typeof onToggleRow === "function") {
      onToggleRow(row.typeKey, !row.enabled, row);
      return;
    }

    if (typeof onRowsChange !== "function") return;
    onRowsChange(
      (rows || []).map((entry) =>
        entry.typeKey === row.typeKey
          ? {
              ...entry,
              enabled: !entry.enabled,
            }
          : entry
      )
    );
  };

  return (
    <section className={s.card}>
      <header className={s.header}>
        <div className={s.titleRow}>
          <h2 className={s.title}>{resolvedTitle}</h2>
          <button
            type="button"
            className={s.hintButton}
            onClick={() => setHintOpen((prev) => !prev)}
            disabled={disabled}
          >
            {resolvedHintButtonLabel}
          </button>
        </div>
      </header>

      {hintOpen ? (
        <div className={s.hintCard}>
          <p className={s.hintTitle}>{resolvedHintAvailableLabel}</p>
          <div className={s.hintList}>
            {resolvedHintLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <p className={s.hintTitle}>{resolvedHintExamplesLabel}</p>
          <div className={s.hintList}>
            {resolvedHintExamples.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{resolvedColumns.documentType}</th>
              <th>{resolvedColumns.numberPattern}</th>
              <th>{resolvedColumns.lastNumber}</th>
              <th>{resolvedColumns.nextNumber}</th>
              {allowToggle ? <th>{resolvedColumns.enabled}</th> : null}
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((row) => {
              const rowError = errors?.[row.typeKey] || "";
              const nextSequence = Number(row?.nextSequence || 1);
              const lastSequence = Number(row?.lastSequence || 0);
              const nextNumber =
                buildNumberPatternPreview({
                  pattern: row.numberPattern,
                  sequence: nextSequence,
                  issueDate: new Date(),
                }) ||
                row.nextNumber ||
                "—";
              const lastNumber = lastSequence > 0
                ? (
                  buildNumberPatternPreview({
                    pattern: row.numberPattern,
                    sequence: lastSequence,
                    issueDate: new Date(),
                  }) ||
                  String(row?.lastNumber ?? "").trim() ||
                  "0"
                )
                : "—";
              const toggleDisabled = Boolean(
                disabled || (!allowDisableLast && row.enabled && enabledCount <= 1)
              );

              return (
                <tr key={row.typeKey}>
                  <td>{row.label || row.typeKey}</td>
                  <td>
                    <div className={s.patternCell}>
                      <input
                        className={`${s.patternInput} ${rowError ? s.patternInputError : ""}`}
                        value={row.numberPattern || ""}
                        onChange={(event) => setPattern(row.typeKey, event.target.value)}
                        maxLength={80}
                        disabled={disabled}
                      />
                      {rowError ? <p className={s.rowError}>{rowError}</p> : null}
                    </div>
                  </td>
                  <td>{lastNumber}</td>
                  <td>{nextNumber}</td>
                  {allowToggle ? (
                    <td>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(row.enabled)}
                        aria-label={t("companySettings.documents.numbering.aria.toggleEnabled", {
                          type: row.label || row.typeKey,
                        })}
                        className={`${s.toggle} ${row.enabled ? s.toggleOn : s.toggleOff}`}
                        onClick={() => toggleRow(row)}
                        disabled={toggleDisabled}
                      >
                        <span className={s.toggleKnob} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
