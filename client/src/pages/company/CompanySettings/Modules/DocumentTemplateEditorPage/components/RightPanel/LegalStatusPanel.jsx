import { useEditorValidation } from "../../hooks/useEditorValidation";
import s from "./RightPanel.module.css";

export default function LegalStatusPanel() {
  const { issues, isValid, lastValidated } = useEditorValidation();

  return (
    <section className={s.panel}>
      <h3 className={s.title}>Legal Status</h3>
      <div className={s.metaList}>
        <div className={s.row}>
          <span className={s.label}>Template State</span>
          <span className={s.value}>{isValid ? "Valid" : "Invalid"}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Issue Count</span>
          <span className={s.value}>{issues.length}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Last Validated</span>
          <span className={s.value}>{lastValidated || "Never"}</span>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className={s.note}>No validation issues.</div>
      ) : (
        <ul className={s.issues}>
          {issues.map((issue, idx) => (
            <li key={`${issue.code || "issue"}-${idx}`} className={s.issueItem}>
              <div className={s.issueHead}>
                <span>{issue.severity}</span>
                <span>{issue.code}</span>
              </div>
              <div className={s.issueMessage}>{issue.message}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
