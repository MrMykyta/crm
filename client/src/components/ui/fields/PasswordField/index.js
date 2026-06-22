import React from "react";
import { Eye, EyeOff } from "lucide-react";
import TextField from "../TextField";
import s from "../fields.module.css";

/**
 * PasswordField — на основе TextField. type переключается password/text
 * кнопкой show/hide. Иконки берём из существующей зависимости lucide-react
 * (новых пакетов не добавляем). dual-mode onChange наследуется от TextField.
 */
export default function PasswordField({
  autoComplete = "current-password",
  revealable = true,
  disabled = false,
  readOnly = false,
  ...props
}) {
  const [visible, setVisible] = React.useState(false);

  const toggle = revealable ? (
    <button
      type="button"
      className={s.adornBtn}
      onClick={() => setVisible((v) => !v)}
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      disabled={disabled}
      tabIndex={-1}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  ) : undefined;

  return (
    <TextField
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      disabled={disabled}
      readOnly={readOnly}
      rightIcon={toggle}
      {...props}
    />
  );
}
