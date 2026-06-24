// src/pages/_scaffold/EntityDetailPage.jsx
import styles from "./detailScaffold.module.css";
import FieldRenderer from "../../components/forms/SmartForm";
import TabBar from "../../components/layout/TabBar";
import DetailTabs from "../../components/data/DetailTabs";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import useTabsPrefs from "../../hooks/useTabsPrefs";

/**
 * Базовый scaffold для detail-страниц:
 * слева — master form с автосохранением, справа — связанные вкладки.
 */
export default function EntityDetailPage({
  id,
  load, save,
  schemaBuilder, toForm, toApi, buildPayload,
  tabs,
  leftExtras,
  leftTop,
  storageKeyPrefix = "entity",
  autosave = { debounceMs: 500 },
  saveOnExit = true,
  clearDraftOnUnmount = true,
  payloadDeps = [],
  RightTabsComponent = DetailTabs,
  layoutClassName = "",
  leftPaneClassName = "",
  rightPaneClassName = "",
  tabsClassName = "",
  panelClassName = "",
  formClassName = "",
  formVariant = "",
  readOnly = false,
  activeTab,
  onActiveTabChange,
  hideTabs = false,

  /** 👇 уникальный namespace для prefs табов (по странице) */
  tabsNamespace = "entity.detail",
}) {
  const { t, i18n } = useTranslation();

  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // prefs табов: порядок+разворачивание
  const {
    orderedItems: tabsOrdered,
    setOrderKeys,
    expanded,
    setExpanded,
  } = useTabsPrefs(tabsNamespace, {
    items: tabs,
    defaultExpanded: false,
    saveDebounceMs: 0, // <-- сразу после DnD шлём на сервер
    // можно не указывать: дефолт сам прочитает ui.appearance.tabs или appearance.tabs
    // serverPath: (prefs) => prefs?.ui?.appearance?.tabs?.[tabsNamespace] || prefs?.appearance?.tabs?.[tabsNamespace] || {},
    // serverMerge: кастом не нужен, дефолт кладёт обратно туда же (ui.appearance или appearance)
  });


  // активный таб — из текущего упорядоченного набора
  const [internalActive, setInternalActive] = useState(tabsOrdered?.[0]?.key ?? (tabs?.[0]?.key ?? "overview"));
  const active = activeTab ?? internalActive;
  const setActive = useCallback((next) => {
    setInternalActive(next);
    onActiveTabChange?.(next);
  }, [onActiveTabChange]);

  useEffect(() => {
    const exists = tabsOrdered.some(t => t.key === active);
    if (!exists && tabsOrdered[0]?.key) setActive(tabsOrdered[0].key);
  }, [tabsOrdered, active, setActive]);

  const debTimer = useRef(null);
  const inFlight = useRef(false);
  const dirtyRef = useRef(false);
  const unmounted = useRef(false);

  const lastSavedJSONRef = useRef('');
  const storageKey = `${storageKeyPrefix}:${id}`;
  const debounceMs = autosave?.debounceMs ?? 500;

  const schema = useMemo(() => schemaBuilder(i18n), [schemaBuilder, i18n]);
  const renderedSchema = useMemo(() => {
    if (!readOnly || !Array.isArray(schema)) return schema;
    return schema.map((field) => ({ ...field, disabled: true }));
  }, [readOnly, schema]);
  // Вспомогательный timestamp для draft/метаданных сохранения.
  const stamp = () => new Date().toISOString();

  // Детерминированная сериализация payload:
  // нужна, чтобы корректно сравнивать "что изменилось" без ложных срабатываний.
  const stableStringify = (obj) => {
    const seen = new WeakSet();
        // stringify: вспомогательная логика компонента.
const stringify = (o) => {
      if (o === null || typeof o !== 'object') return JSON.stringify(o);
      if (seen.has(o)) return '"[Circular]"';
      seen.add(o);
      if (Array.isArray(o)) return '[' + o.map(stringify).join(',') + ']';
      const keys = Object.keys(o).filter(k => o[k] !== undefined).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + stringify(o[k])).join(',') + '}';
    };
    return stringify(obj);
  };

  // Читает черновик формы из localStorage.
  const readDraft = () => { try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  // Сохраняет черновик формы в localStorage.
  const writeDraft = (obj) => { try { localStorage.setItem(storageKey, JSON.stringify(obj)); } catch {} };
  // Удаляет черновик после успешного сохранения/размонтирования.
  const clearDraft = () => { try { localStorage.removeItem(storageKey); } catch {} };

  // Собирает API-payload из формы и выравнивает пустые строковые поля.
  const makePayload = (vals) => {
    const base = toApi(vals) || {};
    const out = { ...base };
    for (const f of Array.isArray(schema) ? schema : []) {
      const name = f?.name; if (!name) continue;
      const v = vals[name];
      const isTextLike = !f.type || f.type === 'text' || f.type === 'textarea' || f.type === 'string';
      if (isTextLike && (v === '' || v == null)) {
        if (out[name] === undefined) out[name] = '';
      }
    }
    return buildPayload ? buildPayload(out) : out;
  };

  // Базовая клиентская валидация перед autosave.
  const validate = (vals) => {
    const e = {};
    (Array.isArray(schema) ? schema : []).forEach(f => {
      if (!f?.name) return;
      if (f.required && !String(vals[f.name] ?? "").trim()) e[f.name] = t("crm.form.errors.required");
      if (f.max && String(vals[f.name] || "").length > f.max) e[f.name] = t("crm.form.errors.max", { max: f.max });
    });
    return e;
  };

  // Выполняет фактическое сохранение (с защитой от параллельных запросов и no-op изменений).
  const flushSave = async () => {
    if (readOnly) return;
    if (unmounted.current) return;
    if (inFlight.current) return;
    if (!dirtyRef.current) return;

    const payload = makePayload(values);
    const nowJSON = stableStringify(payload);
    if (nowJSON === lastSavedJSONRef.current) {
      dirtyRef.current = false;
      clearDraft();
      return;
    }

    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await save(id, payload);
      if (unmounted.current) return;
      setData(saved);
      setValues(v => toForm(saved));
      lastSavedJSONRef.current = nowJSON;
      dirtyRef.current = false;
      clearDraft();
    } catch (e) {
      setSaveError(e?.message || "Save failed");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  // Ставит сохранение в debounce-очередь и пишет текущий draft локально.
  const scheduleSave = () => {
    if (readOnly) return;
    const payload = makePayload(values);
    const nowJSON = stableStringify(payload);
    if (nowJSON === lastSavedJSONRef.current) {
      dirtyRef.current = false;
      clearDraft();
      return;
    }
    dirtyRef.current = true;
    writeDraft({ values, updatedAt: stamp(), serverUpdatedAt: data?.updatedAt || null });
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(flushSave, debounceMs);
  };

  useEffect(() => {
    unmounted.current = false;
    // Первая загрузка detail: тянем серверные данные и при необходимости поднимаем свежий draft.
    (async () => {
      const d = await load(id);
      setData(d);
      const initialValues = toForm(d);
      setValues(initialValues);
      const initialPayload = makePayload(initialValues);
      lastSavedJSONRef.current = stableStringify(initialPayload);

      const draft = readDraft();
      if (draft?.values && draft.updatedAt) {
        const draftTime = new Date(draft.updatedAt).getTime();
        const serverTime = new Date(d?.updatedAt || 0).getTime();
        if (draftTime > serverTime) {
          setValues(draft.values);
        }
      }
    })();

    return () => {
      unmounted.current = true;
      if (debTimer.current) clearTimeout(debTimer.current);
      if (clearDraftOnUnmount) clearDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Автосохранение при изменении формы.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!readOnly && data != null) scheduleSave(); }, [values]);
  // Автосохранение при изменении внешних зависимостей payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!readOnly && data != null) scheduleSave(); }, payloadDeps);

  useEffect(() => {
    if (!saveOnExit) return;
    // На уход со страницы сохраняем draft, чтобы не терять несохранённые изменения.
    const onBeforeUnload = () => { if (!dirtyRef.current) return; writeDraft({ values, updatedAt: stamp(), serverUpdatedAt: data?.updatedAt || null }); };
        // onVisibilityChange: вспомогательная логика компонента.
const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        writeDraft({ values, updatedAt: stamp(), serverUpdatedAt: data?.updatedAt || null });
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, data]);

  // Унифицированный setter для полей SmartForm.
  const onChange = (name, val) => {
    if (readOnly) return;
    setValues(v => ({ ...v, [name]: val }));
  };

  if (!data) return null;

  return (
    <div className={`${styles.wrap} ${layoutClassName}`}>
      <div
        className={`${styles.left} ${leftPaneClassName}`}
        data-select-boundary="1"
        data-autocomplete-boundary="1"
      >
        {typeof leftTop === 'function'
          ? leftTop({ values, onChange })
          : leftTop}
        <FieldRenderer
          values={values}
          errors={errors}
          onChange={onChange}
          schema={renderedSchema}
          i18n={{ t }}
          className={formClassName}
          variant={formVariant}
        />
        {leftExtras}
        <div className={styles.autosaveHint}>
          {readOnly
            ? t("common.noPermission", "No permission")
            : saving
            ? t("common.saving", "Сохранение...")
            : (dirtyRef.current ? t("common.unsaved", "Есть несохранённые изменения") : t("common.saved", "Сохранено"))}
          {saveError && <span className={styles.saveErr}> • {saveError}</span>}
        </div>
      </div>

      <div className={`${styles.right} ${rightPaneClassName}`}>
        {!hideTabs ? (
          <div className={`${styles.tabsSticky} ${tabsClassName}`}>
            <TabBar
              items={tabsOrdered}
              activeKey={active}
              onChange={setActive}
              onReorder={(next) => setOrderKeys(next.map(i => i.key))}
              expanded={expanded}
              onExpandedChange={setExpanded}
              collapsedHeight={40}
              reserveButtonWidth={44}
              animationMs={260}
            />
          </div>
        ) : null}
        <div className={`${styles.panel} ${panelClassName}`}>
          <RightTabsComponent tab={active} data={data} values={values} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
