import { useState } from 'react';

import s from './DetailLayout.module.css';

function DetailMetaRow({
  label,
  value,
  placeholder,
  editor = 'text',
  inlineEdit = false,
  disabled = false,
  onChange,
  renderValue,
  renderEditor,
  actions,
}) {
  const [editing, setEditing] = useState(false);
  const displayValue = renderValue
    ? renderValue(value)
    : value === null || value === undefined || value === ''
      ? <span className={s.metaPlaceholder}>{placeholder || '—'}</span>
      : String(value);

  const commit = (nextValue) => {
    onChange?.(nextValue);
    setEditing(false);
  };

  const editorNode = renderEditor
    ? renderEditor({ value, onChange: commit, onCancel: () => setEditing(false) })
    : (
      <input
        className={s.metaInput}
        type={editor === 'date' ? 'date' : editor === 'number' ? 'number' : 'text'}
        defaultValue={value || ''}
        placeholder={placeholder}
        autoFocus
        disabled={disabled}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
          if (event.key === 'Escape') setEditing(false);
        }}
      />
    );

  return (
    <div className={s.metaRow}>
      <div className={s.metaLabel}>{label}</div>
      <div className={s.metaValueWrap}>
        {editing ? editorNode : (
          <button
            type="button"
            className={s.metaValue}
            disabled={!inlineEdit || disabled}
            onClick={() => inlineEdit && !disabled && setEditing(true)}
          >
            {displayValue}
          </button>
        )}
        {actions ? <div className={s.metaActions}>{actions}</div> : null}
      </div>
    </div>
  );
}

export default function DetailMeta({ rows = [], children }) {
  if (children) return <div className={s.metaList}>{children}</div>;
  return (
    <div className={s.metaList}>
      {rows.map((row) => (
        <DetailMetaRow key={row.key || row.name || row.label} {...row} />
      ))}
    </div>
  );
}

DetailMeta.Row = DetailMetaRow;
export { DetailMetaRow };
