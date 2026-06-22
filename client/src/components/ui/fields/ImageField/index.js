import FieldShell from "../FieldShell";
import s from "../fields.module.css";
import ImagePicker from "../../../inputs/ImagePicker";

export default function ImageField({
  name,
  id,
  label,
  value,
  uploader,
  urlUploader,
  pickerLabel,
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
  ...imagePickerProps
}) {
  const fieldId = id || name;
  const strValue = value === undefined || value === null ? "" : String(value);
  const isDisabled = disabled || readOnly;

  const emit = (nextUrl) => {
    onValueChange?.(nextUrl);
    onChange?.(nextUrl, null);
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
      <div className={inputClassName ? `${s.imageField} ${inputClassName}` : s.imageField}>
        <ImagePicker
          value={strValue}
          onChange={emit}
          uploader={uploader}
          urlUploader={urlUploader}
          disabled={isDisabled}
          label={pickerLabel}
          {...imagePickerProps}
        />
      </div>
    </FieldShell>
  );
}
