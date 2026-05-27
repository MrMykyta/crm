import s from "./RightPanel.module.css";

export default function FieldInspector({ fieldKey }) {
  return (
    <section className={s.panel}>
      <h3 className={s.title}>Field Inspector</h3>
      <div className={s.metaList}>
        <div className={s.row}>
          <span className={s.label}>Field Key</span>
          <span className={s.value}>{fieldKey}</span>
        </div>
      </div>
      <div className={s.note}>Field inspector controls will be added in a later milestone.</div>
    </section>
  );
}
