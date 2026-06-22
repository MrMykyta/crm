// ui/fields/fieldUtils — мелкие хелперы для field-компонентов.
// Без внешних зависимостей (clsx не является прямой зависимостью проекта).

// cx: безопасно склеивает classNames (falsy игнорируются).
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// toInputValue: безопасное приведение value к строке для controlled input.
// undefined/null -> "" (чтобы input не стал uncontrolled).
export function toInputValue(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

// getFieldIds: детерминированные id для aria-describedby.
// FieldShell и сам контрол выводят их из одного id одинаково.
export function getFieldIds(id) {
  const base = id ? String(id) : null;
  return {
    controlId: base || undefined,
    descriptionId: base ? `${base}-desc` : undefined,
    helperId: base ? `${base}-help` : undefined,
    errorId: base ? `${base}-error` : undefined,
  };
}

// buildDescribedBy: собирает aria-describedby из реально присутствующих блоков.
export function buildDescribedBy(id, { hasDescription, hasHelper, hasError }) {
  if (!id) return undefined;
  const ids = getFieldIds(id);
  const list = [
    hasDescription ? ids.descriptionId : null,
    hasHelper ? ids.helperId : null,
    hasError ? ids.errorId : null,
  ].filter(Boolean);
  return list.length ? list.join(" ") : undefined;
}
