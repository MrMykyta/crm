import React from "react";
import clsx from "clsx";
import s from "./AddButton.module.css";

/**
 * Универсальная кнопка добавления (как "+ Пригласить пользователя")
 *
 * Props:
 * - onClick: () => void
 * - children: текст ("Пригласить пользователя", "Добавить контрагента" и т.п.)
 * - icon?: ReactNode | boolean — по умолчанию "+"
 * - disabled?: boolean
 * - className?: string
 * - title?: string
 */
export default function AddButton({
  onClick,
  children,
  icon = true,
  disabled,
  className,
  title,
}) {
  return (
    <button
      type="button"
      className={clsx(s.primary, className)}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon === true ? (
        <span className={s.plus} aria-hidden>
          +
        </span>
      ) : (
        icon
      )}
      <span>{children}</span>
    </button>
  );
}