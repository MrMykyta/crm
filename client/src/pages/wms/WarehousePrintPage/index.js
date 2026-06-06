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

export default function WarehousePrintPage({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useGetWarehousePrintDocumentQuery({ kind, id }, { skip: !kind || !id });

  const backRoute = `${DETAIL_ROUTES[kind] || '/main/wms/stock-balances'}/${id}`;
  const message = error?.data?.message || error?.data?.error || error?.message || t('common.error', 'Error');

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

      {isLoading || isFetching ? (
        <div className={s.state}>{t('wms.print.loading', 'Preparing print view...')}</div>
      ) : null}

      {isError ? (
        <div className={s.stateError}>{message}</div>
      ) : null}

      {!isLoading && !isFetching && !isError && !data ? (
        <div className={s.state}>{t('wms.print.notFound', 'Document not found')}</div>
      ) : null}

      {data ? <WarehousePrintDocument document={data} /> : null}
    </div>
  );
}
