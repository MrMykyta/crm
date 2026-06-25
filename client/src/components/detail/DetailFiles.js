import DetailCard from './DetailCard';
import s from './DetailLayout.module.css';

export default function DetailFiles({
  files = [],
  title = 'Files',
  emptyText = 'No files attached.',
  actions,
  renderFile,
}) {
  return (
    <DetailCard title={title} actions={actions}>
      {files.length ? (
        <div className={s.filesGrid}>
          {files.map((file, index) => (
            <div key={file.id || file.key || index} className={s.fileTile}>
              {renderFile ? renderFile(file) : (
                <>
                  <strong>{file.name || file.filename || 'File'}</strong>
                  {file.meta || file.size ? <span>{file.meta || file.size}</span> : null}
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className={s.emptyText}>{emptyText}</p>
      )}
    </DetailCard>
  );
}
