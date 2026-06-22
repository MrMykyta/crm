import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WmsEmptyState, WmsErrorState, WmsLoadingState } from '../../../components/wms/ui/WmsState';
import {
  useCreateParcelMutation,
  useListParcelsQuery,
  useUpdateParcelMutation,
} from '../../../store/rtk/wmsDocumentsApi';

const EMPTY_FORM = {
  carrier: '',
  trackingNumber: '',
  weight: '',
  dims: '',
};

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function formatDate(value) {
  const text = asText(value);
  if (!text) return '—';
  return text.slice(0, 10);
}

function formatWeight(value) {
  const text = asText(value);
  if (!text) return '—';
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return text;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatDims(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const length = value.length ?? value.l;
    const width = value.width ?? value.w;
    const height = value.height ?? value.h;
    const compact = [length, width, height].filter((entry) => entry !== undefined && entry !== null && entry !== '').join(' x ');
    return compact || JSON.stringify(value);
  }
  return String(value);
}

function buildForm(parcel = {}) {
  return {
    carrier: asText(parcel.carrier),
    trackingNumber: asText(parcel.trackingNumber),
    weight: asText(parcel.weight),
    dims: formatDims(parcel.dims),
  };
}

function buildPayload(form, shipmentId) {
  const payload = {
    shipmentId,
    carrier: asText(form.carrier),
    trackingNumber: asText(form.trackingNumber),
  };
  if (asText(form.weight)) payload.weight = Number(form.weight);
  if (asText(form.dims)) payload.dims = asText(form.dims);
  return payload;
}

export default function WzParcelsSection({ shipmentId }) {
  const { t } = useTranslation();
  const [panelMode, setPanelMode] = useState('');
  const [editingParcel, setEditingParcel] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const queryArgs = useMemo(() => ({
    page: 1,
    limit: 100,
    sort: 'createdAt',
    dir: 'DESC',
    shipmentId,
  }), [shipmentId]);
  const parcelsQuery = useListParcelsQuery(queryArgs, { skip: !shipmentId });
  const [createParcel, createState] = useCreateParcelMutation();
  const [updateParcel, updateState] = useUpdateParcelMutation();

  const parcels = Array.isArray(parcelsQuery.data?.items) ? parcelsQuery.data.items : [];
  const isSaving = createState.isLoading || updateState.isLoading;
  const isPanelOpen = Boolean(panelMode);

  const openCreate = () => {
    setPanelMode('create');
    setEditingParcel(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const openEdit = (parcel) => {
    setPanelMode('edit');
    setEditingParcel(parcel);
    setForm(buildForm(parcel));
    setFormError('');
  };

  const closePanel = () => {
    setPanelMode('');
    setEditingParcel(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const trackingNumber = asText(form.trackingNumber);
    if (!trackingNumber) {
      setFormError(t('wms.parcels.validation.trackingNumberRequired', 'Tracking number is required.'));
      return;
    }
    const weight = asText(form.weight) ? Number(form.weight) : null;
    if (weight !== null && !Number.isFinite(weight)) {
      setFormError(t('wms.parcels.validation.weightInvalid', 'Weight must be a valid number.'));
      return;
    }
    const payload = buildPayload(form, shipmentId);
    try {
      if (panelMode === 'edit' && editingParcel?.id) {
        await updateParcel({ id: editingParcel.id, ...payload }).unwrap();
      } else {
        await createParcel(payload).unwrap();
      }
      closePanel();
      parcelsQuery.refetch();
    } catch (error) {
      const message = error?.data?.error || error?.data?.message || error?.message;
      setFormError(message || t('wms.parcels.validation.saveFailed', 'Failed to save parcel.'));
    }
  };

  return (
    <section className="wmsShellPostedMovements wmsShellParcelsSection">
      <div className="wmsShellPostedSectionHeader wmsShellParcelsHeader">
        <div>
          <h3>{t('wms.parcels.title', 'Parcels')}</h3>
          <p>{t('wms.parcels.shipmentScopedHint', 'Parcels linked to this shipment only.')}</p>
        </div>
        <span className="wmsShellPostedCountBadge">
          {t('wms.parcels.count', '{{count}} parcels', { count: parcels.length })}
        </span>
        <button type="button" className="wmsShellPrimaryButton" onClick={openCreate}>
          {t('wms.parcels.add', 'Add parcel')}
        </button>
      </div>

      {parcelsQuery.isLoading ? (
        <WmsLoadingState compact rows={3} title={t('wms.parcels.loading', 'Loading parcels...')} />
      ) : parcelsQuery.isError ? (
        <WmsErrorState
          compact
          title={t('wms.parcels.loadFailed', 'Failed to load parcels')}
          description={t('wms.parcels.loadFailedDescription', 'The shipment detail is still available. Try reloading the parcel section.')}
          onRetry={() => parcelsQuery.refetch()}
        />
      ) : parcels.length ? (
        <div className="wmsShellTableWrap wmsShellPostedTableWrap wmsShellParcelsTableWrap">
          <table className="wmsShellTable wmsShellParcelsTable">
            <thead>
              <tr>
                <th>{t('wms.parcels.columns.trackingNumber', 'Tracking number')}</th>
                <th>{t('wms.parcels.columns.carrier', 'Carrier')}</th>
                <th className="wmsShellPostedNumber">{t('wms.parcels.columns.weight', 'Weight')}</th>
                <th>{t('wms.parcels.columns.dimensions', 'Dimensions')}</th>
                <th>{t('wms.parcels.columns.createdAt', 'Created')}</th>
                <th className="wmsShellParcelsActionsCol">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((parcel) => (
                <tr key={parcel.id}>
                  <td className="wmsShellPostedMono">{asText(parcel.trackingNumber) || '—'}</td>
                  <td>{asText(parcel.carrier) || '—'}</td>
                  <td className="wmsShellPostedNumber">{formatWeight(parcel.weight)}</td>
                  <td>{formatDims(parcel.dims) || '—'}</td>
                  <td>{formatDate(parcel.createdAt)}</td>
                  <td className="wmsShellParcelsActionsCol">
                    <button type="button" className="wmsShellButton" onClick={() => openEdit(parcel)}>
                      {t('common.edit', 'Edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <WmsEmptyState
          compact
          title={t('wms.parcels.emptyForShipment', 'No parcels for this shipment')}
          description={t('wms.parcels.emptyForShipmentDescription', 'Add a parcel to track carrier and tracking information for this WZ.')}
          action={(
            <button type="button" className="wmsShellPrimaryButton" onClick={openCreate}>
              {t('wms.parcels.add', 'Add parcel')}
            </button>
          )}
        />
      )}

      {isPanelOpen ? (
        <aside className="wmsShellParcelsDrawer" aria-label={panelMode === 'edit' ? t('wms.parcels.edit', 'Edit parcel') : t('wms.parcels.create', 'Add parcel')}>
          <form onSubmit={onSubmit}>
            <div className="wmsShellParcelsDrawerHeader">
              <div>
                <h4>{panelMode === 'edit' ? t('wms.parcels.edit', 'Edit parcel') : t('wms.parcels.create', 'Add parcel')}</h4>
                <p>{t('wms.parcels.autoShipmentHint', 'Shipment is assigned automatically from the current WZ.')}</p>
              </div>
              <button type="button" className="wmsShellIconButton" onClick={closePanel} aria-label={t('common.close', 'Close')} disabled={isSaving}>
                ×
              </button>
            </div>

            <label className="wmsShellField">
              <span>{t('wms.parcels.columns.trackingNumber', 'Tracking number')}</span>
              <input
                className="wmsShellInput"
                value={form.trackingNumber}
                onChange={(event) => setField('trackingNumber', event.target.value)}
                disabled={isSaving}
                autoComplete="off"
              />
            </label>
            <label className="wmsShellField">
              <span>{t('wms.parcels.columns.carrier', 'Carrier')}</span>
              <input
                className="wmsShellInput"
                value={form.carrier}
                onChange={(event) => setField('carrier', event.target.value)}
                disabled={isSaving}
                autoComplete="off"
              />
            </label>
            <label className="wmsShellField">
              <span>{t('wms.parcels.columns.weight', 'Weight')}</span>
              <input
                className="wmsShellInput wmsShellQtyInput"
                value={form.weight}
                onChange={(event) => setField('weight', event.target.value)}
                disabled={isSaving}
                inputMode="decimal"
                autoComplete="off"
              />
            </label>
            <label className="wmsShellField">
              <span>{t('wms.parcels.columns.dimensions', 'Dimensions')}</span>
              <input
                className="wmsShellInput"
                value={form.dims}
                onChange={(event) => setField('dims', event.target.value)}
                disabled={isSaving}
                placeholder={t('wms.parcels.dimensionsPlaceholder', 'e.g. 30 x 20 x 10')}
                autoComplete="off"
              />
            </label>

            {formError ? <div className="wmsShellFieldError">{formError}</div> : null}

            <div className="wmsShellParcelsDrawerActions">
              <button type="button" className="wmsShellButton" onClick={closePanel} disabled={isSaving}>
                {t('common.cancel', 'Cancel')}
              </button>
              <button type="submit" className="wmsShellPrimaryButton" disabled={isSaving}>
                {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          </form>
        </aside>
      ) : null}
    </section>
  );
}
