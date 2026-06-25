import React from "react";
import { useTranslation } from "react-i18next";
import SelectField from "../SelectField";
import s from "../fields.module.css";

const VISIBILITY_VALUES = ["private", "company", "department"];

function normalizeDepartmentId(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function departmentLabel(department) {
  return department?.name || department?.code || department?.title || department?.id || "";
}

function isActiveDepartment(department) {
  return department && department.isActive !== false && department.deletedAt == null && department.deleted_at == null;
}

export default function VisibilityField({
  value = "company",
  departmentId = "",
  departments = [],
  onChange,
  disabled = false,
  className = "",
  inputClassName = "",
  contentClassName = "",
  departmentClassName = "",
  departmentInputClassName = "",
  departmentContentClassName = "",
  label,
  departmentLabel: departmentLabelText,
  helperText,
  error,
  required = false,
  size = "md",
}) {
  const { t } = useTranslation();
  const activeDepartments = React.useMemo(
    () => (Array.isArray(departments) ? departments.filter(isActiveDepartment) : []),
    [departments]
  );
  const canUseDepartment = activeDepartments.length > 0;
  const normalizedValue = VISIBILITY_VALUES.includes(value) ? value : "company";
  const normalizedDepartmentId = normalizeDepartmentId(departmentId);
  const visibilityOptions = React.useMemo(
    () => [
      { value: "private", label: t("visibility.private") },
      { value: "company", label: t("visibility.company") },
      {
        value: "department",
        label: t("visibility.department"),
        disabled: !canUseDepartment,
      },
    ],
    [canUseDepartment, t]
  );
  const departmentOptions = React.useMemo(
    () => activeDepartments.map((department) => ({
      value: String(department.id),
      label: departmentLabel(department),
    })),
    [activeDepartments]
  );

  const emitVisibility = (nextVisibility) => {
    const next = VISIBILITY_VALUES.includes(nextVisibility) ? nextVisibility : "company";
    const nextDepartmentId =
      next === "department"
        ? normalizedDepartmentId || (departmentOptions.length === 1 ? departmentOptions[0].value : "")
        : "";

    onChange?.({
      visibility: next,
      visibilityDepartmentId: nextDepartmentId,
    });
  };

  const emitDepartment = (nextDepartmentId) => {
    onChange?.({
      visibility: "department",
      visibilityDepartmentId: normalizeDepartmentId(nextDepartmentId),
    });
  };

  const hint =
    helperText
    || (!canUseDepartment ? t("visibility.noDepartment") : normalizedValue === "department" ? t("visibility.tooltip.department") : "");

  return (
    <div className={`${s.visibilityField} ${className}`.trim()}>
      <SelectField
        label={label || t("visibility.label")}
        value={normalizedValue}
        options={visibilityOptions}
        onValueChange={emitVisibility}
        placeholder={t("visibility.label")}
        disabled={disabled}
        required={required}
        error={error}
        helperText={hint}
        size={size}
        inputClassName={inputClassName}
        contentClassName={contentClassName}
        searchable={false}
      />

      {normalizedValue === "department" ? (
        <SelectField
          className={departmentClassName}
          inputClassName={departmentInputClassName}
          contentClassName={departmentContentClassName}
          label={departmentLabelText || t("visibility.departmentSelect")}
          value={normalizedDepartmentId}
          options={departmentOptions}
          onValueChange={emitDepartment}
          placeholder={t("visibility.departmentSelect")}
          disabled={disabled || !canUseDepartment}
          required
          error={!normalizedDepartmentId ? t("visibility.departmentRequired") : undefined}
          size={size}
          searchable={departmentOptions.length > 12}
        />
      ) : null}
    </div>
  );
}
