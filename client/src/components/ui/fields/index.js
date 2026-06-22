// ui/fields — единая библиотека form field компонентов (Phase 1).
// Новые формы должны использовать только эти компоненты.
// Существующие формы мигрируются позже отдельными фазами.

export { default as FieldShell } from "./FieldShell";
export { default as TextField } from "./TextField";
export { default as TextareaField } from "./TextareaField";
export { default as NumberField } from "./NumberField";
export { default as CheckboxField } from "./CheckboxField";
export { default as SelectField } from "./SelectField";
export { default as AutocompleteField } from "./AutocompleteField";
export { default as FieldsGrid } from "./FieldsGrid";
export { default as FormSection } from "./FormSection";

// Phase 1B — расширение библиотеки
export { default as PasswordField } from "./PasswordField";
export { default as EmailField } from "./EmailField";
export { default as PhoneField } from "./PhoneField";
export { default as UrlField } from "./UrlField";
export { default as CurrencyField } from "./CurrencyField";
export { default as PercentField } from "./PercentField";
export { default as DateField } from "./DateField";
export { default as TimeField } from "./TimeField";
export { default as DateTimeField } from "./DateTimeField";
export { default as FileField } from "./FileField";
export { default as CountryField } from "./CountryField";
export { default as FormActions } from "./FormActions";

// хелперы (для построения новых полей в Phase 1B)
export { cx, toInputValue, getFieldIds, buildDescribedBy } from "./fieldUtils";
