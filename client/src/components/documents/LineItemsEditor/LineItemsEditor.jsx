import { useCallback, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

import OmsProductPicker from '../../oms/OmsProductPicker';
import EmptyState from '../../shared/EmptyState';
import { NumberField, SelectField, TextField } from '../../ui/fields';
import {
  getAvailabilitySnapshot,
  getLineTypeLabel,
  isInventoryLine,
} from '../../oms/lineItemSemantics';
import { normalizeItemSortOrder } from '../../oms/useReorderItems';
import { createEmptyItem, createProductItem } from './lineModel';
import s from './LineItemsEditor.module.css';

function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return children({ attributes, listeners, setNodeRef, style, isDragging });
}

/**
 * LineItemsEditor — shared editable / read-only line-items grid for documents.
 *
 * Controlled: owns no line state, calls onChange(nextLines) for every mutation.
 * Preserves A3/A4 payload semantics via lineModel (lineType / affectsInventory /
 * isStockTrackedSnapshot / metadataSnapshot / isCustomLine).
 *
 * readonly=true → no drag, no add, no remove, no inline editing; line type and
 * stock/service/non-stock + "affects stock" badges remain visible.
 *
 * Props:
 *  - lines, onChange, discountTypeOptions, errors, readonly, productPickerTitle
 */
export default function LineItemsEditor({
  lines = [],
  onChange,
  discountTypeOptions = [],
  errors = {},
  readonly = false,
  productPickerTitle,
}) {
  const { t } = useTranslation();
  const [isProductPickerOpen, setProductPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sortableIds = useMemo(() => lines.map((item) => item.localId), [lines]);

  const lineTypeLabel = useCallback(
    (lineType) => t(`oms.lineTypes.${lineType || 'custom'}`, getLineTypeLabel(lineType)),
    [t]
  );

  const emit = useCallback((next) => onChange?.(normalizeItemSortOrder(next)), [onChange]);

  const setItemField = useCallback((localId, key, value) => {
    onChange?.(lines.map((item) => {
      if (item.localId !== localId) return item;
      if (key === 'taxRate') {
        return { ...item, taxRate: value, vatRateSnapshot: value };
      }
      return { ...item, [key]: value };
    }));
  }, [lines, onChange]);

  const addCustomItem = useCallback(() => emit([...lines, createEmptyItem()]), [emit, lines]);

  const addProductItem = useCallback((product) => {
    emit([...lines, createProductItem(product)]);
  }, [emit, lines]);

  const removeItem = useCallback((localId) => {
    const next = lines.filter((item) => item.localId !== localId);
    emit(next.length ? next : [createEmptyItem()]);
  }, [emit, lines]);

  const onItemsDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!active?.id || !over?.id || active.id === over.id) return;
    const oldIndex = lines.findIndex((item) => item.localId === active.id);
    const newIndex = lines.findIndex((item) => item.localId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    emit(arrayMove(lines, oldIndex, newIndex));
  }, [emit, lines]);

  const renderItemMeta = (item) => {
    const availability = getAvailabilitySnapshot(item);
    const sku = item.skuSnapshot ? `SKU: ${item.skuSnapshot}` : null;
    return (
      <div className={s.itemMetaBlock}>
        <div className={s.itemBadges}>
          <span className={s.lineTypeBadge}>{lineTypeLabel(item.lineType)}</span>
          {isInventoryLine(item) ? <span className={s.stockBadge}>{t('documents.lines.affectsStock')}</span> : null}
        </div>
        {sku ? <div className={s.itemMeta}>{sku}</div> : null}
        {isInventoryLine(item) ? (
          <div className={s.stockMeta}>
            {t('documents.lines.available')}: {availability.availableQuantity.toFixed(3)}
          </div>
        ) : null}
      </div>
    );
  };

  // One row body shared by editable (dnd) and readonly renders.
  const renderRow = (item, drag) => (
    <tr key={item.localId} ref={drag?.setNodeRef} style={drag?.style} className={drag?.isDragging ? s.draggingRow : ''}>
      <td className={s.dragCell}>
        {!readonly && drag ? (
          <button
            type="button"
            className={s.dragHandle}
            aria-label={t('documents.lines.dragToReorder')}
            title={t('documents.lines.dragToReorder')}
            {...drag.attributes}
            {...drag.listeners}
          >
            ⋮⋮
          </button>
        ) : null}
      </td>
      <td>
        <TextField
          inputClassName={s.input}
          value={item.name || ''}
          disabled={readonly}
          onValueChange={(value) => setItemField(item.localId, 'name', value)}
          placeholder={item.productId
            ? t('documents.lines.productNamePlaceholder')
            : t('documents.lines.customNamePlaceholder')}
        />
        {renderItemMeta(item)}
        {errors[`item:${item.localId}:name`]
          ? <div className={s.fieldError}>{errors[`item:${item.localId}:name`]}</div>
          : null}
      </td>
      <td>
        <div className={s.lineTypeCell}>
          <span className={s.lineTypeBadge}>{lineTypeLabel(item.lineType)}</span>
          {isInventoryLine(item) ? <span className={s.stockBadge}>{t('documents.lines.affectsStock')}</span> : null}
        </div>
      </td>
      <td>
        <NumberField
          inputClassName={s.input}
          emitAs="string"
          min="0"
          step="0.001"
          value={item.qty ?? ''}
          disabled={readonly}
          onValueChange={(value) => setItemField(item.localId, 'qty', value)}
        />
        {errors[`item:${item.localId}:qty`]
          ? <div className={s.fieldError}>{errors[`item:${item.localId}:qty`]}</div>
          : null}
      </td>
      <td>
        <NumberField
          inputClassName={s.input}
          emitAs="string"
          min="0"
          step="0.01"
          value={item.priceNet ?? ''}
          disabled={readonly}
          onValueChange={(value) => setItemField(item.localId, 'priceNet', value)}
        />
        {errors[`item:${item.localId}:priceNet`]
          ? <div className={s.fieldError}>{errors[`item:${item.localId}:priceNet`]}</div>
          : null}
      </td>
      <td>
        <NumberField
          inputClassName={s.input}
          emitAs="string"
          min="0"
          step="0.01"
          value={item.taxRate ?? ''}
          disabled={readonly}
          onValueChange={(value) => setItemField(item.localId, 'taxRate', value)}
        />
      </td>
      <td>
        <SelectField
          value={item.discountType || ''}
          onValueChange={(value) => setItemField(item.localId, 'discountType', value)}
          options={discountTypeOptions}
          placeholder={t('documents.lines.discountType')}
          inputClassName={s.input}
          disabled={readonly}
        />
      </td>
      <td>
        <NumberField
          inputClassName={s.input}
          emitAs="string"
          min="0"
          step="0.01"
          value={item.discountValue ?? ''}
          disabled={readonly}
          onValueChange={(value) => setItemField(item.localId, 'discountValue', value)}
        />
      </td>
      <td>
        {!readonly ? (
          <button type="button" className={s.removeButton} onClick={() => removeItem(item.localId)}>
            {t('documents.lines.remove')}
          </button>
        ) : null}
      </td>
    </tr>
  );

  const head = (
    <thead>
      <tr>
        <th className={s.dragCell} />
        <th>{t('documents.lines.name')}{readonly ? '' : ' *'}</th>
        <th>{t('documents.lines.type')}</th>
        <th>{t('documents.lines.qty')}</th>
        <th>{t('documents.lines.priceNet')}</th>
        <th>{t('documents.lines.taxRate')}</th>
        <th>{t('documents.lines.discountType')}</th>
        <th>{t('documents.lines.discountValue')}</th>
        <th />
      </tr>
    </thead>
  );

  return (
    <div className={s.section}>
      <div className={s.itemsHeader}>
        <h2 className={s.sectionTitle}>{t('documents.lines.title')}</h2>
        {!readonly ? (
          <div className={s.itemsActions}>
            <button type="button" className={s.addRowButton} onClick={addCustomItem}>
              {t('documents.lines.addCustom')}
            </button>
            <button
              type="button"
              className={isProductPickerOpen ? `${s.addRowButton} ${s.addRowButtonActive}` : s.addRowButton}
              onClick={() => setProductPickerOpen((current) => !current)}
            >
              {isProductPickerOpen
                ? t('documents.lines.hideProductBrowser', 'Hide products')
                : t('documents.lines.addProduct')}
            </button>
          </div>
        ) : null}
      </div>

      {!readonly && isProductPickerOpen ? (
        <div className={s.inlineProductBrowser}>
          <OmsProductPicker
            variant="inline"
            onClose={() => setProductPickerOpen(false)}
            onSelect={addProductItem}
            title={productPickerTitle || t('documents.lines.productPickerTitle')}
          />
        </div>
      ) : null}

      {readonly && !lines.length ? (
        <EmptyState size="sm" title={t('oms.itemsTable.empty')} />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            {head}
            {readonly ? (
              <tbody>
                {lines.map((item) => renderRow(item))}
              </tbody>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemsDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <tbody>
                    {lines.map((item) => (
                      <SortableRow key={item.localId} id={item.localId}>
                        {(drag) => renderRow(item, drag)}
                      </SortableRow>
                    ))}
                  </tbody>
                </SortableContext>
              </DndContext>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
