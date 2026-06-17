import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ThemedSelect from '../../../components/inputs/RadixSelect';
import { isWmsShellCcCreateEnabled } from '../../../config/featureFlags';
import {
  useCreateCycleCountMutation,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import { buildCycleCountPayload } from '../documentAdapters/payloadBuilders';
import CcCreateShellPage from '../WmsDocumentShell/CcCreateShellPage';
import s from '../CycleCountPage.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getErrorText(error, fallback = 'Failed to create count sheet') {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function LegacyCycleCountCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [warehouseId, setWarehouseId] = useState('');
  const [errorText, setErrorText] = useState('');
  const [fieldError, setFieldError] = useState('');

  const { data: warehousesData } = useListWarehousesQuery({
    limit: 200,
    sort: 'name',
    dir: 'ASC',
  });
  const [createCycleCount, { isLoading }] = useCreateCycleCountMutation();

  const warehouseOptions = useMemo(() => {
    const rows = Array.isArray(warehousesData?.items) ? warehousesData.items : [];
    return [
      { value: '', label: t('wms.cycleCounts.selectWarehouse', 'Select warehouse') },
      ...rows.map((row) => ({
        value: row.id,
        label: [asText(row.code), asText(row.name)].filter(Boolean).join(' · ') || row.id,
      })),
    ];
  }, [t, warehousesData?.items]);

  const onCreate = async () => {
    setErrorText('');
    if (!warehouseId) {
      setFieldError(t('wms.cycleCounts.validation.warehouseRequired', 'Warehouse is required'));
      return;
    }
    setFieldError('');
    try {
      const created = await createCycleCount(buildCycleCountPayload({ header: { warehouseId } })).unwrap();
      const createdId = created?.id;
      if (!createdId) throw new Error('Cycle count id missing');
      navigate(`/main/wms/cycle-counts/${createdId}`);
    } catch (error) {
      setErrorText(getErrorText(error, t('wms.cycleCounts.errors.create', 'Failed to create cycle count')));
    }
  };

  return (
    <div className={s.page}>
      <section className={s.mainCard}>
        <div className={s.header}>
          <div>
            <h1 className={s.title}>{t('wms.cycleCounts.createTitle', 'New inventory count sheet')}</h1>
            <p className={s.subtle}>
              {t('wms.cycleCounts.createSubtle', 'Create sheet first, then add counted lines in detail view')}
            </p>
          </div>
          <div className={s.headerActions}>
            <button
              type="button"
              className={s.button}
              onClick={() => navigate('/main/wms/cycle-counts')}
              disabled={isLoading}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className={s.primaryButton}
              onClick={onCreate}
              disabled={isLoading}
            >
              {isLoading ? t('common.saving', 'Saving...') : t('wms.cycleCounts.actions.create', 'Create')}
            </button>
          </div>
        </div>

        {errorText ? <div className={s.errorBanner}>{errorText}</div> : null}

        <div className={s.section}>
          <h2 className={s.sectionTitle}>{t('wms.cycleCounts.sections.header', 'Header')}</h2>
          <div className={s.grid}>
            <div className={s.field}>
              <label className={s.fieldLabel}>{t('wms.cycleCounts.fields.warehouse', 'Warehouse')} *</label>
              <ThemedSelect
                value={warehouseId}
                onChange={(value) => {
                  setWarehouseId(value);
                  setFieldError('');
                }}
                options={warehouseOptions}
                placeholder={t('wms.cycleCounts.selectWarehouse', 'Select warehouse')}
              />
              {fieldError ? <span className={s.fieldError}>{fieldError}</span> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function CycleCountCreatePage() {
  if (isWmsShellCcCreateEnabled()) {
    return <CcCreateShellPage />;
  }

  return <LegacyCycleCountCreatePage />;
}
