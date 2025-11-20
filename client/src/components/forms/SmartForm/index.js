import React from "react";
import s from "./SmartForm.module.css";
import MultiSelectDropdown from "../../inputs/MultiSelectDropdown";
import ThemedSelect from "../../inputs/RadixSelect";

/**
 * SmartForm — универсальный рендерер полей (4-колоночная сетка).
 * Поддержка:
 *  - f.cols: 1..4 (по умолчанию 2) — ширина в колонках
 *  - kind:'spacer' с optional cols — пустая ячейка для выравнивания
 *  - f.showIf, f.disabled, f.options (массив|функция), float-label и т.д.
 */
export default function SmartForm({ values, errors = {}, onChange, schema, i18n }) {
  const t = (k) => (typeof k === "string" ? i18n?.t?.(k) ?? k : k);

  const mapInputType = (fType) => (fType === "date" ? "date" : fType === "datetime" ? "datetime-local" : "text");

  const isVisible = (f) => (typeof f.showIf === "function" ? !!f.showIf(values) : f.showIf !== false);
  const isDisabled = (f) => (typeof f.disabled === "function" ? !!f.disabled(values) : !!f.disabled);

  const fmtLocalDT = (d) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // options normalizer
  const rawOptions = (f) => (typeof f.options === "function" ? f.options(values) : f.options);
  const normalizeOptions = (f) => {
    const arr = Array.isArray(rawOptions(f)) ? rawOptions(f) : [];
    return arr
      .map((o) => {
        if (typeof o === "string") return { value: String(o), label: t(o) };
        const value = o?.value != null ? String(o.value) : "";
        const label = o?.labelKey ? t(o.labelKey) : t(o?.label ?? o?.value ?? "");
        return { value, label };
      })
      .filter((o) => o.value !== "");
  };

  const set = (name, val) => {
    const f = schema.find((x) => x.name === name);
    let v = val;
    if (typeof v === "string") {
      if (f?.upper) v = v.toUpperCase();
      if (f?.max) v = v.slice(0, f.max);
    }

    // UX helpers для даты
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

  const cellSpan = (f) => {
    if (f.full) return 4;
    const span = Number.isFinite(f?.cols) ? Math.max(1, Math.min(4, f.cols)) : 2; // дефолт: половина
    return span;
  };

  return (
    <div className={s.grid}>
      {visibleSchema.map((f, i) => {
        // SECTION
        if (f.kind === "section") {
          return (
            <div key={"sec" + i} className={`${s.section} ${s.fullLine}`}>
              <div className={s.sectionTitle}>{t(f.title)}</div>
              {f.subtitle && <div className={s.sectionSub}>{t(f.subtitle)}</div>}
            </div>
          );
        }

        // SPACER
        if (f.kind === "spacer") {
          const span = cellSpan(f);
          return <div key={"sp" + i} style={{ gridColumn: `span ${span}` }} className={`${f.className || ""}`} />;
        }

        const span = cellSpan(f);
        const wrapProps = { style: { gridColumn: `span ${span}` } };

        const isMulti = f.type === "multiselect" || !!f.multiple;
        const v = values[f.name] ?? (isMulti ? [] : "");
        const err = errors[f.name];
        const cnt = f.max && typeof v === "string" ? `${v.length} / ${f.max}` : null;
        const disabled = isDisabled(f);

        // CHECKBOX
        if (f.type === "checkbox") {
          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              <label className={s.chkLine}>
                <input type="checkbox" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} disabled={disabled} />
                <span>{t(f.label)}</span>
              </label>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // DROPDOWN-MULTISELECT
        if (f.type === "dropdown-multiselect" || f.type === "multiselect") {
          const opts = normalizeOptions(f);
          const valueArray = Array.isArray(v) ? v.map(String) : [];
          const hasValue = valueArray.length > 0;

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              <div className={`${s.floatWrap} ${hasValue ? s.isFilled : ""}`}>
                <MultiSelectDropdown
                  options={opts}
                  value={valueArray}
                  onChange={(arr) => set(f.name, arr)}
                  placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : "Не выбрано"}
                  maxPreview={f.maxPreview ?? 3}
                  disabled={disabled}
                  className="asInput"
                />
                {f.float && <label className={s.floatLabel}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // DROPDOWN-SELECT (single)
        if (f.type === "dropdown-select" || (f.type === "select" && !f.multiple)) {
          const opts = normalizeOptions(f);
          const current = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
          const hasValue = !!current;

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              {f.float ? (
                <div className={`${s.floatWrap} ${hasValue ? s.isFilled : ""}`}>
                  <ThemedSelect
                    options={opts}
                    value={current || ""}
                    onChange={(next) => set(f.name, next)}
                    placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : t("common.select")}
                    disabled={disabled}
                    className="asInput"
                  />
                  <label className={s.floatLabel}>{t(f.label)}</label>
                </div>
              ) : (
                <>
                  <label className={s.label}>{t(f.label)}</label>
                  <ThemedSelect
                    options={opts}
                    value={current || ""}
                    onChange={(next) => set(f.name, next)}
                    placeholder={f.placeholder ? t(f.placeholder) : t("common.select")}
                    disabled={disabled}
                  />
                </>
              )}
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // SELECT multiple → MultiSelectDropdown
        if (f.type === "select" && f.multiple) {
          const opts = normalizeOptions(f);
          const valueArray = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
          const hasValue = valueArray.length > 0;

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              <div className={`${s.floatWrap} ${hasValue ? s.isFilled : ""}`}>
                <MultiSelectDropdown
                  options={opts}
                  value={valueArray}
                  onChange={(arr) => set(f.name, arr)}
                  placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : "Не выбрано"}
                  maxPreview={f.maxPreview ?? 3}
                  disabled={isDisabled(f)}
                  className="asInput"
                />
                {f.float && <label className={s.floatLabel} htmlFor={f.name}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // TEXTAREA
        if (f.type === "textarea") {
          return (
            <div key={f.name} {...wrapProps} className={s.field}>
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
                {f.float && <label className={s.floatLabel} htmlFor={f.name}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // INPUT (text/date/datetime)
        const inputType = mapInputType(f.type);
        return (
          <div key={f.name} {...wrapProps} className={s.field}>
            <div className={s.floatWrap}>
              <input
                id={f.name}
                name={f.name}
                className={`${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`}
                type={inputType}
                value={v}
                onChange={(e) => set(f.name, e.target.value)}
                disabled={disabled}
                placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : undefined}
                {...(f.inputMode ? { inputMode: f.inputMode } : {})}
              />
              {f.float && <label className={s.floatLabel} htmlFor={f.name}>{t(f.label)}</label>}
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