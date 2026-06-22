import React from "react";
import s from "../fields.module.css";
import { cx } from "../fieldUtils";

/**
 * FieldsGrid — отзывчивая сетка для полей формы.
 * columns: 1 | 2 | 3 | 4 (по умолчанию 2). На узких экранах — 1 колонка.
 */
export default function FieldsGrid({
  columns = 2,
  gap,
  className = "",
  style,
  children,
  ...rest
}) {
  const cols = Math.max(1, Math.min(4, Number(columns) || 2));
  const mergedStyle = {
    "--fields-grid-cols": cols,
    ...(gap !== undefined ? { gap } : null),
    ...style,
  };

  return (
    <div className={cx(s.grid, className)} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
}
