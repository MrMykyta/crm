import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  FileText,
  ReceiptText,
  Save,
  Send,
} from 'lucide-react';

import {
  DetailCard,
  DetailLayout,
  DetailSection,
  DetailTabs,
} from '../../../../components/detail';
import LineItemsEditor from '../../../../components/documents/LineItemsEditor';
import {
  asNumber,
  asText,
  calculateLine,
  calculateTotals,
  mapLinesToPayload,
  stableItemsHash,
  toEditorItem,
} from '../../../../components/documents/LineItemsEditor/lineModel';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import { SelectField, TextField, TextareaField } from '../../../../components/ui/fields';
import { normalizeItemSortOrder, sortItemsBySortOrder } from '../../../../components/oms/useReorderItems';
import { isOfferEditable } from '../../../../components/oms/documentEditability';
import CustomerDocumentRenderer, {
  buildOfferDocumentDto,
} from '../../../../components/oms/CustomerDocumentRenderer';
import DocumentDeliveryDialog from '../../../../components/oms/DocumentDeliveryDialog';
import DocumentShareDialog from '../../../../components/oms/DocumentShareDialog';
import DocumentActionStrip from '../../../../components/oms/DocumentActionStrip';
import { pickDocumentDeliveryRecipient } from '../../../../components/oms/documentDeliveryRecipient';
import {
  openGeneratedPdf,
  pickGeneratedPdfUrl,
} from '../../../../components/oms/generatedPdf';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { useListCounterpartiesQuery } from '../../../../store/rtk/counterpartyApi';
import { useGetContactsByCounterpartyQuery } from '../../../../store/rtk/contactsApi';
import { useGetContactPointsQuery } from '../../../../store/rtk/contactPointsApi';
import { useListCompanyUsersQuery } from '../../../../store/rtk/companyUsersApi';
import {
  useAcceptOfferMutation,
  useCancelOfferMutation,
  useConvertOfferToOrderMutation,
  useCreateOfferMutation,
  useDeleteOfferMutation,
  useDuplicateOfferMutation,
  useExpireOfferMutation,
  useGenerateOfferPdfMutation,
  useGetOfferByIdQuery,
  useGetOfferMetaQuery,
  useRejectOfferMutation,
  useSaveOfferItemsMutation,
  useSendOfferDocumentMutation,
  useSendOfferMutation,
  useUpdateOfferMutation,
} from '../../../../store/rtk/offersApi';
import { useLazyGetSignedFileUrlQuery } from '../../../../store/rtk/filesApi';
import {
  useCreateDocumentShareMutation,
  useListDocumentSharesQuery,
  useRevokeDocumentShareMutation,
} from '../../../../store/rtk/documentSharesApi';
import { getEntityDiff, hasEntityDiff } from '../../../../utils/entityDiff';
import s from './OfferDetailPage.module.css';

const EMPTY_FORM = {
  counterpartyId: '',
  contactId: '',
  ownerId: '',
  dealId: '',
  currency: 'PLN',
  exchangeRate: '',
  issueDate: '',
  validUntil: '',
  title: '',
  subject: '',
  notes: '',
  internalNotes: '',
  paymentTerms: '',
  deliveryTerms: '',
  incoterms: '',
  leadTime: '',
};

const TERMINAL_STATUSES = new Set(['accepted', 'rejected', 'expired', 'cancelled']);

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function dateInput(value) {
  return asText(value).slice(0, 10);
}

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleDateString(locale || undefined);
}

function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '—';
  return date.toLocaleString(locale || undefined);
}

function formatMoney(value, currency = 'PLN', locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toLocaleString(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || 'PLN'}`;
}

function formatAmount(value, locale) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function MoneyAmount({ value, currency = 'PLN', locale, size = 'md' }) {
  return (
    <span className={`${s.moneyAmount} ${s[`money_${size}`] || ''}`}>
      <span>{formatAmount(value, locale)}</span>
      <small>{currency || 'PLN'}</small>
    </span>
  );
}

function counterpartyName(counterparty) {
  return counterparty?.shortName || counterparty?.fullName || counterparty?.name || counterparty?.id || '';
}

function contactName(contact) {
  return [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim()
    || contact?.name
    || contact?.email
    || contact?.id
    || '';
}

function userName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.name
    || user?.email
    || user?.userId
    || user?.id
    || '';
}

function statusLabel(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function getValidity(offer, t, locale) {
  const raw = offer?.validUntil;
  const status = asText(offer?.status).toLowerCase();
  if (!raw) {
    return {
      label: t('oms.offerDetail.validity.noDate', 'No expiry'),
      tone: 'muted',
    };
  }

  const date = new Date(raw);
  if (Number.isNaN(+date)) {
    return {
      label: t('oms.offerDetail.validity.noDate', 'No expiry'),
      tone: 'muted',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const days = Math.ceil((date.getTime() - today.getTime()) / 86400000);

  if (days < 0 && status === 'expired') {
    return {
      label: t('oms.offerDetail.validity.expiredDisplay', 'Expired visually'),
      detail: formatDate(raw, locale),
      tone: 'danger',
    };
  }

  if (days < 0 && !TERMINAL_STATUSES.has(status)) {
    return {
      label: t('oms.offerDetail.validity.expiredSoft', 'Needs renewal'),
      detail: formatDate(raw, locale),
      tone: 'soft',
    };
  }

  if (days === 0) {
    return {
      label: t('oms.offerDetail.validity.today', 'Expires today'),
      detail: formatDate(raw, locale),
      tone: 'warning',
    };
  }

  if (days > 0) {
    return {
      label: t('oms.offerDetail.validity.daysLeft', '{{count}} days left', { count: days }),
      detail: formatDate(raw, locale),
      tone: days <= 3 ? 'warning' : 'ok',
    };
  }

  return {
    label: formatDate(raw, locale),
    tone: 'muted',
  };
}

function buildFormFromOffer(offer, searchParams) {
  if (!offer?.id) {
    return {
      ...EMPTY_FORM,
      counterpartyId: searchParams.get('counterpartyId') || '',
      contactId: searchParams.get('contactId') || '',
      dealId: searchParams.get('dealId') || '',
      issueDate: new Date().toISOString().slice(0, 10),
    };
  }

  return {
    counterpartyId: offer.counterpartyId || offer.counterparty?.id || '',
    contactId: offer.contactId || offer.contact?.id || '',
    ownerId: offer.ownerId || offer.owner?.id || '',
    dealId: offer.dealId || offer.deal?.id || '',
    currency: offer.currency || offer.currencyCode || 'PLN',
    exchangeRate: offer.exchangeRate != null ? String(offer.exchangeRate) : '',
    issueDate: dateInput(offer.issueDate),
    validUntil: dateInput(offer.validUntil),
    title: offer.title || '',
    subject: offer.subject || '',
    notes: offer.notes || '',
    internalNotes: offer.internalNotes || '',
    paymentTerms: offer.paymentTerms || '',
    deliveryTerms: offer.deliveryTerms || '',
    incoterms: offer.incoterms || '',
    leadTime: offer.leadTime || '',
  };
}

function buildItemsFromOffer(offer) {
  if (Array.isArray(offer?.items) && offer.items.length) {
    return normalizeItemSortOrder(sortItemsBySortOrder(offer.items).map(toEditorItem));
  }
  return [];
}

function isBlankCustomItem(item) {
  if (!item) return false;
  const isCustom = Boolean(item.isCustomLine) || (!item.productId && asText(item.lineType || 'custom') === 'custom');
  if (!isCustom || item.id || item.productId || item.variantId) return false;
  return !asText(item.skuSnapshot)
    && !asText(item.name)
    && !asText(item.descriptionSnapshot)
    && !asText(item.unitSnapshot)
    && !asText(item.productTypeSnapshot)
    && !item.metadataSnapshot
    && asNumber(item.qty, 1) === 1
    && asNumber(item.priceNet, 0) === 0
    && (!item.discountType || item.discountType === 'none')
    && asNumber(item.discountValue, 0) === 0;
}

function compactOfferItems(items = []) {
  return normalizeItemSortOrder((items || []).filter((item) => !isBlankCustomItem(item)));
}

function normalizeVisibleOfferItems(items = []) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.some((item) => !isBlankCustomItem(item))) return normalizeItemSortOrder(rows);
  return compactOfferItems(rows);
}

function buildPayload(form) {
  const exchangeRate = form.exchangeRate === '' ? null : Number(form.exchangeRate);
  return {
    counterpartyId: form.counterpartyId || null,
    contactId: form.contactId || null,
    ownerId: form.ownerId || null,
    dealId: form.dealId || null,
    currency: asText(form.currency).toUpperCase() || 'PLN',
    exchangeRate: Number.isFinite(exchangeRate) ? exchangeRate : null,
    issueDate: form.issueDate || null,
    validUntil: form.validUntil || null,
    title: form.title || '',
    subject: form.subject || '',
    notes: form.notes || '',
    internalNotes: form.internalNotes || '',
    paymentTerms: form.paymentTerms || '',
    deliveryTerms: form.deliveryTerms || '',
    incoterms: form.incoterms || '',
    leadTime: form.leadTime || '',
  };
}

function validateOfferForm(form, items, t) {
  const errors = {};
  if (!form.counterpartyId) errors.counterpartyId = t('oms.offerDetail.validation.customerRequired', 'Customer is required.');
  items.forEach((item) => {
    if (!asText(item.name)) errors[`item:${item.localId}:name`] = t('documents.editor.validation.itemNameRequired');
    if (asNumber(item.qty, 0) <= 0) errors[`item:${item.localId}:qty`] = t('documents.editor.validation.qtyPositive');
    if (asNumber(item.priceNet, -1) < 0) errors[`item:${item.localId}:priceNet`] = t('documents.editor.validation.priceNonNegative');
  });
  return errors;
}

function buildActivity(offer, t, locale) {
  const items = [
    { key: 'created', at: offer?.createdAt, label: t('oms.offerDetail.activity.created', 'Offer created'), actor: offer?.createdByUser },
    { key: 'sent', at: offer?.sentAt || offer?.statusMetadata?.sentAt, label: t('oms.offerDetail.activity.sent', 'Offer sent'), actor: offer?.sentByUser },
    { key: 'viewed', at: offer?.viewedAt || offer?.statusMetadata?.viewedAt, label: t('oms.offerDetail.activity.viewed', 'Offer viewed'), actor: offer?.viewedByUser },
    { key: 'accepted', at: offer?.acceptedAt || offer?.statusMetadata?.acceptedAt, label: t('oms.offerDetail.activity.accepted', 'Offer accepted'), actor: offer?.acceptedByUser },
    { key: 'rejected', at: offer?.rejectedAt || offer?.statusMetadata?.rejectedAt, label: t('oms.offerDetail.activity.rejected', 'Offer rejected'), actor: offer?.rejectedByUser },
    { key: 'cancelled', at: offer?.cancelledAt || offer?.statusMetadata?.cancelledAt, label: t('oms.offerDetail.activity.cancelled', 'Offer cancelled'), actor: offer?.cancelledByUser },
    { key: 'converted', at: offer?.convertedAt || offer?.statusMetadata?.convertedAt, label: t('oms.offerDetail.activity.converted', 'Converted to order'), actor: offer?.convertedByUser },
    { key: 'status', at: offer?.lastStatusChangedAt || offer?.statusMetadata?.lastStatusChangedAt, label: t('oms.offerDetail.activity.statusChanged', 'Status changed'), actor: null },
    { key: 'updated', at: offer?.updatedAt, label: t('oms.offerDetail.activity.updated', 'Offer updated'), actor: offer?.updatedByUser },
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  return items.map((item) => ({
    ...item,
    dateLabel: formatDateTime(item.at, locale),
    actorLabel: userName(item.actor),
  }));
}

function getDiscountTotal(items = []) {
  return items.reduce((sum, item) => {
    const qty = Math.max(0, asNumber(item.qty, 0));
    const priceNet = Math.max(0, asNumber(item.priceNet, 0));
    const baseNet = qty * priceNet;
    const line = calculateLine(item);
    return sum + Math.max(0, baseNet - line.lineNet);
  }, 0);
}

function lineKindLabel(item, t) {
  const key = asText(item?.lineType || (item?.productId ? 'product' : 'custom')).toLowerCase();
  return t(`oms.lineTypes.${key}`, key || 'custom');
}

function FactLine({ label, children }) {
  return (
    <div className={s.factLine}>
      <span>{label}</span>
      <strong>{children || '—'}</strong>
    </div>
  );
}

function OfferHero({ offer, form, totals, isCreate, validity, t, locale, customerLabel }) {
  const currency = form.currency || offer?.currency || 'PLN';
  const gross = Number.isFinite(Number(totals?.gross)) ? totals.gross : Number(offer?.totalGross ?? 0);
  const number = offer?.number || (isCreate ? t('oms.offerDetail.create.draftNumber', 'Draft') : offer?.id);
  const subject = form.subject || form.title || t('oms.offerDetail.hero.defaultSubject', 'Proposal prepared for your approval');

  return (
    <div className={s.heroCraft}>
      <div className={s.heroMain}>
        <div className={s.heroIcon}>S</div>
        <div className={s.heroText}>
          <span>{t('oms.offerDetail.hero.offerNumberEyebrow', 'Offer')} · {number}</span>
          <h1>{customerLabel || t('oms.offerDetail.noCustomer', 'No customer selected')}</h1>
          <p>{subject}</p>
        </div>
      </div>
      <div className={s.heroDecision}>
        <span>{t('oms.offerDetail.hero.grandTotal', 'Grand total')}</span>
        <MoneyAmount value={gross} currency={currency} locale={locale} size="hero" />
        <div className={s.heroMeta}>
          <span className={s[`validity_${validity.tone}`] || ''}>{validity.label}{validity.detail ? ` · ${validity.detail}` : ''}</span>
          <span>{isCreate ? statusLabel('draft', t) : statusLabel(offer?.status, t)}</span>
          {offer?.revision != null ? <span>{t('oms.offerDetail.system.revision', 'Revision')} {offer.revision}</span> : null}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ offer, form, totals, isCreate, validity, t, locale, onTab, customerLabel }) {
  const currency = form.currency || offer?.currency || 'PLN';
  const gross = Number.isFinite(Number(totals?.gross)) ? totals.gross : Number(offer?.totalGross ?? 0);
  const convertedOrder = offer?.convertedOrder;
  const invoices = Array.isArray(offer?.invoices) ? offer.invoices : [];

  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.offerDetail.tabs.overview', 'Overview')}>
        <div className={s.overviewGrid}>
          <FactLine label={t('oms.offerDetail.overview.customer', 'Customer')}>
            {offer?.counterparty?.id ? (
              <Link to={`/main/counterparties/${offer.counterparty.id}`}>{counterpartyName(offer.counterparty)}</Link>
            ) : customerLabel || (form.counterpartyId ? t('oms.offerDetail.customerSelected', 'Customer selected') : '—')}
          </FactLine>
          <FactLine label={t('oms.offerDetail.overview.total', 'Total')}>
            {formatMoney(gross, currency, locale)}
          </FactLine>
          <FactLine label={t('oms.offerDetail.overview.validity', 'Validity')}>
            {validity.label}
          </FactLine>
          <FactLine label={t('oms.offerDetail.overview.nextAction', 'Next action')}>
            {t(`oms.offerDetail.next.${asText(offer?.status || 'draft').toLowerCase()}`, 'Review proposal')}
          </FactLine>
        </div>
      </DetailSection>

      <DetailSection title={t('oms.offerDetail.sections.documentChain', 'Document chain')}>
        <div className={s.chain}>
          {offer?.deal?.id || offer?.dealId ? (
            <Link to={`/main/deals/${offer.deal?.id || offer.dealId}`}>{t('oms.offerDetail.smart.deal', 'Deal')} · {offer.deal?.title || offer.dealId}</Link>
          ) : <span>{t('oms.offerDetail.chain.noDeal', 'No source deal')}</span>}
          {convertedOrder?.id || offer?.convertedOrderId ? (
            <Link to={`/main/oms/orders/${convertedOrder?.id || offer.convertedOrderId}`}>{t('oms.offerDetail.smart.order', 'Order')} · {convertedOrder?.number || offer.convertedOrderId}</Link>
          ) : <span>{t('oms.offerDetail.chain.noOrder', 'No order yet')}</span>}
          {invoices.length ? invoices.map((invoice) => (
            <Link key={invoice.id} to={`/main/oms/invoices/${invoice.id}`}>{t('oms.offerDetail.smart.invoice', 'Invoice')} · {invoice.number || invoice.id}</Link>
          )) : <span>{t('oms.offerDetail.chain.noInvoice', 'No invoice yet')}</span>}
        </div>
      </DetailSection>

      {form.notes ? (
        <DetailSection title={t('oms.offerDetail.sections.proposalSummary', 'Proposal summary')}>
          <p className={s.longText}>{form.notes}</p>
        </DetailSection>
      ) : null}

      <div className={s.anchorActions}>
        <button type="button" onClick={() => onTab('items')}>{t('oms.offerDetail.actions.openItems', 'Open items')}</button>
        <button type="button" onClick={() => onTab('preview')}>{t('oms.offerDetail.actions.openPreview', 'Open preview')}</button>
      </div>
    </div>
  );
}

function ProposalLines({ items, t, locale, currency }) {
  return (
    <div className={s.proposalLines}>
      {items.map((item, index) => {
        const line = calculateLine(item);
        const title = item.name || t('oms.offerDetail.preview.unnamedLine', 'Unnamed line');
        return (
          <div className={s.proposalLine} key={item.localId || item.id || index}>
            <div className={s.lineThumb}>{title.slice(0, 1).toUpperCase() || 'S'}</div>
            <div className={s.lineCopy}>
              <strong>{title}</strong>
              <span>
                {lineKindLabel(item, t)}
                {' · '}
                {t('oms.offerDetail.items.quantityMeta', '{{qty}} pcs', { qty: asNumber(item.qty, 0) })}
                {' · '}
                {t('oms.offerDetail.items.unitNetMeta', '{{value}} net/unit', { value: formatMoney(asNumber(item.priceNet, 0), currency, locale) })}
              </span>
              <small>
                {t('oms.offerDetail.items.taxMeta', 'VAT {{rate}}%', { rate: asNumber(item.taxRate, 0) })}
                {item.discountType && item.discountType !== 'none' ? ` · ${t('oms.offerDetail.items.discountMeta', 'discount {{value}}', { value: item.discountValue || 0 })}` : ''}
              </small>
            </div>
            <div className={s.lineTotal}>
              <span>{t('oms.offerDetail.items.lineTotal', 'Line total')}</span>
              <MoneyAmount value={line.lineGross} currency={currency} locale={locale} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TotalsCrescendo({ items, totals, t, locale, currency }) {
  const discount = getDiscountTotal(items);
  return (
    <aside className={s.totalsCrescendo}>
      <div>
        <span>{t('oms.summaryLabels.net')}</span>
        <strong>{formatMoney(totals.net, currency, locale)}</strong>
      </div>
      {discount > 0 ? (
        <div className={s.savingsLine}>
          <span>{t('oms.offerDetail.totals.savings', 'You save')}</span>
          <strong>{formatMoney(discount, currency, locale)}</strong>
        </div>
      ) : null}
      <div>
        <span>{t('oms.summaryLabels.vat')}</span>
        <strong>{formatMoney(totals.vat, currency, locale)}</strong>
      </div>
      <div className={s.grandTotalLine}>
        <span>{t('oms.offerDetail.hero.grandTotal', 'Grand total')}</span>
        <MoneyAmount value={totals.gross} currency={currency} locale={locale} size="lg" />
      </div>
    </aside>
  );
}

function ItemsTab({ items, onItemsChange, errors, discountTypeOptions, readonly, totals, t, locale, currency }) {
  return (
    <div className={s.stack}>
      <DetailSection
        title={t('oms.offerDetail.tabs.items', 'Items')}
        subtitle={readonly ? t('oms.offerDetail.readonlyHint', 'Terminal offers are read-only.') : t('oms.offerDetail.itemsHint', 'Build the proposal with products, services, custom lines, discount, tax, and totals.')}
      >
        <ProposalLines items={items} t={t} locale={locale} currency={currency} />
        <div className={s.proposalEditor}>
          <LineItemsEditor
            lines={items}
            onChange={onItemsChange}
            discountTypeOptions={discountTypeOptions}
            errors={errors}
            readonly={readonly}
            productPickerTitle={t('documents.lines.productPickerTitle')}
          />
        </div>
      </DetailSection>
      <TotalsCrescendo items={items} totals={totals} t={t} locale={locale} currency={currency} />
    </div>
  );
}

function PreviewTab({ offer, form, items, totals, t, locale }) {
  const documentDto = buildOfferDocumentDto({ offer, form, items, totals, locale, t });
  const [generatePdf, { isLoading, error }] = useGenerateOfferPdfMutation();
  const [sendDocument, sendState] = useSendOfferDocumentMutation();
  const [createShare, createShareState] = useCreateDocumentShareMutation();
  const [revokeShare, revokeShareState] = useRevokeDocumentShareMutation();
  const { data: shares = [], isFetching: sharesLoading, error: sharesError } = useListDocumentSharesQuery(
    { entityType: 'offer', entityId: offer?.id },
    { skip: !offer?.id }
  );
  const deliveryCounterpartyId = offer?.counterpartyId || offer?.counterparty?.id || form?.counterpartyId || '';
  const deliveryContactId = offer?.contactId || offer?.contact?.id || form?.contactId || '';
  const { data: deliveryCounterpartyPoints = [] } = useGetContactPointsQuery(
    { ownerType: 'counterparty', ownerId: deliveryCounterpartyId },
    { skip: !deliveryCounterpartyId }
  );
  const { data: deliveryContactPoints = [] } = useGetContactPointsQuery(
    { ownerType: 'contact', ownerId: deliveryContactId },
    { skip: !deliveryContactId }
  );
  const [getSignedFileUrl] = useLazyGetSignedFileUrlQuery();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pdfOpenState, setPdfOpenState] = useState({ url: '', opened: false });
  const deliveryRecipient = useMemo(() => pickDocumentDeliveryRecipient({
    counterpartyContactPoints: deliveryCounterpartyPoints,
    contactPersonContactPoints: deliveryContactPoints,
    contactPersonLegacyEmail: offer?.contact?.email,
    counterpartyLegacyEmail: offer?.counterparty?.email || offer?.counterparty?.primaryEmail || offer?.counterparty?.contactEmail,
  }), [deliveryContactPoints, deliveryCounterpartyPoints, offer?.contact?.email, offer?.counterparty?.contactEmail, offer?.counterparty?.email, offer?.counterparty?.primaryEmail]);

  const onGeneratePdf = async () => {
    if (!offer?.id) return;
    setPdfOpenState({ url: '', opened: false });
    const result = await generatePdf({ id: offer.id, payload: { locale } }).unwrap();
    const fileId = result?.file?.id || result?.metadata?.fileId;
    const signed = fileId ? await getSignedFileUrl(fileId).unwrap() : null;
    const url = pickGeneratedPdfUrl(result, signed);
    setPdfOpenState(openGeneratedPdf(url));
  };

  const onSendDocument = async (payload) => {
    await sendDocument({ id: offer.id, payload }).unwrap();
    setDeliveryOpen(false);
  };

  const onCreateShare = async (payload) => {
    await createShare({ entityType: 'offer', entityId: offer.id, locale, ...payload }).unwrap();
  };

  const onRevokeShare = async (share) => {
    await revokeShare({ id: share.id, entityType: 'offer', entityId: offer.id }).unwrap();
  };

  return (
    <DetailSection title={t('oms.offerDetail.tabs.preview', 'Preview')}>
      <DocumentActionStrip
        t={t}
        title={t('oms.documentActions.offerTitle', 'Offer document')}
        subtitle={t('oms.documentActions.offerSubtitle', 'Prepare the customer-facing offer, then choose PDF, email, or customer link.')}
        onGeneratePdf={onGeneratePdf}
        pdfLoading={isLoading}
        pdfDisabled={!offer?.id}
        pdfOpened={pdfOpenState.opened}
        pdfFallbackUrl={pdfOpenState.opened ? '' : pdfOpenState.url}
        onSend={() => setDeliveryOpen(true)}
        sendLoading={sendState.isLoading}
        sendDisabled={!offer?.id}
        onShare={() => setShareOpen(true)}
        shareDisabled={!offer?.id}
        error={error}
      />
      <CustomerDocumentRenderer dto={documentDto} />
      <DocumentDeliveryDialog
        open={deliveryOpen}
        onClose={() => setDeliveryOpen(false)}
        onSend={onSendDocument}
        loading={sendState.isLoading}
        error={sendState.error}
        t={t}
        locale={locale}
        documentLabel={t('oms.documentDelivery.types.offer', 'Offer')}
        documentNumber={offer?.number}
        defaultRecipientEmail={deliveryRecipient.email}
        defaultRecipientSource={deliveryRecipient.source}
      />
      <DocumentShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onCreate={onCreateShare}
        onRevoke={onRevokeShare}
        t={t}
        locale={locale}
        entityType="offer"
        entityId={offer?.id}
        documentLabel={t('oms.documentShare.types.offer', 'Offer')}
        documentNumber={offer?.number}
        shares={shares}
        loading={sharesLoading}
        creating={createShareState.isLoading}
        revoking={revokeShareState.isLoading}
        error={sharesError || createShareState.error || revokeShareState.error}
      />
    </DetailSection>
  );
}

function ActivityTab({ offer, t, locale }) {
  const events = buildActivity(offer, t, locale);
  return (
    <DetailSection title={t('oms.offerDetail.tabs.activity', 'Activity')}>
      {events.length ? (
        <div className={s.timeline}>
          {events.map((event) => (
            <div className={s.timelineRow} key={`${event.key}-${event.at}`}>
              <span className={s.timelineDot} />
              <div>
                <strong>{event.label}</strong>
                <span>{event.dateLabel}{event.actorLabel ? ` · ${event.actorLabel}` : ''}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.empty}>{t('oms.offerDetail.activity.empty', 'No activity yet.')}</div>
      )}
    </DetailSection>
  );
}

function SystemTab({ offer, t, locale }) {
  return (
    <div className={s.stack}>
      <DetailSection title={t('oms.offerDetail.tabs.system', 'System')}>
        <div className={s.systemGrid}>
          <FactLine label="ID">{offer?.id}</FactLine>
          <FactLine label={t('oms.detailLabels.number')}>{offer?.number}</FactLine>
          <FactLine label={t('oms.detailLabels.status')}>{statusLabel(offer?.status, t)}</FactLine>
          <FactLine label={t('oms.offerDetail.system.revision', 'Revision')}>{offer?.revision ?? offer?.meta?.revision}</FactLine>
          <FactLine label={t('oms.detailLabels.createdAt')}>{formatDateTime(offer?.createdAt, locale)}</FactLine>
          <FactLine label={t('oms.detailLabels.updatedAt')}>{formatDateTime(offer?.updatedAt, locale)}</FactLine>
          <FactLine label={t('oms.offerDetail.system.lastStatusChangedAt', 'Last status change')}>{formatDateTime(offer?.lastStatusChangedAt || offer?.statusMetadata?.lastStatusChangedAt, locale)}</FactLine>
          <FactLine label={t('oms.offerDetail.system.createdBy', 'Created by')}>{userName(offer?.createdByUser)}</FactLine>
          <FactLine label={t('oms.offerDetail.system.updatedBy', 'Updated by')}>{userName(offer?.updatedByUser)}</FactLine>
        </div>
      </DetailSection>
    </div>
  );
}

export default function OfferDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { can } = useAclPermissions();
  const canReadOffer = can('offer:read');
  const canCreateOffer = can('offer:create');
  const canUpdateOffer = can('offer:update');
  const canDeleteOffer = can('offer:delete');
  const canConvertOffer = can('offer:convert');
  const canCreateOrder = can('order:create');

  const [activeTab, setActiveTab] = useState('overview');
  const [form, setForm] = useState(() => buildFormFromOffer(null, searchParams));
  const [items, setItems] = useState(() => []);
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [dirty, setDirty] = useState(isCreate);
  const initRef = useRef('');
  const cleanPayloadRef = useRef(buildPayload(form));
  const itemsHashRef = useRef(stableItemsHash(items));

  const { data: offer, isLoading, isFetching, isError, error, refetch } = useGetOfferByIdQuery(id, {
    skip: isCreate || !id || !canReadOffer,
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
  const [deleteOffer, { isLoading: isDeleting }] = useDeleteOfferMutation();
  const [sendOffer] = useSendOfferMutation();
  const [acceptOffer] = useAcceptOfferMutation();
  const [rejectOffer] = useRejectOfferMutation();
  const [cancelOffer] = useCancelOfferMutation();
  const [expireOffer] = useExpireOfferMutation();
  const [duplicateOffer] = useDuplicateOfferMutation();
  const [convertOfferToOrder] = useConvertOfferToOrderMutation();

  useEffect(() => {
    if (isCreate) return;
    if (!offer?.id || initRef.current === offer.id) return;
    initRef.current = offer.id;
    const nextItems = buildItemsFromOffer(offer);
    const nextForm = buildFormFromOffer(offer, searchParams);
    setForm(nextForm);
    setItems(nextItems);
    setErrors({});
    setDirty(false);
    cleanPayloadRef.current = buildPayload(nextForm);
    itemsHashRef.current = stableItemsHash(nextItems);
  }, [isCreate, offer, searchParams]);

  const editable = isCreate || (isOfferEditable(offer) && canUpdateOffer);
  const readonly = !editable;
  const totals = useMemo(() => calculateTotals(items), [items]);
  const currency = form.currency || offer?.currency || 'PLN';
  const decisionGross = Number.isFinite(Number(totals?.gross)) ? totals.gross : Number(offer?.totalGross ?? 0);
  const validity = useMemo(() => getValidity(isCreate ? form : offer, t, locale), [form, isCreate, locale, offer, t]);
  const isSaving = isCreating || isUpdating || isSavingItems || isDeleting;
  const selectedCounterparty = useMemo(() => {
    if (offer?.counterparty) return offer.counterparty;
    if (!form.counterpartyId) return null;
    return (counterpartiesData?.items || []).find((row) => row.id === form.counterpartyId) || null;
  }, [counterpartiesData?.items, form.counterpartyId, offer?.counterparty]);
  const customerLabel = counterpartyName(selectedCounterparty) || (form.counterpartyId ? t('oms.offerDetail.customerSelected', 'Customer selected') : '');

  const counterpartyOptions = useMemo(() => {
    const rows = counterpartiesData?.items || [];
    return [
      { value: '', label: t('documents.editor.selectCounterparty') },
      ...rows.map((row) => ({ value: row.id, label: counterpartyName(row) || row.id })),
    ];
  }, [counterpartiesData?.items, t]);

  const contactOptions = useMemo(() => {
    const rows = contactsData?.items || [];
    return [
      { value: '', label: t('documents.editor.noContact') },
      ...rows.map((row) => ({ value: row.id, label: contactName(row) || row.id })),
    ];
  }, [contactsData?.items, t]);

  const ownerOptions = useMemo(() => {
    const rows = ownersData?.items || [];
    return [
      { value: '', label: t('documents.editor.noOwner') },
      ...rows.map((row) => ({ value: row.userId || row.id, label: userName(row) || row.userId || row.id })),
    ];
  }, [ownersData?.items, t]);

  const currencyOptions = useMemo(() => {
    const base = ['PLN', 'EUR', 'USD'];
    const current = asText(form.currency).toUpperCase();
    if (current && !base.includes(current)) base.unshift(current);
    return base.map((code) => ({ value: code, label: code }));
  }, [form.currency]);

  const discountTypeOptions = useMemo(() => {
    const source = Array.isArray(meta?.discountTypes) && meta.discountTypes.length
      ? meta.discountTypes
      : ['none', 'fixed', 'percent'];
    return source.map((type) => ({ value: type, label: t(`documents.discountTypes.${type}`, type) }));
  }, [meta?.discountTypes, t]);

  const setField = useCallback((key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'counterpartyId') next.contactId = '';
      setDirty(
        hasEntityDiff(cleanPayloadRef.current || {}, buildPayload(next))
        || stableItemsHash(items) !== itemsHashRef.current
      );
      return next;
    });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, [items]);

  const onItemsChange = useCallback((next) => {
    const nextItems = normalizeVisibleOfferItems(next);
    setItems(nextItems);
    setDirty(
      stableItemsHash(nextItems) !== itemsHashRef.current
      || hasEntityDiff(cleanPayloadRef.current || {}, buildPayload(form))
    );
  }, [form]);

  const saveOffer = useCallback(async () => {
    setActionError('');
    const itemsForSave = compactOfferItems(items);
    const nextErrors = validateOfferForm(form, itemsForSave, t);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setActionError(nextErrors.counterpartyId || t('documents.editor.validation.itemNameRequired'));
      return null;
    }

    const payload = buildPayload(form);
    const mappedItems = mapLinesToPayload(itemsForSave);

    try {
      if (isCreate) {
        const created = await createOffer({ ...payload, items: mappedItems }).unwrap();
        const createdId = created?.id || created?.data?.id;
        if (createdId) navigate(`/main/oms/offers/${createdId}`, { replace: true });
        return created;
      }

      const patch = getEntityDiff(cleanPayloadRef.current || {}, payload);
      const nextHash = stableItemsHash(itemsForSave);
      const itemsChanged = nextHash !== itemsHashRef.current;
      if (!Object.keys(patch).length && !itemsChanged) {
        setDirty(false);
        return null;
      }
      if (Object.keys(patch).length) {
        await updateOffer({ id, payload: patch }).unwrap();
        cleanPayloadRef.current = { ...(cleanPayloadRef.current || {}), ...patch };
      }
      if (itemsChanged) {
        await saveOfferItems({ id, items: mappedItems }).unwrap();
        itemsHashRef.current = nextHash;
      }
      await refetch();
      setDirty(false);
      return offer;
    } catch (err) {
      setActionError(getErrorText(err, t('documents.editor.saveFailed')));
      return null;
    }
  }, [createOffer, form, id, isCreate, items, navigate, offer, refetch, saveOfferItems, t, updateOffer]);

  const runAction = useCallback(async (key, runner, options = {}) => {
    if (!id) return;
    if (options.confirm && typeof window !== 'undefined' && !window.confirm(options.confirm)) return;
    setActionError('');
    setActionLoading(key);
    try {
      const result = await runner().unwrap();
      const redirect = options.redirect?.(result);
      if (redirect) {
        navigate(redirect);
        return;
      }
      await refetch();
    } catch (err) {
      setActionError(getErrorText(err, t('oms.errors.actionFailed')));
    } finally {
      setActionLoading('');
    }
  }, [id, navigate, refetch, t]);

  const duplicateCurrent = useCallback(() => runAction('duplicate', () => duplicateOffer({ id, payload: {} }), {
    redirect: (result) => {
      const nextId = result?.id || result?.data?.id || result?.offer?.id || result?.data?.offer?.id;
      return nextId ? `/main/oms/offers/${nextId}` : null;
    },
  }), [duplicateOffer, id, runAction]);

  const convertCurrent = useCallback(() => runAction('convert-to-order', () => convertOfferToOrder({ id, payload: {} }), {
    redirect: (result) => {
      const orderId = result?.order?.id || result?.data?.order?.id || result?.id || result?.data?.id;
      return orderId ? `/main/oms/orders/${orderId}` : null;
    },
  }), [convertOfferToOrder, id, runAction]);

  const deleteCurrent = useCallback(async () => {
    if (!id) return;
    if (typeof window !== 'undefined' && !window.confirm(t('oms.offerDetail.confirmDelete', 'Delete this offer?'))) return;
    setActionLoading('delete');
    setActionError('');
    try {
      await deleteOffer(id).unwrap();
      navigate('/main/oms/offers');
    } catch (err) {
      setActionError(getErrorText(err, t('oms.errors.actionFailed')));
    } finally {
      setActionLoading('');
    }
  }, [deleteOffer, id, navigate, t]);

  const available = offer?.availableActions || {};
  const primaryAction = useMemo(() => {
    if (isCreate) {
      return {
        key: 'create',
        label: isSaving ? t('common.saving', 'Saving...') : t('oms.offerDetail.actions.create', 'Create offer'),
        icon: <Save size={15} aria-hidden="true" />,
        disabled: isSaving || !canCreateOffer,
        onClick: saveOffer,
      };
    }
    if (available.canSend && canUpdateOffer) {
      return { key: 'send', label: t('oms.actionLabels.markSent', 'Mark as sent'), icon: <Send size={15} aria-hidden="true" />, disabled: actionLoading === 'send', onClick: () => runAction('send', () => sendOffer({ id, payload: {} })) };
    }
    if (available.canAccept && canUpdateOffer) {
      return { key: 'accept', label: t('oms.actionLabels.accept'), icon: <BadgeCheck size={15} aria-hidden="true" />, disabled: actionLoading === 'accept', onClick: () => runAction('accept', () => acceptOffer({ id, payload: {} })) };
    }
    if (available.canConvertToOrder && canConvertOffer && canCreateOrder) {
      return { key: 'convert-to-order', label: t('oms.actionLabels.convertToOrder'), icon: <ReceiptText size={15} aria-hidden="true" />, disabled: actionLoading === 'convert-to-order', onClick: convertCurrent };
    }
    if (available.canDuplicate && canCreateOffer) {
      return { key: 'duplicate', label: t('oms.actionLabels.duplicate'), icon: <Copy size={15} aria-hidden="true" />, disabled: actionLoading === 'duplicate', onClick: duplicateCurrent };
    }
    return null;
  }, [acceptOffer, actionLoading, available.canAccept, available.canConvertToOrder, available.canDuplicate, available.canSend, canConvertOffer, canCreateOffer, canCreateOrder, canUpdateOffer, convertCurrent, duplicateCurrent, id, isCreate, isSaving, runAction, saveOffer, sendOffer, t]);

  const headerActions = useMemo(() => {
    const actions = [];
    if (!isCreate && dirty && editable) {
      actions.push({
        key: 'save',
        label: isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save'),
        icon: <Save size={14} aria-hidden="true" />,
        disabled: isSaving,
        onClick: saveOffer,
      });
    }
    if (!isCreate && available.canReject && canUpdateOffer) {
      actions.push({ key: 'reject', label: t('oms.actionLabels.reject'), destructive: true, onClick: () => runAction('reject', () => rejectOffer({ id, payload: {} }), { confirm: t('oms.confirm.offerRejectText') }) });
    }
    if (!isCreate && available.canCancel && canUpdateOffer) {
      actions.push({ key: 'cancel', label: t('oms.actionLabels.cancel'), destructive: true, onClick: () => runAction('cancel', () => cancelOffer({ id, payload: {} }), { confirm: t('oms.confirm.offerCancelText') }) });
    }
    if (!isCreate && available.canExpire && canUpdateOffer) {
      actions.push({ key: 'expire', label: t('oms.actionLabels.expire'), onClick: () => runAction('expire', () => expireOffer({ id, payload: {} })) });
    }
    return actions;
  }, [available.canCancel, available.canExpire, available.canReject, canUpdateOffer, cancelOffer, dirty, editable, expireOffer, id, isCreate, isSaving, rejectOffer, runAction, saveOffer, t]);

  const overflowActions = useMemo(() => {
    const items = [];
    if (!isCreate && available.canDuplicate && canCreateOffer && primaryAction?.key !== 'duplicate') items.push({ key: 'duplicate', label: t('oms.actionLabels.duplicate'), onClick: duplicateCurrent });
    if (!isCreate && available.canDelete && canDeleteOffer) items.push({ key: 'delete', label: t('common.delete', 'Delete'), destructive: true, onClick: deleteCurrent });
    return items;
  }, [available.canDelete, available.canDuplicate, canCreateOffer, canDeleteOffer, deleteCurrent, duplicateCurrent, isCreate, primaryAction?.key, t]);

  const smartButtons = useMemo(() => {
    const invoices = Array.isArray(offer?.invoices) ? offer.invoices : [];
    return [
      offer?.deal?.id || offer?.dealId ? { key: 'deal', label: t('oms.offerDetail.smart.deal', 'Deal'), value: offer?.deal?.title || '1', to: `/main/deals/${offer?.deal?.id || offer?.dealId}` } : null,
      offer?.convertedOrder?.id || offer?.convertedOrderId ? { key: 'order', label: t('oms.offerDetail.smart.order', 'Order'), value: offer?.convertedOrder?.number || '1', to: `/main/oms/orders/${offer?.convertedOrder?.id || offer?.convertedOrderId}` } : null,
      invoices.length ? { key: 'invoice', label: t('oms.offerDetail.smart.invoice', 'Invoice'), value: invoices.length, to: `/main/oms/invoices/${invoices[0].id}` } : null,
      { key: 'preview', label: t('oms.offerDetail.smart.preview', 'Preview'), value: <FileText size={14} aria-hidden="true" />, onClick: () => setActiveTab('preview') },
      !isCreate ? { key: 'notes', label: t('oms.offerDetail.smart.notes', 'Notes'), value: '•', onClick: () => setActiveTab('notes') } : null,
    ].filter(Boolean);
  }, [isCreate, offer, t]);

  const tabs = useMemo(() => [
    {
      key: 'overview',
      label: t('oms.offerDetail.tabs.overview', 'Overview'),
      render: () => (
        <OverviewTab
          offer={offer}
          form={form}
          totals={totals}
          isCreate={isCreate}
          validity={validity}
          t={t}
          locale={locale}
          onTab={setActiveTab}
          customerLabel={customerLabel}
        />
      ),
    },
    {
      key: 'items',
      label: t('oms.offerDetail.tabs.items', 'Items'),
      count: items.length,
      render: () => (
        <ItemsTab
          items={items}
          onItemsChange={onItemsChange}
          errors={errors}
          discountTypeOptions={discountTypeOptions}
          readonly={readonly}
          totals={totals}
          t={t}
          locale={locale}
          currency={currency}
        />
      ),
    },
    {
      key: 'preview',
      label: t('oms.offerDetail.tabs.preview', 'Preview'),
      render: () => <PreviewTab offer={offer} form={form} items={items} totals={totals} t={t} locale={locale} />,
    },
    {
      key: 'activity',
      label: t('oms.offerDetail.tabs.activity', 'Activity'),
      render: () => <ActivityTab offer={offer} t={t} locale={locale} />,
    },
    {
      key: 'notes',
      label: t('oms.offerDetail.tabs.notes', 'Notes'),
      render: () => (
        isCreate ? (
          <DetailSection title={t('oms.offerDetail.tabs.notes', 'Notes')}>
            <div className={s.empty}>{t('oms.offerDetail.notes.saveFirst', 'Create the offer before adding notes.')}</div>
          </DetailSection>
        ) : (
          <EntityNotesSection
            ownerType="offer"
            ownerId={id}
            title={t('oms.offerDetail.notes.title', 'Offer notes')}
            emptyTitle={t('oms.offerDetail.notes.emptyTitle', 'No notes yet')}
            emptyText={t('oms.offerDetail.notes.emptyText', 'Notes linked to this offer will appear here.')}
            addNoteLabel={t('oms.offerDetail.notes.add', 'Add note')}
            compact
            hidePagerWhenSingle
          />
        )
      ),
    },
    {
      key: 'system',
      label: t('oms.offerDetail.tabs.system', 'System'),
      render: () => <SystemTab offer={offer} t={t} locale={locale} />,
    },
  ], [currency, customerLabel, discountTypeOptions, errors, form, id, isCreate, items, locale, offer, onItemsChange, readonly, t, totals, validity]);

  if ((isCreate && !canCreateOffer) || (!isCreate && !canReadOffer)) {
    return <div className={s.state}>{t('common.noPermission', 'No permission')}</div>;
  }
  if (!isCreate && (isLoading || (isFetching && !offer))) {
    return <div className={s.state}>{t('common.loading', 'Loading')}</div>;
  }
  if (!isCreate && isError) {
    return <div className={s.state}>{getErrorText(error, t('oms.errors.offerLoadFailed'))}</div>;
  }
  if (!isCreate && !offer) {
    return <div className={s.state}>{t('oms.errors.offerNotFound')}</div>;
  }

  return (
    <DetailLayout
      mode="entity"
      className={s.offerDetail}
      breadcrumbs={[
        { label: t('oms.offers.title'), to: '/main/oms/offers' },
        { label: isCreate ? t('oms.offers.newTitle') : offer?.number || offer?.id },
      ]}
      title={form.title || offer?.number || t('oms.offers.newTitle')}
      subtitle={form.subject || customerLabel || t('oms.offerDetail.subtitle', 'Persuasion workspace')}
      icon={<FileText size={18} aria-hidden="true" />}
      status={{ value: isCreate ? 'draft' : offer?.status, label: isCreate ? statusLabel('draft', t) : statusLabel(offer?.status, t) }}
      smartButtons={smartButtons}
      primaryAction={primaryAction}
      actions={headerActions}
      overflowActions={overflowActions}
      saveState={{
        dirty,
        saving: isSaving,
        error: actionError,
        label: actionError || (isSaving ? t('common.saving', 'Saving...') : dirty ? t('oms.offerDetail.save.unsaved', 'Unsaved changes') : ''),
      }}
      header={(
        <div className={s.headerWrap}>
          <div className={s.headerTop}>
            <button type="button" className={s.backBtn} onClick={() => navigate('/main/oms/offers')}>
              <ArrowLeft size={16} aria-hidden="true" />
              {t('oms.offers.title')}
            </button>
          </div>
          <OfferHero offer={offer} form={form} totals={totals} isCreate={isCreate} validity={validity} t={t} locale={locale} customerLabel={customerLabel} />
          <div className={s.headerActions}>
            <div className={s.smartRow}>
              {smartButtons.map((item) => (
                item.to ? (
                  <Link key={item.key} className={s.smartBtn} to={item.to}>
                    <strong>{item.value}</strong><span>{item.label}</span>
                  </Link>
                ) : (
                  <button key={item.key} type="button" className={s.smartBtn} onClick={item.onClick}>
                    <strong>{item.value}</strong><span>{item.label}</span>
                  </button>
                )
              ))}
            </div>
            <div className={s.actionRow}>
              {headerActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`${s.actionBtn} ${action.destructive ? s.actionDanger : ''}`}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
              {overflowActions.length ? (
                <details className={s.overflowMenu}>
                  <summary aria-label={t('oms.offerDetail.actions.more', 'More actions')}>•••</summary>
                  <div>
                    {overflowActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        className={`${s.actionBtn} ${s.overflowAction} ${action.destructive ? s.actionDanger : ''}`}
                        onClick={action.onClick}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
              {primaryAction ? (
                <div className={s.primaryDecision}>
                  <span>
                    {t('oms.offerDetail.hero.grandTotal', 'Grand total')}
                    {' '}
                    {formatMoney(decisionGross, currency, locale)}
                  </span>
                  <button type="button" className={s.primaryBtn} onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                    {primaryAction.icon}
                    {primaryAction.label}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {actionError ? <div className={s.errorBar}>{actionError}</div> : null}
        </div>
      )}
      sidebar={(
        <aside className={s.sidebar}>
          <DetailCard title={t('oms.offerDetail.sections.customer', 'Customer')}>
            <div className={s.fieldStack}>
              <SelectField label={t('oms.detailLabels.counterparty')} value={form.counterpartyId} options={counterpartyOptions} onValueChange={(value) => setField('counterpartyId', value)} disabled={readonly} error={errors.counterpartyId} searchable clearable />
              <SelectField label={t('oms.detailLabels.contact')} value={form.contactId} options={contactOptions} onValueChange={(value) => setField('contactId', value)} disabled={readonly || !form.counterpartyId} searchable clearable />
              <SelectField label={t('oms.detailLabels.owner')} value={form.ownerId} options={ownerOptions} onValueChange={(value) => setField('ownerId', value)} disabled={readonly} searchable clearable />
              {offer?.deal?.id || form.dealId ? (
                <FactLine label={t('oms.detailLabels.deal')}>
                  {offer?.deal?.id ? <Link to={`/main/deals/${offer.deal.id}`}>{offer.deal.title || offer.deal.id}</Link> : form.dealId}
                </FactLine>
              ) : null}
            </div>
          </DetailCard>

          <DetailCard title={t('oms.offerDetail.sections.proposal', 'Proposal')}>
            <div className={s.fieldStack}>
              <TextField label={t('documents.editor.fieldTitle')} value={form.title} onValueChange={(value) => setField('title', value)} disabled={readonly} />
              <TextField label={t('documents.editor.fieldSubject')} value={form.subject} onValueChange={(value) => setField('subject', value)} disabled={readonly} />
              <TextField type="date" label={t('oms.detailLabels.issueDate')} value={form.issueDate} onValueChange={(value) => setField('issueDate', value)} disabled={readonly} />
              <TextField type="date" label={t('oms.detailLabels.validUntil')} value={form.validUntil} onValueChange={(value) => setField('validUntil', value)} disabled={readonly} />
            </div>
          </DetailCard>

          <DetailCard title={t('oms.offerDetail.sections.commercial', 'Commercial')}>
            <div className={s.fieldStack}>
              <SelectField label={t('oms.summaryLabels.currency')} value={form.currency} options={currencyOptions} onValueChange={(value) => setField('currency', value)} disabled={readonly} />
              <TextField label={t('oms.offerDetail.fields.exchangeRate', 'Exchange rate')} value={form.exchangeRate} onValueChange={(value) => setField('exchangeRate', value)} disabled={readonly} inputMode="decimal" />
              <TextField label={t('oms.detailLabels.paymentTerms')} value={form.paymentTerms} onValueChange={(value) => setField('paymentTerms', value)} disabled={readonly} />
              <TextField label={t('oms.detailLabels.deliveryTerms')} value={form.deliveryTerms} onValueChange={(value) => setField('deliveryTerms', value)} disabled={readonly} />
              <TextField label={t('oms.offerDetail.fields.incoterms', 'Incoterms')} value={form.incoterms} onValueChange={(value) => setField('incoterms', value)} disabled={readonly} />
              <TextField label={t('oms.detailLabels.leadTime')} value={form.leadTime} onValueChange={(value) => setField('leadTime', value)} disabled={readonly} />
            </div>
          </DetailCard>

          <DetailCard title={t('oms.offerDetail.sections.notes', 'Notes')}>
            <TextareaField label={t('oms.detailLabels.notes')} value={form.notes} onValueChange={(value) => setField('notes', value)} disabled={readonly} rows={4} />
          </DetailCard>
        </aside>
      )}
      content={(
        <main className={s.content}>
          <div className={s.workspaceSurface}>
            <DetailTabs tabs={tabs} activeTab={activeTab} onActiveTabChange={setActiveTab} />
          </div>
        </main>
      )}
    />
  );
}
