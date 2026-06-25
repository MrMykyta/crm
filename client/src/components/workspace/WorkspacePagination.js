import { useTranslation } from 'react-i18next';
import s from './Workspace.module.css';

export default function WorkspacePagination({
  page = 1,
  limit = 25,
  total = 0,
  onPageChange,
}) {
  const { t } = useTranslation();
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.max(1, Number(limit) || 25);
  const totalRows = Math.max(0, Number(total) || 0);
  const pages = Math.max(1, Math.ceil(totalRows / pageSize));
  const start = totalRows ? (currentPage - 1) * pageSize + 1 : 0;
  const end = totalRows ? Math.min(currentPage * pageSize, totalRows) : 0;

  return (
    <footer className={s.pagination}>
      <div className={s.paginationMeta}>
        <span>{t('list.rangeOfTotal', { start, end, total: totalRows })}</span>
      </div>

      <div className={s.paginationControls}>
        <button
          type="button"
          className={s.paginationButton}
          aria-label={t('list.back')}
          onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          ‹
        </button>
        <span className={s.pageBadge}>
          {currentPage}
        </span>
        <button
          type="button"
          className={s.paginationButton}
          aria-label={t('list.forward')}
          onClick={() => onPageChange?.(Math.min(pages, currentPage + 1))}
          disabled={currentPage >= pages}
        >
          ›
        </button>
      </div>
    </footer>
  );
}
