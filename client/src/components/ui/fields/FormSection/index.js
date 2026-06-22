import React from "react";
import s from "../fields.module.css";
import { cx } from "../fieldUtils";

/**
 * FormSection — секция формы с заголовком, подзаголовком и опциональными
 * действиями. Не зависит от конкретной формы.
 */
export default function FormSection({
  title,
  subtitle,
  description,
  actions,
  compact = false,
  className = "",
  children,
  ...rest
}) {
  const sub = subtitle ?? description;
  const hasHead = Boolean(title || sub || actions);

  return (
    <section className={cx(s.section, compact && s.compact, className)} {...rest}>
      {hasHead ? (
        <div className={s.sectionHead}>
          <div>
            {title ? <h3 className={s.sectionTitle}>{title}</h3> : null}
            {sub ? <p className={s.sectionSub}>{sub}</p> : null}
          </div>
          {actions ? <div className={s.sectionActions}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={s.sectionBody}>{children}</div>
    </section>
  );
}
