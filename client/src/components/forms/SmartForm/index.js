// src/components/forms/SmartForm/index.jsx
import React from "react";
import s from "./SmartForm.module.css";
import MultiSelectDropdown from "../../inputs/MultiSelectDropdown";

/**
 * Поддерживает:
 * - f.showIf: (values) => boolean
 * - f.disabled: boolean | (values) => boolean
 * - f.options: Array<{value,label,labelKey?}> | (values)=>Array<...>
 * - type:
 *    "text" | "textarea" | "select" | "multiselect" | "checkbox" | "date" | "datetime"
 *    "dropdown-select" | "dropdown-multiselect"
 * - float, max, hint, options, full, placeholder, upper, inputMode
 * - multiple (для select)
 */
export default function SmartForm({ values, errors = {}, onChange, schema, i18n }) {
  const t = (k) => (typeof k === "string" ? i18n?.t?.(k) ?? k : k);

  const mapInputType = (fType) => {
    if (fType === "date") return "date";
    if (fType === "datetime") return "datetime-local";
    return "text";
  };

  const isVisible = (f) => {
    if (typeof f.showIf === "function") return !!f.showIf(values);
    if (f.showIf === false) return false;
    return true;
  };

  const isDisabled = (f) => {
    if (typeof f.disabled === "function") return !!f.disabled(values);
    return !!f.disabled;
  };

  const fmtLocalDT = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getOptions = (f) => {
    const raw = typeof f.options === "function" ? f.options(values) : f.options;
    return Array.isArray(raw) ? raw : [];
  };

  const set = (name, val) => {
    const f = schema.find((x) => x.name === name);
    let v = val;

    if (typeof v === "string") {
      if (f?.upper) v = v.toUpperCase();
      if (f?.max) v = v.slice(0, f.max);
    }

    // UX-помощь для блока "Планирование" (как было)
    if (name === "planOpen") {
      if (v && (values.isAllDay == null)) {
        onChange("isAllDay", true);
      }
      if (!v) {
        onChange("isAllDay", null);
        onChange("eventDate", "");
        onChange("startAt", "");
        onChange("endAt", "");
      }
    }

    if (name === "isAllDay") {
      if (v === true) {
        onChange("startAt", "");
        onChange("endAt", "");
      }
      if (v === false && !values.startAt && !values.endAt) {
        const now = new Date();
        now.setSeconds(0, 0);
        const m = now.getMinutes();
        now.setMinutes(m - (m % 5));
        const end = new Date(now.getTime() + 60 * 60 * 1000);
        onChange("startAt", fmtLocalDT(now));
        onChange("endAt", fmtLocalDT(end));
      }
    }

    onChange(name, v);
  };

  const visibleSchema = schema.filter((f) => f.kind === "section" || isVisible(f));

  const renderSelectOptions = (opts) =>
    (Array.isArray(opts) ? opts : []).map((opt) => (
      <option key={String(opt.value)} value={opt.value}>
        {opt.labelKey ? t(opt.labelKey) : t(opt.label ?? opt.value)}
      </option>
    ));

  return (
    <div className={s.grid}>
      {visibleSchema.map((f, i) => {
        if (f.kind === "section") {
          return (
            <div key={"sec" + i} className={s.section}>
              <div className={s.sectionTitle}>{t(f.title)}</div>
              {f.subtitle && <div className={s.sectionSub}>{t(f.subtitle)}</div>}
            </div>
          );
        }

        const isMulti = f.type === "multiselect" || !!f.multiple;
        const v = values[f.name] ?? (isMulti ? [] : "");
        const err = errors[f.name];
        const cnt = f.max && typeof v === "string" ? `${v.length} / ${f.max}` : null;
        const disabled = isDisabled(f);

        // ---- checkbox ----
        if (f.type === "checkbox") {
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <label className={s.chkLine}>
                <input
                  type="checkbox"
                  checked={!!v}
                  onChange={(e) => set(f.name, e.target.checked)}
                  disabled={disabled}
                />
                <span>{t(f.label)}</span>
              </label>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // ---- dropdown-multiselect (чекбокс-лист в выпадашке) ----
        if (f.type === 'dropdown-multiselect') {
          const opts = (typeof f.options === 'function') ? f.options(values) : (f.options || []);
          const val  = Array.isArray(values[f.name]) ? values[f.name] : [];
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ''}`}>
              {/* плавающий лейбл для единого стиля */}
              <div className={s.floatWrap}>
                <MultiSelectDropdown
                  options={opts}
                  value={val}
                  onChange={(arr)=> set(f.name, arr)}
                  placeholder={f.placeholder ? t(f.placeholder) : 'Не выбрано'}
                  selectAllLabel={f.selectAllLabel ? t(f.selectAllLabel) : 'Выбрать всех'}
                  clearLabel={f.clearLabel ? t(f.clearLabel) : 'Очистить'}
                  maxPreview={f.maxPreview ?? 3}
                  disabled={isDisabled(f)}
                />
                {f.float && <label className={s.floatLabel}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
              </div>
              {errors[f.name] && <div className={s.err}>{errors[f.name]}</div>}
            </div>
          );
        }

        // ---- dropdown-select (одиночный выпадающий список) ----
        if (f.type === "dropdown-select") {
          const opts = getOptions(f);
          const current = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              {!f.float && <label className={s.label}>{t(f.label)}</label>}
              <MultiSelectDropdown
                options={opts}
                value={current ? [current] : []}
                onChange={(next) => {
                  const first = Array.isArray(next) ? (next[0] ?? "") : "";
                  set(f.name, first);
                }}
                placeholder={f.placeholder ? t(f.placeholder) : t("common.select")}
                disabled={disabled}
                multiple={false}
                searchable={f.searchable ?? true}
                selectAll={false}
                clearAll={true}
              />
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // ---- multiselect (старый plain <select multiple>) ----
        if (f.type === "multiselect") {
          const valueArray = Array.isArray(v) ? v : [];
          const opts = getOptions(f);
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <div className={s.floatWrap}>
                <select
                  id={f.name}
                  name={f.name}
                  className={`${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`}
                  multiple
                  value={valueArray}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    set(f.name, selected);
                  }}
                  disabled={disabled}
                >
                  {renderSelectOptions(opts)}
                </select>
                {f.float && (
                  <label className={s.floatLabel} htmlFor={f.name}>
                    {t(f.label)}
                  </label>
                )}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // ---- select (одиночный/множественный через native <select>) ----
        if (f.type === "select") {
          const opts = getOptions(f);
          const m = f.type === "multiselect" || !!f.multiple;
          const valueProp = m
            ? (Array.isArray(v) ? v : (v ? [v] : []))
            : (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <div className={s.floatWrap}>
                <select
                  id={f.name}
                  name={f.name}
                  className={`${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`}
                  multiple={m}
                  value={valueProp}
                  onChange={(e) => {
                    if (m) {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                      set(f.name, selected);
                    } else {
                      set(f.name, e.target.value);
                    }
                  }}
                  disabled={disabled}
                >
                  {!m && f.placeholder && <option value="">{t(f.placeholder)}</option>}
                  {renderSelectOptions(opts)}
                </select>
                {f.float && (
                  <label className={s.floatLabel} htmlFor={f.name}>
                    {t(f.label)}
                  </label>
                )}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // ---- textarea ----
        if (f.type === "textarea") {
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <div className={s.floatWrap}>
                <textarea
                  id={f.name}
                  name={f.name}
                  className={`${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`}
                  value={v}
                  onChange={(e) => set(f.name, e.target.value)}
                  rows={f.rows || 4}
                  disabled={disabled}
                />
                {f.float && (
                  <label className={s.floatLabel} htmlFor={f.name}>
                    {t(f.label)}
                  </label>
                )}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // ---- text/date/datetime ----
        const inputType = mapInputType(f.type);
        return (
          <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
            <div className={s.floatWrap}>
              <input
                id={f.name}
                name={f.name}
                className={`${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`}
                type={inputType}
                value={v}
                onChange={(e) => set(f.name, e.target.value)}
                disabled={disabled}
                placeholder={f.float ? " " : (f.placeholder ? t(f.placeholder) : undefined)}
                {...(f.inputMode ? { inputMode: f.inputMode } : {})}
              />
              {f.float && (
                <label className={s.floatLabel} htmlFor={f.name}>
                  {t(f.label)}
                </label>
              )}
            </div>
            <div className={s.helpRow}>
              {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
              {cnt && <span className={s.counter}>{cnt}</span>}
            </div>
            {err && <div className={s.err}>{err}</div>}
          </div>
        );
      })}
    </div>
  );
}