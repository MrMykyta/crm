import s from './WmsMasterDataPage.module.css';

export default function SetupSidePanel({
  open,
  title,
  subtitle,
  children,
  onCancel,
  onSave,
  saving = false,
  saveLabel = 'Save',
  savingLabel = 'Saving...',
  cancelLabel = 'Cancel',
  emptyTitle = 'Select a row',
  emptyText = 'Create or edit an item without leaving the setup list.',
}) {
  const cls = [
    s.setupSidePanel,
    open ? s.setupSidePanelOpen : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={cls} aria-live="polite">
      {open ? (
        <>
          <div className={s.setupPanelHeader}>
            <div>
              <h2>{title}</h2>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
          </div>
          <div className={s.setupPanelBody}>
            {children}
          </div>
          <div className={s.setupPanelActions}>
            <button type="button" className={s.secondaryButton} onClick={onCancel} disabled={saving}>
              {cancelLabel}
            </button>
            <button type="button" className={s.primaryButton} onClick={onSave} disabled={saving}>
              {saving ? savingLabel : saveLabel}
            </button>
          </div>
        </>
      ) : (
        <div className={s.setupPanelEmpty}>
          <h2>{emptyTitle}</h2>
          <p>{emptyText}</p>
        </div>
      )}
    </aside>
  );
}
