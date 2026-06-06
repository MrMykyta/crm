import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import DocumentEnginePage from '../../../../components/documents/DocumentEngine';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import {
  asNumber,
  asText,
  calculateTotals,
  createEmptyItem,
  mapLinesToPayload,
  stableItemsHash,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import {
  useCreateOfferMutation,
  useGetOfferByIdQuery,
  useGetOfferMetaQuery,
  useSaveOfferItemsMutation,
  useUpdateOfferMutation,
} from '../../../../store/rtk/offersApi';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsByCounterpartyQuery } from '../../../../store/rtk/contactsApi';
import { useListCompanyUsersQuery } from '../../../../store/rtk/companyUsersApi';

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

export default function OfferEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { can } = useAclPermissions();
  const canReadOffer = can('offer:read');
  const canCreateOffer = can('offer:create');
  const canUpdateOffer = can('offer:update');

  const [form, setForm] = useState({
    counterpartyId: '',
    contactId: '',
    ownerId: '',
    currencyCode: 'PLN',
    issueDate: '',
    validUntil: '',
    title: '',
    subject: '',
    notes: '',
    paymentTerms: '',
    deliveryTerms: '',
    leadTime: '',
  });
  const [items, setItems] = useState([createEmptyItem()]);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [initialized, setInitialized] = useState(!isEdit);
  const initialItemsHashRef = useRef('[]');

  const { data: offer, isLoading: isOfferLoading, isError: isOfferError, error: offerError } = useGetOfferByIdQuery(id, {
    skip: !isEdit,
    refetchOnMountOrArgChange: true,
  });

  const { data: meta } = useGetOfferMetaQuery({}, { refetchOnMountOrArgChange: false });
  const { data: counterpartiesData } = useListCounterpartiesQuery({
    limit: 150,
    sort: 'shortName',
    dir: 'ASC',
    excludeLeadClient: true,
  });
  const { data: contactsData } = useGetContactsByCounterpartyQuery(
    { counterpartyId: form.counterpartyId, limit: 100 },
    { skip: !form.counterpartyId }
  );
  const { data: ownersData } = useListCompanyUsersQuery({ limit: 200 });

  const [createOffer, { isLoading: isCreating }] = useCreateOfferMutation();
  const [updateOffer, { isLoading: isUpdating }] = useUpdateOfferMutation();
  const [saveOfferItems, { isLoading: isSavingItems }] = useSaveOfferItemsMutation();

  useEffect(() => {
    if (!isEdit || initialized || !offer) return;
    setForm({
      counterpartyId: offer.counterpartyId || offer.counterparty?.id || '',
      contactId: offer.contactId || offer.contact?.id || '',
      ownerId: offer.ownerId || offer.owner?.id || '',
      currencyCode: offer.currency || offer.currencyCode || 'PLN',
      issueDate: asText(offer.issueDate).slice(0, 10),
      validUntil: asText(offer.validUntil).slice(0, 10),
      title: offer.title || '',
      subject: offer.subject || '',
      notes: offer.notes || '',
      paymentTerms: offer.paymentTerms || '',
      deliveryTerms: offer.deliveryTerms || '',
      leadTime: offer.leadTime || '',
    });
    const mappedItems = Array.isArray(offer.items) && offer.items.length
      ? normalizeItemSortOrder(sortItemsBySortOrder(offer.items).map(toEditorItem))
      : normalizeItemSortOrder([createEmptyItem()]);
    setItems(mappedItems);
    initialItemsHashRef.current = stableItemsHash(mappedItems);
    setInitialized(true);
  }, [isEdit, initialized, offer]);

  const counterpartyOptions = useMemo(() => {
    const rows = counterpartiesData?.items || [];
    return [
      { value: '', label: t('documents.editor.selectCounterparty') },
      ...rows.map((row) => ({ value: row.id, label: row.shortName || row.fullName || row.name || row.id })),
    ];
  }, [counterpartiesData, t]);

  const contactOptions = useMemo(() => {
    const rows = contactsData?.items || [];
    return [
      { value: '', label: t('documents.editor.noContact') },
      ...rows.map((row) => ({
        value: row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.id,
      })),
    ];
  }, [contactsData, t]);

  const ownerOptions = useMemo(() => {
    const rows = ownersData?.items || [];
    return [
      { value: '', label: t('documents.editor.noOwner') },
      ...rows.map((row) => ({
        value: row.userId || row.id,
        label: [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || row.email || row.userId || row.id,
      })),
    ];
  }, [ownersData, t]);

  const currencyOptions = useMemo(() => {
    const base = ['PLN', 'EUR', 'USD'];
    const current = asText(form.currencyCode).toUpperCase();
    if (current && !base.includes(current)) base.unshift(current);
    return base.map((code) => ({ value: code, label: code }));
  }, [form.currencyCode]);

  const discountTypeOptions = useMemo(() => {
    const source = Array.isArray(meta?.discountTypes) && meta.discountTypes.length
      ? meta.discountTypes
      : ['none', 'fixed', 'percent'];
    return source.map((type) => ({ value: type, label: type }));
  }, [meta?.discountTypes]);

  const isSaving = isCreating || isUpdating || isSavingItems;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const primaryFields = [
    { label: t('oms.detailLabels.counterparty'), type: 'select', value: form.counterpartyId, onChange: (v) => { setField('counterpartyId', v); setField('contactId', ''); }, options: counterpartyOptions },
    { label: t('oms.detailLabels.contact'), type: 'select', value: form.contactId, onChange: (v) => setField('contactId', v), options: contactOptions },
    { label: t('oms.detailLabels.owner'), type: 'select', value: form.ownerId, onChange: (v) => setField('ownerId', v), options: ownerOptions },
    { label: t('documents.editor.fieldTitle'), type: 'text', value: form.title, onChange: (v) => setField('title', v) },
    { label: t('documents.editor.fieldSubject'), type: 'text', value: form.subject, onChange: (v) => setField('subject', v) },
    { label: t('oms.detailLabels.notes'), type: 'textarea', value: form.notes, onChange: (v) => setField('notes', v) },
  ];

  const secondaryFields = [
    { label: t('oms.summaryLabels.currency'), type: 'select', value: form.currencyCode, onChange: (v) => setField('currencyCode', v), options: currencyOptions },
    { label: t('oms.detailLabels.issueDate'), type: 'date', value: form.issueDate, onChange: (v) => setField('issueDate', v) },
    { label: t('oms.detailLabels.validUntil'), type: 'date', value: form.validUntil, onChange: (v) => setField('validUntil', v) },
    { label: t('oms.detailLabels.paymentTerms'), type: 'text', value: form.paymentTerms, onChange: (v) => setField('paymentTerms', v) },
    { label: t('oms.detailLabels.deliveryTerms'), type: 'text', value: form.deliveryTerms, onChange: (v) => setField('deliveryTerms', v) },
    { label: t('oms.detailLabels.leadTime'), type: 'text', value: form.leadTime, onChange: (v) => setField('leadTime', v) },
  ];

  const totals = {
    netLabel: t('oms.summaryLabels.net'),
    vatLabel: t('oms.summaryLabels.vat'),
    grossLabel: t('oms.summaryLabels.gross'),
    ...calculateTotals(items),
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.counterpartyId) nextErrors.counterpartyId = t('documents.editor.validation.counterpartyRequired');
    items.forEach((item) => {
      if (!asText(item.name)) nextErrors[`item:${item.localId}:name`] = t('documents.editor.validation.itemNameRequired');
      if (asNumber(item.qty, 0) <= 0) nextErrors[`item:${item.localId}:qty`] = t('documents.editor.validation.qtyPositive');
      if (asNumber(item.priceNet, -1) < 0) nextErrors[`item:${item.localId}:priceNet`] = t('documents.editor.validation.priceNonNegative');
    });
    setErrors(nextErrors);
    return nextErrors;
  };

  const buildHeaderPayload = () => ({
    counterpartyId: form.counterpartyId,
    contactId: form.contactId || null,
    ownerId: form.ownerId || null,
    currency: asText(form.currencyCode).toUpperCase() || 'PLN',
    issueDate: form.issueDate || null,
    validUntil: form.validUntil || null,
    title: form.title || '',
    subject: form.subject || '',
    notes: form.notes || '',
    paymentTerms: form.paymentTerms || '',
    deliveryTerms: form.deliveryTerms || '',
    leadTime: form.leadTime || '',
  });

  const onSave = async () => {
    setSaveError('');
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setSaveError(nextErrors.counterpartyId || t('documents.editor.validation.itemNameRequired'));
      return;
    }

    const headerPayload = buildHeaderPayload();
    const itemsPayload = mapLinesToPayload(items);

    try {
      if (isEdit) {
        await updateOffer({ id, payload: headerPayload }).unwrap();
        const nextHash = stableItemsHash(items);
        if (nextHash !== initialItemsHashRef.current) {
          await saveOfferItems({ id, items: itemsPayload }).unwrap();
          initialItemsHashRef.current = nextHash;
        }
        navigate(`/main/oms/offers/${id}`);
        return;
      }
      const created = await createOffer({ ...headerPayload, items: itemsPayload }).unwrap();
      const createdId = created?.id || created?.data?.id;
      navigate(createdId ? `/main/oms/offers/${createdId}` : '/main/oms/offers');
    } catch (error) {
      setSaveError(getErrorText(error, t('documents.editor.saveFailed')));
    }
  };

  if (isEdit && isOfferLoading) {
    return <DocumentEnginePage.State title={t('common.loading')} text={t('documents.editor.loadingHint')} />;
  }
  if ((isEdit && !canReadOffer) || (isEdit && !canUpdateOffer) || (!isEdit && !canCreateOffer)) {
    return <DocumentEnginePage.State title={t('documents.editor.noPermission')} text={t('documents.editor.noPermissionHint')} />;
  }
  if (isEdit && isOfferError) {
    return <DocumentEnginePage.State title={t('documents.editor.loadFailed')} text={getErrorText(offerError, t('documents.editor.loadFailed'))} />;
  }
  if (isEdit && !offer) {
    return <DocumentEnginePage.State title={t('documents.editor.notFound')} text={t('documents.editor.notFoundHint')} />;
  }

  const displayNumber = isEdit ? (offer?.number || offer?.id) : t('common.new');

  return (
    <DocumentEnginePage
      mode="edit"
      typeLabel={t('documents.types.offer')}
      title={isEdit ? t('oms.offers.editTitle') : t('oms.offers.newTitle')}
      number={displayNumber}
      statusLabel={isEdit && offer?.status ? t(`statuses.${String(offer.status).toLowerCase()}`, offer.status) : undefined}
      back={{ label: t('common.cancel'), onClick: () => navigate(isEdit ? `/main/oms/offers/${id}` : '/main/oms/offers') }}
      breadcrumb={`${t('menu.offers')} / ${displayNumber}`}
      paramsTitle={t('documents.editor.header')}
      primaryFields={primaryFields}
      secondaryFields={secondaryFields}
      itemsTitle={t('documents.lines.title')}
      summaryTitle={t('documents.editor.summaryTitle')}
      totals={totals}
      showSaveButton
      onSave={onSave}
      saveDisabled={isSaving || (isEdit ? !canUpdateOffer : !canCreateOffer)}
      saveLoading={isSaving}
      actionError={saveError}
      itemsSlot={(
        <LineItemsEditor
          lines={items}
          onChange={setItems}
          discountTypeOptions={discountTypeOptions}
          errors={errors}
          productPickerTitle={t('documents.lines.productPickerTitle')}
        />
      )}
    />
  );
}
