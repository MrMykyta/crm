import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import HTMLEditor from "../../../inputs/HTMLEditor";

export default function HtmlEditorField({
  name,
  id,
  label,
  value,
  onChange,
  onValueChange,
  disabled = false,
  readOnly = false,
  required = false,
  error,
  helperText,
  description,
  className = "",
  inputClassName = "",
  fullWidth = true,
  size = "md",
  ...editorProps
}) {
  const fieldId = id || name;
  const strValue = value === undefined || value === null ? "" : String(value);
  const isDisabled = disabled || readOnly;

  const emit = (nextHtml) => {
    onValueChange?.(nextHtml);
    onChange?.(nextHtml, null);
  };

  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      description={description}
      helperText={helperText}
      error={error}
      disabled={disabled}
      readOnly={readOnly}
      fullWidth={fullWidth}
      size={size}
      isFilled={strValue !== ""}
      className={className}
    >
      <div className={inputClassName ? `${s.editorField} ${inputClassName}` : s.editorField}>
        <HTMLEditor
          value={strValue}
          onChange={emit}
          disabled={isDisabled}
          {...editorProps}
        />
      </div>
    </FieldShell>
  );
}
