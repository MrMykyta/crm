import React from "react";
import s from "./SmartForm.module.css";
import MultiSelectDropdown from "../../inputs/MultiSelectDropdown";
import ThemedSelect from "../../inputs/RadixSelect";
import AutocompleteSelect from "../../shared/AutocompleteSelect";
import DateTimePicker from "../../inputs/DateTimePicker";

/**
 * SmartForm — универсальный рендерер полей (4-колоночная сетка).
 * Поддержка:
 *  - f.cols: 1..4 (по умолчанию 2) — ширина в колонках
 *  - kind:'spacer' с optional cols — пустая ячейка для выравнивания
 *  - f.showIf, f.disabled, f.options (массив|функция), float-label и т.д.
 */
export default function SmartForm({ values, errors = {}, onChange, schema, i18n, className = "", variant = "" }) {
    // t: вспомогательная логика компонента.
const t = (k) => (typeof k === "string" ? i18n?.t?.(k) ?? k : k);
  const [autocompleteQueries, setAutocompleteQueries] = React.useState({});
  const [dropdownOpenMap, setDropdownOpenMap] = React.useState({});
  const [autocompleteCreateBusy, setAutocompleteCreateBusy] = React.useState({});
  const [autocompleteLocalErrors, setAutocompleteLocalErrors] = React.useState({});
  const [autocompleteDeleteBusy, setAutocompleteDeleteBusy] = React.useState({});
  const [autocompleteEditBusy, setAutocompleteEditBusy] = React.useState({});
  const [autocompleteClearBusy, setAutocompleteClearBusy] = React.useState({});
  const [selectedMenuOpenMap, setSelectedMenuOpenMap] = React.useState({});
  const [collapsedSections, setCollapsedSections] = React.useState({});

  React.useEffect(() => {
        // onDocMouseDown: вспомогательная логика компонента.
const onDocMouseDown = (event) => {
      const target = event?.target;
      if (target && typeof target.closest === "function" && target.closest('[data-ref-menu-wrap="1"]')) {
        return;
      }
      setSelectedMenuOpenMap({});
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

    // mapInputType: преобразует данные в формат компонента.
const mapInputType = (fType) => (fType === "date" ? "date" : fType === "datetime" ? "datetime-local" : "text");

    // isVisible: проверяет условие для UI-логики.
const isVisible = (f) => (typeof f.showIf === "function" ? !!f.showIf(values) : f.showIf !== false);
    // isDisabled: проверяет условие для UI-логики.
const isDisabled = (f) => (typeof f.disabled === "function" ? !!f.disabled(values) : !!f.disabled);
  const sectionKeyOf = React.useCallback((f, idx) => String(f?.key || f?.title || `section-${idx}`), []);

    // fmtLocalDT: вспомогательная логика компонента.
const fmtLocalDT = (d) => {
        // pad: вспомогательная логика компонента.
const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // options normalizer
  const rawOptions = (f) => (typeof f.options === "function" ? f.options(values) : f.options);
    // normalizeOptions: нормализует данные для отображения и ввода.
const normalizeOptions = (f) => {
    const arr = Array.isArray(rawOptions(f)) ? rawOptions(f) : [];
    return arr
      .map((o) => {
        if (typeof o === "string") return { value: String(o), label: t(o) };
        const value = o?.value != null ? String(o.value) : "";
        const label = o?.labelKey ? t(o.labelKey) : t(o?.label ?? o?.value ?? "");
        const secondary = o?.secondary ?? null;
        return { ...o, value, label, secondary };
      })
      .filter((o) => o.value !== "");
  };

    // normalizeHumanText: нормализует данные для отображения и ввода.
const normalizeHumanText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // set: обновляет состояние компонента.
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

  const sectionMeta = React.useMemo(
    () => (Array.isArray(schema) ? schema : [])
      .map((f, idx) => ({ f, idx }))
      .filter(({ f }) => f?.kind === "section")
      .map(({ f, idx }) => ({
        key: sectionKeyOf(f, idx),
        defaultCollapsed: Boolean(f.defaultCollapsed),
      })),
    [schema, sectionKeyOf]
  );

  React.useEffect(() => {
    setCollapsedSections((prev) => {
      const next = {};
      sectionMeta.forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(prev, item.key)) {
          next[item.key] = prev[item.key];
        } else {
          next[item.key] = item.defaultCollapsed;
        }
      });
      return next;
    });
  }, [sectionMeta]);

  const visibleSchema = (() => {
    const out = [];
    let currentSectionKey = "";

    (Array.isArray(schema) ? schema : []).forEach((f, idx) => {
      if (f?.kind === "section") {
        const sectionKey = sectionKeyOf(f, idx);
        currentSectionKey = sectionKey;
        out.push({ ...f, __sectionKey: sectionKey });
        return;
      }
      if (!isVisible(f)) return;
      if (currentSectionKey && collapsedSections[currentSectionKey]) return;
      out.push(f);
    });

    return out;
  })();

    // cellSpan: вспомогательная логика компонента.
const cellSpan = (f) => {
    if (f.full) return 4;
    const span = Number.isFinite(f?.cols) ? Math.max(1, Math.min(4, f.cols)) : 2; // дефолт: половина
    return span;
  };

  return (
    <div
      className={`${s.grid} ${variant === "productDetail" ? s.gridProductDetail : ""} ${className}`.trim()}
      data-autocomplete-boundary="1"
    >
      {visibleSchema.map((f, i) => {
        // SECTION
        if (f.kind === "section") {
          const sectionKey = f.__sectionKey || sectionKeyOf(f, i);
          const isCollapsible = Boolean(f.collapsible);
          const isCollapsed = Boolean(collapsedSections[sectionKey]);
          const isPrimarySection = String(f?.emphasis || "") === "primary";
          const sectionClassName = `${s.section} ${s.fullLine} ${variant === "productDetail" ? s.sectionProductDetail : ""}`;
          const sectionTitleClass = `${s.sectionTitle} ${isPrimarySection ? s.sectionTitlePrimary : ""}`;
          return (
            <div key={"sec" + i} className={sectionClassName}>
              {isCollapsible ? (
                <button
                  type="button"
                  className={`${s.sectionToggle} ${variant === "productDetail" ? s.sectionToggleCompact : ""} ${isPrimarySection ? s.sectionTogglePrimary : s.sectionToggleSecondary} ${isCollapsed ? s.sectionToggleCollapsed : s.sectionToggleExpanded}`}
                  onClick={() => setCollapsedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                  aria-expanded={!isCollapsed}
                >
                  <span className={s.sectionToggleText}>
                    <span className={sectionTitleClass}>{t(f.title)}</span>
                    {f.subtitle ? <span className={s.sectionSub}>{t(f.subtitle)}</span> : null}
                  </span>
                  <span
                    className={`${s.sectionToggleIcon} ${isCollapsed ? s.sectionToggleIconCollapsed : s.sectionToggleIconExpanded}`}
                    aria-hidden
                  >
                    ▸
                  </span>
                </button>
              ) : (
                <>
                  <div className={sectionTitleClass}>{t(f.title)}</div>
                  {f.subtitle && <div className={s.sectionSub}>{t(f.subtitle)}</div>}
                </>
              )}
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

        if (f.type === "date-or-datetime") {
          const hasTimeField = f.hasTimeField;
          const hasTime = Boolean(values?.[hasTimeField]);
          const valueText = String(v || "");
          const locale = i18n?.language || "ru-RU";

                    // handleWithTimeToggle: обработчик пользовательского действия.
const handleWithTimeToggle = (nextHasTime) => {
            onChange(hasTimeField, nextHasTime);
            const raw = String(values?.[f.name] || "").trim();
            if (!raw) return;
            if (nextHasTime) {
              if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                onChange(f.name, `${raw}T00:00`);
              }
              return;
            }
            onChange(f.name, raw.slice(0, 10));
          };

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              <div className={s.labelRow}>
                <label className={s.label}>{t(f.label)}</label>
              </div>

              <DateTimePicker
                id={f.name}
                className={`${s.input} ${err ? s.invalid : ""}`}
                value={valueText}
                withTime={hasTime}
                allowTimeToggle={Boolean(hasTimeField)}
                onWithTimeChange={handleWithTimeToggle}
                timeToggleLabel={t("crm.task.fields.withTime", "Со временем")}
                onChange={(nextValue) => set(f.name, nextValue)}
                disabled={disabled}
                locale={locale}
                placeholder={hasTime ? "дд.мм.гггг чч:мм" : "дд.мм.гггг"}
              />
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // DROPDOWN-MULTISELECT
        if (f.type === "dropdown-multiselect" || f.type === "multiselect") {
          const opts = normalizeOptions(f);
          const valueArray = Array.isArray(v) ? v.map(String) : [];
          const hasValue = valueArray.length > 0 || !!dropdownOpenMap[f.name];

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
                  onOpenChange={(isOpen) =>
                    setDropdownOpenMap((prev) => ({ ...prev, [f.name]: !!isOpen }))
                  }
                />
                {f.float && <label className={s.floatLabel}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        if (f.type === "dropdown-select-search") {
          const opts = normalizeOptions(f);
          const current = Array.isArray(v) ? String(v[0] || "") : String(v || "");
          const hasValue = !!current || !!dropdownOpenMap[f.name];

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              <div className={`${s.floatWrap} ${hasValue ? s.isFilled : ""}`}>
                <MultiSelectDropdown
                  options={opts}
                  value={current ? [current] : []}
                  onChange={(arr) => set(f.name, Array.isArray(arr) ? String(arr[0] || "") : "")}
                  placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : "Не выбрано"}
                  disabled={disabled}
                  className="asInput"
                  filterable
                  single
                  onOpenChange={(isOpen) =>
                    setDropdownOpenMap((prev) => ({ ...prev, [f.name]: !!isOpen }))
                  }
                />
                {f.float && <label className={s.floatLabel}>{t(f.label)}</label>}
              </div>
              <div className={s.helpRow}>{f.hint && <span className={s.hint}>{t(f.hint)}</span>}</div>
              {err && <div className={s.err}>{err}</div>}
            </div>
          );
        }

        // DROPDOWN-SELECT (single)
        if (f.type === "autocomplete-select") {
          const opts = normalizeOptions(f);
          const current = Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
          const selected = opts.find((opt) => String(opt.value) === String(current)) || null;
          const localErr = autocompleteLocalErrors[f.name];
          const createBusy = Boolean(autocompleteCreateBusy[f.name]);

          const queryState = autocompleteQueries[f.name];
          const query = queryState !== undefined ? queryState : (selected?.label || "");
          const hasDisplayValue = Boolean(String(current || "").trim() || String(query || "").trim());
          const q = String(query || "").trim().toLowerCase();
          const filtered = q
            ? opts.filter((opt) => {
                const haystack = `${opt.label || ""} ${opt.secondary || ""}`.toLowerCase();
                return haystack.includes(q);
              })
            : opts.slice(0, 50);

          const acOptions = filtered.map((opt) => ({
            id: opt.value,
            name: opt.label,
            secondary: opt.secondary,
          }));

          const normalizedQuery = normalizeHumanText(query);
          const hasExactMatch = opts.some((opt) => normalizeHumanText(opt.label) === normalizedQuery);
          const allowCreate = Boolean(f.allowCreate && normalizedQuery && !hasExactMatch);

                    // runCreate: вспомогательная логика компонента.
const runCreate = async () => {
            if (!allowCreate || !f.onCreateOption || createBusy || disabled) return;
            try {
              setAutocompleteCreateBusy((prev) => ({ ...prev, [f.name]: true }));
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
              const created = await f.onCreateOption(String(query || "").trim(), { values, field: f });
              if (!created) return;
              const nextValue = String(created?.value ?? created?.id ?? "");
              const nextLabel = String((created?.label ?? created?.name ?? query) || "");
              if (!nextValue) return;
              set(f.name, nextValue);
              setAutocompleteQueries((prev) => ({ ...prev, [f.name]: nextLabel }));
              if (typeof f.onSearchChange === "function") {
                f.onSearchChange(nextLabel);
              }
            } catch (e) {
              const msg = e?.data?.error || e?.data?.message || e?.message || t("common.error", "Ошибка");
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: msg }));
            } finally {
              setAutocompleteCreateBusy((prev) => ({ ...prev, [f.name]: false }));
            }
          };

                    // runDelete: вспомогательная логика компонента.
const runDelete = async (opt) => {
            if (!f.onDeleteOption || disabled) return;
            const optionKey = String(opt?.id ?? opt?.value ?? "");
            if (!optionKey) return;

            try {
              setAutocompleteDeleteBusy((prev) => ({ ...prev, [f.name]: optionKey }));
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
              await f.onDeleteOption(opt, { values, field: f });

              if (String(current || "") === optionKey) {
                set(f.name, "");
                setAutocompleteQueries((prev) => ({ ...prev, [f.name]: "" }));
                if (typeof f.onSearchChange === "function") {
                  f.onSearchChange("");
                }
              }
            } catch (e) {
              const msg = e?.data?.error || e?.data?.message || e?.message || t("common.error", "Ошибка");
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: msg }));
            } finally {
              setAutocompleteDeleteBusy((prev) => ({ ...prev, [f.name]: "" }));
            }
          };

                    // runEdit: вспомогательная логика компонента.
const runEdit = async (opt) => {
            if (!f.onEditOption || disabled) return;
            const optionKey = String(opt?.id ?? opt?.value ?? "");
            if (!optionKey) return;

            try {
              setAutocompleteEditBusy((prev) => ({ ...prev, [f.name]: optionKey }));
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
              const edited = await f.onEditOption(opt, { values, field: f });

              const nextValue = String(edited?.value ?? edited?.id ?? optionKey);
              const nextLabel = String(edited?.label ?? edited?.name ?? opt?.name ?? opt?.label ?? "");

              if (String(current || "") === optionKey && nextValue) {
                set(f.name, nextValue);
                if (nextLabel) {
                  setAutocompleteQueries((prev) => ({ ...prev, [f.name]: nextLabel }));
                  if (typeof f.onSearchChange === "function") {
                    f.onSearchChange(nextLabel);
                  }
                }
              }
            } catch (e) {
              const msg = e?.data?.error || e?.data?.message || e?.message || t("common.error", "Ошибка");
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: msg }));
            } finally {
              setAutocompleteEditBusy((prev) => ({ ...prev, [f.name]: "" }));
            }
          };

                    // runClear: вспомогательная логика компонента.
const runClear = async () => {
            if (!String(current || '').trim()) return;
            try {
              setAutocompleteClearBusy((prev) => ({ ...prev, [f.name]: true }));
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
              if (typeof f.onClearOption === "function") {
                const allowed = await f.onClearOption(selected, { values, field: f });
                if (allowed === false) return;
              }
              set(f.name, "");
              setAutocompleteQueries((prev) => ({ ...prev, [f.name]: "" }));
              if (typeof f.onSearchChange === "function") {
                f.onSearchChange("");
              }
            } catch (e) {
              const msg = e?.data?.error || e?.data?.message || e?.message || t("common.error", "Ошибка");
              setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: msg }));
            } finally {
              setAutocompleteClearBusy((prev) => ({ ...prev, [f.name]: false }));
            }
          };

                    // runReplace: вспомогательная логика компонента.
const runReplace = () => {
            set(f.name, "");
            setAutocompleteQueries((prev) => ({ ...prev, [f.name]: "" }));
            if (typeof f.onSearchChange === "function") {
              f.onSearchChange("");
            }
          };

          const showSelectedActions = Boolean(f.showSelectedActions && selected);
          const useMenuActions = Boolean(showSelectedActions && f.selectedActionsMenu);
          const showInlineOpenAction = Boolean(f.inlineOpenAction && selected && typeof f.onOpenSelected === "function");
          const menuOpen = Boolean(selectedMenuOpenMap[f.name]);
          const selectedLabel = String(selected?.label || selected?.name || "");

          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              {f.float ? (
                <div className={`${s.floatWrap} ${hasDisplayValue ? s.isFilled : ""}`}>
                  <div className={s.autoInlineRow}>
                    <AutocompleteSelect
                      value={selected ? { id: selected.value, name: selected.label } : null}
                      inputValue={query}
                      onInputChange={(nextText) => {
                        setAutocompleteQueries((prev) => ({ ...prev, [f.name]: nextText }));
                        if (autocompleteLocalErrors[f.name]) {
                          setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
                        }
                        if (typeof f.onSearchChange === "function") {
                          f.onSearchChange(nextText);
                        }
                        if (selected && String(nextText || "").trim() !== String(selected.label || "").trim()) {
                          set(f.name, "");
                        }
                      }}
                      options={acOptions}
                      onSelect={(opt) => {
                        if (!opt) return;
                        set(f.name, String(opt.id));
                        setAutocompleteQueries((prev) => ({ ...prev, [f.name]: opt.name || "" }));
                      }}
                      placeholder={f.float ? " " : f.placeholder ? t(f.placeholder) : t("common.select")}
                      hint={t("crm.task.messages.typeToSearch", "Начните вводить название")}
                      searchingLabel={t("crm.task.messages.searching", "Поиск...")}
                      emptyLabel={t("crm.task.messages.empty", "Ничего не найдено")}
                      loading={Boolean(f.loading)}
                      disabled={disabled}
                      inputClassName={s.input}
                      opaque
                      showCreateAction={allowCreate}
                      createActionLabel={
                        typeof f.createActionLabel === "function"
                          ? f.createActionLabel(String(query || "").trim())
                          : `Создать «${String(query || "").trim()}»`
                      }
                      createActionLoading={createBusy}
                      onCreateAction={runCreate}
                      canDeleteOption={(opt) => (typeof f.canDeleteOption === "function" ? f.canDeleteOption(opt) : false)}
                      onDeleteOption={runDelete}
                      deletingOptionKey={autocompleteDeleteBusy[f.name] || null}
                      canEditOption={(opt) => (typeof f.canEditOption === "function" ? f.canEditOption(opt) : false)}
                      onEditOption={runEdit}
                      editingOptionKey={autocompleteEditBusy[f.name] || null}
                    />
                    {showInlineOpenAction ? (
                      <button
                        type="button"
                        className={s.inlineOpenBtn}
                        onClick={() => f.onOpenSelected({ selected, values, field: f })}
                        aria-label={t("common.open", "Открыть")}
                        title={t("common.open", "Открыть")}
                      >
                        ↗
                      </button>
                    ) : null}
                  </div>
                  <label className={s.floatLabel}>{t(f.label)}</label>
                </div>
              ) : (
                <>
                  <label className={s.label}>{t(f.label)}</label>
                  <div className={s.autoInlineRow}>
                    <AutocompleteSelect
                      value={selected ? { id: selected.value, name: selected.label } : null}
                      inputValue={query}
                      onInputChange={(nextText) => {
                        setAutocompleteQueries((prev) => ({ ...prev, [f.name]: nextText }));
                        if (autocompleteLocalErrors[f.name]) {
                          setAutocompleteLocalErrors((prev) => ({ ...prev, [f.name]: "" }));
                        }
                        if (typeof f.onSearchChange === "function") {
                          f.onSearchChange(nextText);
                        }
                        if (selected && String(nextText || "").trim() !== String(selected.label || "").trim()) {
                          set(f.name, "");
                        }
                      }}
                      options={acOptions}
                      onSelect={(opt) => {
                        if (!opt) return;
                        set(f.name, String(opt.id));
                        setAutocompleteQueries((prev) => ({ ...prev, [f.name]: opt.name || "" }));
                      }}
                      placeholder={f.placeholder ? t(f.placeholder) : t("common.select")}
                      hint={t("crm.task.messages.typeToSearch", "Начните вводить название")}
                      searchingLabel={t("crm.task.messages.searching", "Поиск...")}
                      emptyLabel={t("crm.task.messages.empty", "Ничего не найдено")}
                      loading={Boolean(f.loading)}
                      disabled={disabled}
                      inputClassName={s.input}
                      opaque
                      showCreateAction={allowCreate}
                      createActionLabel={
                        typeof f.createActionLabel === "function"
                          ? f.createActionLabel(String(query || "").trim())
                          : `Создать «${String(query || "").trim()}»`
                      }
                      createActionLoading={createBusy}
                      onCreateAction={runCreate}
                      canDeleteOption={(opt) => (typeof f.canDeleteOption === "function" ? f.canDeleteOption(opt) : false)}
                      onDeleteOption={runDelete}
                      deletingOptionKey={autocompleteDeleteBusy[f.name] || null}
                      canEditOption={(opt) => (typeof f.canEditOption === "function" ? f.canEditOption(opt) : false)}
                      onEditOption={runEdit}
                      editingOptionKey={autocompleteEditBusy[f.name] || null}
                    />
                    {showInlineOpenAction ? (
                      <button
                        type="button"
                        className={s.inlineOpenBtn}
                        onClick={() => f.onOpenSelected({ selected, values, field: f })}
                        aria-label={t("common.open", "Открыть")}
                        title={t("common.open", "Открыть")}
                      >
                        ↗
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              {(err || localErr) && <div className={s.err}>{err || localErr}</div>}
              {useMenuActions ? (
                <div className={s.refMenuWrap} data-ref-menu-wrap="1">
                  <div className={s.refSelectedMeta}>
                    <span className={s.refSelectedLabel}>{selectedLabel || "Выбрано"}</span>
                    {selected?.secondary ? (
                      <span className={s.refSelectedSecondary}>{String(selected.secondary)}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={s.refMenuToggle}
                    onClick={() => {
                      setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: !prev[f.name] }));
                    }}
                    aria-expanded={menuOpen}
                    aria-label={t("common.actions", "Действия")}
                  >
                    ⋯
                  </button>
                  {menuOpen ? (
                    <div className={s.refMenu}>
                      {typeof f.onOpenSelected === "function" ? (
                        <button
                          type="button"
                          className={s.refMenuItem}
                          onClick={() => {
                            f.onOpenSelected({ selected, values, field: f });
                            setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: false }));
                          }}
                        >
                          Открыть
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={s.refMenuItem}
                        onClick={() => {
                          runReplace();
                          setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: false }));
                        }}
                      >
                        Заменить
                      </button>
                      {typeof f.onEditOption === "function" ? (
                        <button
                          type="button"
                          className={s.refMenuItem}
                          onClick={() => {
                            runEdit({ id: selected.value, name: selected.label });
                            setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: false }));
                          }}
                          disabled={Boolean(autocompleteEditBusy[f.name])}
                        >
                          {autocompleteEditBusy[f.name] ? "Переименование..." : "Переименовать"}
                        </button>
                      ) : null}
                      {typeof f.onOpenManager === "function" ? (
                        <button
                          type="button"
                          className={s.refMenuItem}
                          onClick={() => {
                            f.onOpenManager({ selected, values, field: f });
                            setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: false }));
                          }}
                        >
                          Управление
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${s.refMenuItem} ${s.refMenuItemDanger}`}
                        onClick={async () => {
                          await runClear();
                          setSelectedMenuOpenMap((prev) => ({ ...prev, [f.name]: false }));
                        }}
                        disabled={Boolean(autocompleteClearBusy[f.name])}
                      >
                        {autocompleteClearBusy[f.name] ? "Отвязка..." : "Отвязать"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : showSelectedActions ? (
                <div className={s.refActions}>
                  <button
                    type="button"
                    className={s.refActionBtn}
                    onClick={runReplace}
                    disabled={Boolean(autocompleteClearBusy[f.name])}
                  >
                    Заменить
                  </button>
                  {typeof f.onEditOption === "function" ? (
                    <button
                      type="button"
                      className={s.refActionBtn}
                      onClick={() => runEdit({ id: selected.value, name: selected.label })}
                      disabled={Boolean(autocompleteEditBusy[f.name])}
                    >
                      {autocompleteEditBusy[f.name] ? "..." : "Переименовать"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`${s.refActionBtn} ${s.refActionDanger}`}
                    onClick={runClear}
                    disabled={Boolean(autocompleteClearBusy[f.name])}
                  >
                    {autocompleteClearBusy[f.name] ? "..." : "Отвязать"}
                  </button>
                  {typeof f.onOpenManager === "function" ? (
                    <button
                      type="button"
                      className={s.refActionBtn}
                      onClick={() => f.onOpenManager({ selected, values, field: f })}
                    >
                      Управление
                    </button>
                  ) : null}
                </div>
              ) : null}
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
          const hasValue = valueArray.length > 0 || !!dropdownOpenMap[f.name];

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
                  onOpenChange={(isOpen) =>
                    setDropdownOpenMap((prev) => ({ ...prev, [f.name]: !!isOpen }))
                  }
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

        if (f.type === "date" || f.type === "datetime") {
          const hasValue = Boolean(String(v || "").trim());
          const withTime = f.type === "datetime";
          return (
            <div key={f.name} {...wrapProps} className={s.field}>
              {f.float ? (
                <div className={`${s.floatWrap} ${hasValue ? s.isFilled : ""}`}>
                  <DateTimePicker
                    id={f.name}
                    value={String(v || "")}
                    withTime={withTime}
                    className={`${s.input} ${err ? s.invalid : ""}`}
                    onChange={(nextValue) => set(f.name, nextValue)}
                    disabled={disabled}
                    placeholder={f.float ? " " : (f.placeholder ? t(f.placeholder) : undefined)}
                  />
                  <label className={s.floatLabel} htmlFor={f.name}>{t(f.label)}</label>
                </div>
              ) : (
                <>
                  <label className={s.label}>{t(f.label)}</label>
                  <DateTimePicker
                    id={f.name}
                    value={String(v || "")}
                    withTime={withTime}
                    className={`${s.input} ${err ? s.invalid : ""}`}
                    onChange={(nextValue) => set(f.name, nextValue)}
                    disabled={disabled}
                    placeholder={f.placeholder ? t(f.placeholder) : undefined}
                  />
                </>
              )}
              <div className={s.helpRow}>
                {f.hint && <span className={s.hint}>{t(f.hint)}</span>}
                {cnt && <span className={s.counter}>{cnt}</span>}
              </div>
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

