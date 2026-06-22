import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import WarehousePrintDocument from '../../../components/wms/WarehousePrintDocument';
import { useGetWarehousePrintDocumentQuery } from '../../../store/rtk/wmsDocumentsApi';
import s from './WarehousePrintPage.module.css';

const DETAIL_ROUTES = {
  receipt: '/main/wms/receipts',
  transfer: '/main/wms/transfers',
  shipment: '/main/wms/shipments',
  adjustment: '/main/wms/adjustments',
  cycleCount: '/main/wms/cycle-counts',
};

function PrintPreviewSkeleton({ label }) {
  return (
    <article className={s.skeletonSheet} aria-busy="true" aria-label={label}>
      <div className={s.skeletonHeader}>
        <span className={s.skeletonPill} />
        <span className={s.skeletonTitle} />
        <span className={s.skeletonStatus} />
      </div>
      <div className={s.skeletonMeta}>
        <span />
        <span />
        <span />
      </div>
      <div className={s.skeletonBlock} />
      <div className={s.skeletonSectionTitle} />
      <div className={s.skeletonTable}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

export default function WarehousePrintPage({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryArgs = useMemo(() => ({ kind, id }), [kind, id]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useGetWarehousePrintDocumentQuery(queryArgs, { skip: !kind || !id });

  const backRoute = `${DETAIL_ROUTES[kind] || '/main/wms/stock-balances'}/${id}`;
  const message = error?.data?.message || error?.data?.error || error?.message || t('common.error', 'Error');
  const isInitialLoading = (isLoading || isFetching) && !data && !isError;
  const showNotFound = !isInitialLoading && !isError && !data;
  const loadingLabel = t('wms.print.loading', 'Preparing print view...');

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <button type="button" className={s.button} onClick={() => navigate(backRoute)}>
          {t('wms.print.backToDetail', 'Back to detail')}
        </button>
        <button
          type="button"
          className={s.primaryButton}
          onClick={() => window.print()}
          disabled={!data}
        >
          <Printer size={16} aria-hidden="true" />
          {t('wms.print.print', 'Print')}
        </button>
      </div>

      {isInitialLoading ? <PrintPreviewSkeleton label={loadingLabel} /> : null}

      {isError ? (
        <div className={s.stateError}>{message}</div>
      ) : null}

      {showNotFound ? (
        <div className={s.state}>{t('wms.print.notFound', 'Document not found')}</div>
      ) : null}

      {data ? <WarehousePrintDocument document={data} /> : null}
    </div>
  );
}
