import { useEffect, useMemo, useRef, useState } from "react";
import {
  DOCUMENT_NUMBERING_TYPE_ORDER,
  NUMBERING_CATEGORY_LABELS,
  PATTERN_EXAMPLES,
  TEMPLATE_TOKEN_EXAMPLES,
} from "../../../../../components/documents/documentNumberingTypeCatalog";
import {
  useBootstrapDocumentNumberingSettingsMutation,
  useGetDocumentNumberingSettingsQuery,
  usePreviewDocumentNumberingMutation,
  useRebuildDocumentNumberingSettingsMutation,
  useUpdateDocumentNumberingSettingMutation,
} from "../../../../../store/rtk/documentNumberingSettingsApi";
import s from "./DocumentNumberingSettings.module.css";

const ORDER_INDEX = DOCUMENT_NUMBERING_TYPE_ORDER.reduce((acc, documentType, index) => {
  acc[documentType] = index;
  return acc;
}, {});

const RESET_OPTIONS = [
  { value: "none", label: "без сброса" },
  { value: "yearly", label: "ежегодно" },
  { value: "monthly", label: "ежемесячно" },
];

function asText(value) {
  return String(value ?? "").trim();
}

function localValidatePattern(pattern) {
  const normalized = asText(pattern);
  if (!normalized) return "Шаблон обязателен";
  if (!normalized.includes("{SEQ")) return "Шаблон должен содержать токен {SEQ}";

  const opened = (normalized.match(/\{/g) || []).length;
  const closed = (normalized.match(/\}/g) || []).length;
  if (opened !== closed) return "Невалидный синтаксис токенов";

  const knownTokens = new Set(["YYYY", "YY", "MM", "DD", "SEQ", "TYPE", "COMPANY", "BRANCH"]);
  const tokens = normalized.match(/\{[^{}]+\}/g) || [];
  for (const tokenBlock of tokens) {
    const token = tokenBlock.slice(1, -1).trim().toUpperCase();
    if (knownTokens.has(token)) continue;
    const seqMatch = /^SEQ:(\d{1,2})$/.exec(token);
    if (seqMatch) {
      const padding = Number(seqMatch[1]);
      if (padding >= 1 && padding <= 12) continue;
    }
    return `Неподдерживаемый токен ${tokenBlock}`;
  }
  return "";
}

function normalizeRow(row) {
  const pattern = asText(row?.pattern);
  return {
    id: row?.id || null,
    documentType: asText(row?.documentType).toUpperCase(),
    label: asText(row?.label) || asText(row?.documentType).toUpperCase(),
    category: asText(row?.category) || "sales",
    typeCode: asText(row?.typeCode) || asText(row?.documentType).toUpperCase(),
    enabled: Boolean(row?.enabled),
    pattern,
    resetPolicy: asText(row?.resetPolicy) || "yearly",
    sequenceCounter: Number(row?.sequenceCounter || 0) || 0,
    lastNumber: asText(row?.lastNumber),
    nextSequence: Number(row?.nextSequence || 0) || 0,
    nextNumberPreview: asText(row?.nextNumberPreview),
    isDirty: false,
    patternError: localValidatePattern(pattern),
    previewError: "",
    previewLoading: false,
  };
}

function sortRows(rows = []) {
  const copy = [...rows];
  copy.sort((left, right) => {
    const li = ORDER_INDEX[left.documentType] ?? Number.MAX_SAFE_INTEGER;
    const ri = ORDER_INDEX[right.documentType] ?? Number.MAX_SAFE_INTEGER;
    if (li !== ri) return li - ri;
    return left.label.localeCompare(right.label, "ru");
  });
  return copy;
}

export default function DocumentNumberingSettings({
  categoryFilter = null,
  title = "Типы документов и нумерация",
  subtitle = "Настройки применяются на уровне компании и реально используются при генерации номеров.",
}) {
  const { data, isFetching, error, refetch } = useGetDocumentNumberingSettingsQuery();
  const [updateSetting, { isLoading: isSaving }] = useUpdateDocumentNumberingSettingMutation();
  const [previewNumber] = usePreviewDocumentNumberingMutation();
  const [bootstrapSettings, { isLoading: isBootstrapping }] = useBootstrapDocumentNumberingSettingsMutation();
  const [rebuildSettings, { isLoading: isRebuilding }] = useRebuildDocumentNumberingSettingsMutation();

  const [rows, setRows] = useState([]);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const previewTimersRef = useRef({});

  useEffect(() => {
    const incoming = Array.isArray(data?.items) ? data.items : [];
    setRows(sortRows(incoming.map(normalizeRow)));
  }, [data?.items]);

  useEffect(
    () => () => {
      Object.values(previewTimersRef.current).forEach((timerId) => {
        if (timerId) window.clearTimeout(timerId);
      });
    },
    []
  );

  const filteredRows = useMemo(() => {
    const source = sortRows(rows);
    if (!categoryFilter) return source;
    return source.filter((row) => row.category === categoryFilter);
  }, [rows, categoryFilter]);

  const dirtyRows = useMemo(() => rows.filter((row) => row.isDirty), [rows]);

  const busy = isSaving || isBootstrapping || isRebuilding;

  const updateRow = (documentType, updater) => {
    setRows((prev) =>
      prev.map((row) => (row.documentType === documentType ? updater(row) : row))
    );
  };

  const schedulePreview = (documentType, pattern) => {
    const timer = previewTimersRef.current[documentType];
    if (timer) window.clearTimeout(timer);

    const validationError = localValidatePattern(pattern);
    if (validationError) {
      updateRow(documentType, (row) => ({
        ...row,
        patternError: validationError,
        previewError: "",
      }));
      return;
    }

    previewTimersRef.current[documentType] = window.setTimeout(async () => {
      updateRow(documentType, (row) => ({
        ...row,
        previewLoading: true,
        previewError: "",
      }));
      try {
        const result = await previewNumber({ documentType, pattern }).unwrap();
        updateRow(documentType, (row) => {
          if (row.pattern !== pattern) return row;
          return {
            ...row,
            nextNumberPreview: asText(result?.preview),
            nextSequence: Number(result?.nextSequence || row.nextSequence || 0),
            previewError: "",
            previewLoading: false,
          };
        });
      } catch (previewError) {
        updateRow(documentType, (row) => {
          if (row.pattern !== pattern) return row;
          return {
            ...row,
            previewError:
              previewError?.data?.message ||
              previewError?.data?.error ||
              "Не удалось получить предпросмотр",
            previewLoading: false,
          };
        });
      }
    }, 380);
  };

  const onPatternChange = (documentType, value) => {
    const pattern = value;
    const validationError = localValidatePattern(pattern);

    updateRow(documentType, (row) => ({
      ...row,
      pattern,
      patternError: validationError,
      isDirty: true,
      previewError: "",
    }));
    setSaveError("");
    setSaveSuccess("");

    schedulePreview(documentType, pattern);
  };

  const onEnabledChange = (documentType, enabled) => {
    updateRow(documentType, (row) => ({
      ...row,
      enabled: Boolean(enabled),
      isDirty: true,
    }));
    setSaveError("");
    setSaveSuccess("");
  };

  const onResetPolicyChange = (documentType, resetPolicy) => {
    updateRow(documentType, (row) => ({
      ...row,
      resetPolicy,
      isDirty: true,
    }));
    setSaveError("");
    setSaveSuccess("");
  };

  const onBootstrap = async () => {
    setSaveError("");
    setSaveSuccess("");
    try {
      const response = await bootstrapSettings().unwrap();
      const incoming = Array.isArray(response?.items) ? response.items : [];
      setRows(sortRows(incoming.map(normalizeRow)));
      setSaveSuccess("Созданы/проверены дефолтные настройки нумерации");
    } catch (bootstrapError) {
      setSaveError(
        bootstrapError?.data?.message ||
          bootstrapError?.data?.error ||
          "Не удалось выполнить bootstrap настроек"
      );
    }
  };

  const onRebuild = async () => {
    setSaveError("");
    setSaveSuccess("");
    try {
      const response = await rebuildSettings().unwrap();
      const incoming = Array.isArray(response?.items) ? response.items : [];
      setRows(sortRows(incoming.map(normalizeRow)));
      setSaveSuccess("Счётчики и последний номер пересчитаны по историческим документам");
    } catch (rebuildError) {
      setSaveError(
        rebuildError?.data?.message ||
          rebuildError?.data?.error ||
          "Не удалось выполнить пересчёт нумерации"
      );
    }
  };

  const onSave = async () => {
    setSaveError("");
    setSaveSuccess("");

    const targetRows = categoryFilter
      ? dirtyRows.filter((row) => row.category === categoryFilter)
      : dirtyRows;

    if (!targetRows.length) {
      setSaveSuccess("Нет изменений для сохранения");
      return;
    }

    const invalid = targetRows.find((row) => row.patternError);
    if (invalid) {
      setSaveError(`Исправьте шаблон для "${invalid.label}"`);
      return;
    }

    try {
      for (const row of targetRows) {
        // eslint-disable-next-line no-await-in-loop
        const saved = await updateSetting({
          documentType: row.documentType,
          payload: {
            enabled: row.enabled,
            pattern: row.pattern,
            resetPolicy: row.resetPolicy,
          },
        }).unwrap();

        const normalizedSaved = normalizeRow(saved);
        setRows((prev) =>
          prev.map((entry) =>
            entry.documentType === row.documentType
              ? { ...normalizedSaved, isDirty: false, patternError: "", previewError: "" }
              : entry
          )
        );
      }
      setSaveSuccess("Настройки нумерации сохранены");
      refetch();
    } catch (updateError) {
      setSaveError(
        updateError?.data?.message ||
          updateError?.data?.error ||
          "Не удалось сохранить настройки нумерации"
      );
    }
  };

  if (isFetching && !rows.length) {
    return <div className={s.skeleton}>Загрузка настроек нумерации…</div>;
  }

  if (error && !rows.length) {
    return (
      <div className={s.stateCard}>
        <p className={s.stateTitle}>Не удалось загрузить настройки нумерации</p>
        <p className={s.stateText}>
          {error?.data?.message || error?.data?.error || "Ошибка загрузки данных"}
        </p>
        <button type="button" className={s.ghostButton} onClick={refetch}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <header className={s.header}>
        <h2 className={s.title}>{title}</h2>
        <p className={s.subtitle}>{subtitle}</p>
        {categoryFilter ? (
          <p className={s.badge}>{NUMBERING_CATEGORY_LABELS[categoryFilter] || categoryFilter}</p>
        ) : null}
      </header>

      <section className={s.tokensCard}>
        <p className={s.tokensTitle}>Токены шаблона</p>
        <div className={s.tokensRow}>
          {TEMPLATE_TOKEN_EXAMPLES.map((token) => (
            <span key={token} className={s.tokenPill}>
              {token}
            </span>
          ))}
        </div>
        <p className={s.tokensExamples}>Примеры: {PATTERN_EXAMPLES.join(" · ")}</p>
      </section>

      <div className={s.actions}>
        <button type="button" className={s.ghostButton} onClick={refetch} disabled={busy || isFetching}>
          Обновить
        </button>
        <button type="button" className={s.ghostButton} onClick={onBootstrap} disabled={busy}>
          Bootstrap
        </button>
        <button type="button" className={s.ghostButton} onClick={onRebuild} disabled={busy}>
          Rebuild
        </button>
        <button
          type="button"
          className={s.primaryButton}
          onClick={onSave}
          disabled={busy || !dirtyRows.length}
        >
          {busy ? "Сохранение..." : "Сохранить"}
        </button>
      </div>

      {saveError ? <p className={s.error}>{saveError}</p> : null}
      {saveSuccess ? <p className={s.success}>{saveSuccess}</p> : null}

      {!filteredRows.length ? (
        <div className={s.stateCard}>
          <p className={s.stateTitle}>Нет типов документов в этой категории</p>
          <p className={s.stateText}>Выберите другую секцию или выполните bootstrap настроек.</p>
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Тип документа</th>
                <th>Шаблон номера</th>
                <th>Последний номер</th>
                <th>Следующий номер</th>
                <th>Включено</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.documentType} className={!row.enabled ? s.rowDisabled : ""}>
                  <td>
                    <p className={s.typeLabel}>{row.label}</p>
                    <p className={s.typeMeta}>{row.documentType}</p>
                  </td>
                  <td>
                    <input
                      className={`${s.input} ${row.patternError ? s.inputError : ""}`}
                      value={row.pattern}
                      onChange={(event) => onPatternChange(row.documentType, event.target.value)}
                      maxLength={180}
                      spellCheck={false}
                      placeholder="FV/{YYYY}/{MM}/{SEQ:4}"
                      disabled={busy}
                      title="Доступные токены: {YYYY}, {YY}, {MM}, {DD}, {SEQ}, {SEQ:4}, {TYPE}, {COMPANY}, {BRANCH}"
                    />
                    <div className={s.patternMetaRow}>
                      <label className={s.metaField}>
                        <span>Сброс</span>
                        <select
                          className={s.select}
                          value={row.resetPolicy}
                          onChange={(event) => onResetPolicyChange(row.documentType, event.target.value)}
                          disabled={busy}
                        >
                          {RESET_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {row.patternError ? <p className={s.rowError}>{row.patternError}</p> : null}
                    {row.previewError ? <p className={s.rowError}>{row.previewError}</p> : null}
                  </td>
                  <td>
                    <div className={s.readonlyCell}>{row.lastNumber || "—"}</div>
                  </td>
                  <td>
                    <div className={s.readonlyCell}>
                      {row.previewLoading ? "Обновление..." : row.nextNumberPreview || "—"}
                    </div>
                  </td>
                  <td>
                    <label className={s.switch}>
                      <input
                        type="checkbox"
                        checked={Boolean(row.enabled)}
                        onChange={(event) => onEnabledChange(row.documentType, event.target.checked)}
                        disabled={busy}
                      />
                      <span>{row.enabled ? "ON" : "OFF"}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

