import Modal from '../../Modal';

export default function ConfirmDialog({ open, title, text, onOk, onCancel, okText='Подтвердить', cancelText='Отмена' }) {
  const footer = (
    <>
      <Modal.Button onClick={onCancel}>{cancelText}</Modal.Button>
      <Modal.Button variant="primary" onClick={onOk}>{okText}</Modal.Button>
    </>
  );
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={footer}>
      <div style={{ lineHeight: 1.5 }}>{text}</div>
    </Modal>
  );
}