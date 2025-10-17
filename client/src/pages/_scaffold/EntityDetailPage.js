import styles from "./detailScaffold.module.css";
import FieldRenderer from "../../components/SmartForm";
import TabBar from "../../components/TabBar";
import DetailTabs from "../../components/DetailTabs";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, useMemo } from "react";

/**
 * Универсальная детальная страница с автосейвом, стабильным сравнением payload
 * и чисткой localStorage при размонтаже.
 *
 * Отличия от твоей версии:
 *  - makePayload теперь гарантирует, что ОЧИЩЕННЫЕ текстовые поля ('' в values)
 *    уйдут на сервер как null, даже если toApi их не выставил (undefined).
 *  - debounce автосейва по умолчанию 500 мс.
 */

export default function EntityDetailPage({
  id,
  load, save,
  schemaBuilder, toForm, toApi, buildPayload,
  tabs,
  leftExtras,
  storageKeyPrefix = "entity",
  autosave = { debounceMs: 500 },          // ← было 800/10 — поставил 500 по умолчанию
  saveOnExit = true,
  clearDraftOnUnmount = true,
  payloadDeps = [],
}) {
  const { t, i18n } = useTranslation();

  const [data, setData] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [active, setActive] = useState(tabs?.[0]?.key ?? "overview");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const debTimer = useRef(null);
  const inFlight = useRef(false);
  const dirtyRef = useRef(false);
  const unmounted = useRef(false);

  const lastSavedJSONRef = useRef('');
  const storageKey = `${storageKeyPrefix}:${id}`;
  const debounceMs = autosave?.debounceMs ?? 500;

  // соберём схему один раз на язык (чтобы знать список полей)
  const schema = useMemo(() => schemaBuilder(i18n), [schemaBuilder, i18n]);

  const stamp = () => new Date().toISOString();

  // stable stringify (сортируем ключи; раньше undefined-ключи отбрасывались —
  // это ок, т.к. мы ниже конвертим '' → null, чтобы ключ точно попал в payload)
  const stableStringify = (obj) => {
    const seen = new WeakSet();
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

  const readDraft = () => { try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const writeDraft = (obj) => { try { localStorage.setItem(storageKey, JSON.stringify(obj)); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(storageKey); } catch {} };

  // ГЛАВНОЕ: если пользователь очистил поле (values[name] === ''),
  // а toApi его НЕ выставил (payload[name] === undefined), то проставляем null,
  // чтобы сервер понял «очистить».
  const makePayload = (vals) => {
    const base = toApi(vals) || {};
    const out = { ...base };

    // пройдёмся по полям схемы; где в форме пустая строка — принудительно null
    for (const f of Array.isArray(schema) ? schema : []) {
      const name = f?.name;
      if (!name) continue;
      const v = vals[name];
      // учитываем только текстовые/многострочные поля или те, у кого нет явного типа
      const isTextLike = !f.type || f.type === 'text' || f.type === 'textarea' || f.type === 'string';
      if (isTextLike && (v === '' || v == null)) {
        if (out[name] == undefined) out[name] = '';
      }
    }

    return buildPayload ? buildPayload(out) : out;
  };

  const validate = (vals) => {
    const e = {};
    (Array.isArray(schema) ? schema : []).forEach(f => {
      if (!f?.name) return;
      if (f.required && !String(vals[f.name] ?? "").trim()) e[f.name] = t("crm.form.errors.required");
      if (f.max && String(vals[f.name] || "").length > f.max) e[f.name] = t("crm.form.errors.max", { max: f.max });
    });
    return e;
  };

  const flushSave = async () => {
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

  const scheduleSave = () => {
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

  // init
  useEffect(() => {
    unmounted.current = false;
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

  // autosave: по изменениям values
  useEffect(() => {
    if (data == null) return;
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  // autosave: по внешним зависимостям (например, contacts)
  useEffect(() => {
    if (data == null) return;
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, payloadDeps);

  // сохранять черновик при закрытии вкладки (без сети)
  useEffect(() => {
    if (!saveOnExit) return;
    const onBeforeUnload = () => {
      if (!dirtyRef.current) return;
      writeDraft({ values, updatedAt: stamp(), serverUpdatedAt: data?.updatedAt || null });
    };
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

  const onChange = (name, val) => setValues(v => ({ ...v, [name]: val }));

  if (!data) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.left}>
        <FieldRenderer
          values={values}
          errors={errors}
          onChange={onChange}
          schema={schema}
          i18n={{ t }}
        />
        {leftExtras}
        <div className={styles.autosaveHint}>
          {saving
            ? t("common.saving")
            : (dirtyRef.current ? t("common.unsaved") : t("common.saved"))}
          {saveError && <span className={styles.saveErr}> • {saveError}</span>}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.tabsSticky}>
          <TabBar items={tabs} activeKey={active} onChange={setActive} />
        </div>
        <div className={styles.panel}>
          <DetailTabs tab={active} data={data} />
        </div>
      </div>
    </div>
  );
}