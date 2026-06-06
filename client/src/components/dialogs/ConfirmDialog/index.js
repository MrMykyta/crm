import Modal from '../../Modal';

/**
 * ConfirmDialog — shared confirmation modal (UI-2: now supports danger + loading).
 *
 * Use for: confirming a single action (delete, cancel order, post document).
 * Don't use for: multi-field forms (use a Modal with a form) or transient results (use a toast).
 *
 * Props:
 *  - open, title, text
 *  - onOk, onCancel
 *  - okText, cancelText (already-translated strings)
 *  - danger: style the confirm button as destructive
 *  - loading: disable buttons / show busy state while the action runs
 */
export default function ConfirmDialog({
  open,
  title,
  text,
  onOk,
  onCancel,
  okText = 'Подтвердить',
  cancelText = 'Отмена',
  danger = false,
  loading = false,
}) {
  const footer = (
    <>
      <Modal.Button onClick={onCancel} disabled={loading}>{cancelText}</Modal.Button>
      <Modal.Button
        variant="primary"
        onClick={onOk}
        disabled={loading}
        data-variant={danger ? 'danger' : undefined}
      >
        {okText}
      </Modal.Button>
    </>
  );
  return (
    <Modal open={open} title={title} onClose={loading ? undefined : onCancel} footer={footer}>
      <div style={{ lineHeight: 1.5 }}>{text}</div>
    </Modal>
  );
}
