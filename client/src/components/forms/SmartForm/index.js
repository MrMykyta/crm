import s from "./SmartForm.module.css";

export default function SmartForm({ values, errors={}, onChange, schema, i18n }) {
  const set = (name, val) => {
    const f = schema.find(x => x.name === name);
    let v = val;
    if (typeof v === "string") {
      if (f?.upper) v = v.toUpperCase();
      if (f?.max) v = v.slice(0, f.max);
    }
    onChange(name, v);
  };

  return (
    <div className={s.grid}>
      {schema.map((f, i) => {
        if (f.kind === "section") {
          return (
            <div key={"sec" + i} className={s.section}>
              <div className={s.sectionTitle}>{f.title}</div>
              {f.subtitle && <div className={s.sectionSub}>{f.subtitle}</div>}
            </div>
          );
        }

        const v = values[f.name] ?? "";
        const err = errors[f.name];
        const cnt = f.max ? `${String(v || "").length} / ${f.max}` : null;

        // checkbox — “как input”: нативный input + подпись справа
        if (f.type === "checkbox") {
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <label className={s.chkLine}>
                <input
                  type="checkbox"
                  checked={!!v}
                  onChange={(e) => set(f.name, e.target.checked)}
                />
                <span>{i18n.t(f.label)}</span>
              </label>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // общие атрибуты
        const common = {
          id: f.name,
          name: f.name,
          className: `${s.input} ${err ? s.invalid : ""} ${f.float ? s.float : ""}`,
          value: v,
          onChange: (e) => set(f.name, e.target.value),
          ...(f.inputMode ? { inputMode: f.inputMode } : {}),
        };

        // select с floating label
        if (f.type === "select") {
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <div className={s.floatWrap}>
                <select {...common}>
                  {f.options.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.labelKey ? i18n.t(opt.labelKey) : (opt.label ?? opt.value)}
                    </option>
                  ))}
                </select>
                {f.float && (
                  <label className={s.floatLabel} htmlFor={f.name}>
                    {i18n.t(f.label)}
                  </label>
                )}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{f.hint}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // textarea
        if (f.type === "textarea") {
          return (
            <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
              <div className={s.floatWrap}>
                <textarea {...common} rows={f.rows || 4} />
                {f.float && (
                  <label className={s.floatLabel} htmlFor={f.name}>
                    {i18n.t(f.label)}
                  </label>
                )}
              </div>
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{f.hint}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // text (по умолчанию)
        return (
          <div key={f.name} className={`${s.field} ${f.full ? s.full : ""}`}>
            <div className={s.floatWrap}>
              <input
                {...common}
                placeholder={f.float ? " " : (f.placeholder ? i18n.t(f.placeholder) : undefined)}
              />
              {f.float && (
                <label className={s.floatLabel} htmlFor={f.name}>
                  {i18n.t(f.label)}
                </label>
              )}
            </div>
            <div className={s.helpRow}>
              {f.hint && <span className={s.hint}>{f.hint}</span>}
              {cnt && <span className={s.counter}>{cnt}</span>}
            </div>
            {err && <div className={s.err}>{err}</div>}
          </div>
        );
      })}
    </div>
  );
}