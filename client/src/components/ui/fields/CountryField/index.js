import React from "react";
import SelectField from "../SelectField";
import { getCountryOptions } from "../../../../utils/countries";

/**
 * CountryField — на основе SelectField. Источник — utils/countries.js
 * (getCountryOptions(language) → [{ code, label }]). Значение хранится как
 * ISO2-строка (value === code). Labels/i18n не меняем — берём как есть.
 *
 * options можно передать вручную (тогда source игнорируется).
 */
export default function CountryField({
  language = "en",
  options,
  placeholder,
  ...props
}) {
  const computed = React.useMemo(() => {
    if (Array.isArray(options)) return options;
    return getCountryOptions(language).map((o) => ({ value: o.code, label: o.label }));
  }, [options, language]);

  return (
    <SelectField
      options={computed}
      placeholder={placeholder}
      valueType="string"
      {...props}
    />
  );
}
