import React from 'react';
import LinkCell from '../../../cells/LinkCell';
import { formatQuantity, getUomSymbol } from '../../../../utils/uom';

const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU');
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const NUMBER_0_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const NUMBER_2_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const NUMBER_3_FORMATTER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 });

const STATUS_LABELS = {
  draft: 'Черновик',
  active: 'Активен',
  archived: 'Архив',
};

const VISIBILITY_LABELS = {
  public: 'Публичный',
  private: 'Скрытый',
};

export const PRODUCT_HIDDEN_PICKER_KEYS = [
  'id',
  'companyId',
  'brandId',
  'primaryCategoryId',
  'subcategoryId',
  'supplierId',
  'uomId',
  'taxCategoryId',
  'shippingClassId',
  'productTypeId',
  'replacedByProductId',
  'slug',
];

// asText: вспомогательная логика компонента.
function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

// asDash: вспомогательная логика компонента.
function asDash(value) {
  const text = asText(value);
  return text || '—';
}

// asBool: вспомогательная логика компонента.
function asBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'да'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'нет'].includes(normalized)) return false;
  }
  return Boolean(value);
}

// asNumber: вспомогательная логика компонента.
function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

// formatDate: форматирует данные для отображения.
function formatDate(value, { withTime = false } = {}) {
  const text = asText(value);
  if (!text) return '—';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split('-');
    return `${d}.${m}.${y}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text;
  return withTime ? DATE_TIME_FORMATTER.format(date) : DATE_FORMATTER.format(date);
}

// formatNumber: форматирует данные для отображения.
function formatNumber(value, { digits = 2 } = {}) {
  const num = asNumber(value);
  if (num === null) return '—';
  if (digits <= 0) return NUMBER_0_FORMATTER.format(num);
  if (digits >= 3) return NUMBER_3_FORMATTER.format(num);
  return NUMBER_2_FORMATTER.format(num);
}

// relationName: вспомогательная логика компонента.
function relationName(entity, fallback = '—') {
  if (!entity || typeof entity !== 'object') return fallback;
  return (
    entity.name
    || entity.shortName
    || entity.fullName
    || entity.code
    || entity.slug
    || entity.id
    || fallback
  );
}

// resolveValue: вспомогательная логика компонента.
function resolveValue(definition, row) {
  if (typeof definition.value === 'function') return definition.value(row);
  return row?.[definition.key];
}

// renderValue: описывает рендер соответствующего блока UI.
function renderValue(definition, row) {
  if (typeof definition.format === 'function') {
    return definition.format(resolveValue(definition, row), row);
  }
  return asDash(resolveValue(definition, row));
}

export const PRODUCT_COLUMN_DEFINITIONS = [
  {
    key: 'name',
    label: 'Название',
    group: 'default',
    defaultVisible: true,
    sortable: true,
    resizable: true,
    align: 'left',
    width: 280,
    canHide: false,
    editableInList: true,
        // render: описывает рендер соответствующего блока UI.
render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.name)}
        secondary={asText(row?.sku) || null}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Открыть товар"
      />
    ),
  },
  {
    key: 'primaryCategory',
    label: 'Категория',
    group: 'default',
    defaultVisible: true,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
    editableInList: true,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.primaryCategory),
  },
  {
    key: 'brand',
    label: 'Производитель',
    group: 'default',
    defaultVisible: true,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
    editableInList: true,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.brand),
  },
  {
    key: 'stockQuantity',
    label: 'Остаток',
    group: 'default',
    defaultVisible: true,
    sortable: true,
    resizable: true,
    align: 'right',
    width: 130,
        // format: форматирует данные для отображения.
format: (value, row) => formatQuantity(value, row?.uom),
  },
  {
    key: 'cost',
    label: 'Себестоимость',
    group: 'default',
    defaultVisible: true,
    sortable: true,
    resizable: true,
    align: 'right',
    width: 140,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 2 }),
  },
  {
    key: 'isSellable',
    label: 'Продаётся',
    group: 'default',
    defaultVisible: true,
    sortable: false,
    resizable: true,
    align: 'center',
    width: 130,
    editableInList: true,
        // value: вспомогательная логика компонента.
value: (row) => row?.effectiveIsSellable ?? row?.isSellable,
        // format: форматирует данные для отображения.
format: (value) => (asBool(value) ? 'Да' : 'Нет'),
  },

  {
    key: 'sku',
    label: 'SKU',
    group: 'business',
    defaultVisible: false,
    sortable: true,
    resizable: true,
    align: 'left',
    width: 150,
    editableInList: true,
  },
  {
    key: 'ean',
    label: 'EAN',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 170,
    editableInList: true,
  },
  {
    key: 'barcode',
    label: 'Штрихкод',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 170,
  },
  {
    key: 'subcategory',
    label: 'Подкатегория',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.subcategory),
  },
  {
    key: 'supplier',
    label: 'Поставщик',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 220,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.supplier),
  },
  {
    key: 'price',
    label: 'Цена',
    group: 'business',
    defaultVisible: false,
    sortable: true,
    resizable: true,
    align: 'right',
    width: 130,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 2 }),
  },
  {
    key: 'oldPrice',
    label: 'Старая цена',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 150,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 2 }),
  },
  {
    key: 'currency',
    label: 'Валюта',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 110,
  },
  {
    key: 'reservedQuantity',
    label: 'Зарезервировано',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 170,
        // format: форматирует данные для отображения.
format: (value, row) => formatQuantity(value, row?.uom),
  },
  {
    key: 'orderedQuantity',
    label: 'Заказано',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 140,
        // format: форматирует данные для отображения.
format: (value, row) => formatQuantity(value, row?.uom),
  },
  {
    key: 'status',
    label: 'Статус',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 130,
    editableInList: true,
        // format: форматирует данные для отображения.
format: (value) => STATUS_LABELS[asText(value)] || asDash(value),
  },
  {
    key: 'visibility',
    label: 'Видимость',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 130,
    editableInList: true,
        // format: форматирует данные для отображения.
format: (value) => VISIBILITY_LABELS[asText(value)] || asDash(value),
  },
  {
    key: 'saleStartDate',
    label: 'Начало продаж',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 155,
    editableInList: true,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value),
  },
  {
    key: 'saleEndDate',
    label: 'Окончание продаж',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 175,
    editableInList: true,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value),
  },
  {
    key: 'publishedAt',
    label: 'Опубликован',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 165,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value, { withTime: true }),
  },
  {
    key: 'description',
    label: 'Описание',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 320,
    editableInDetailOnly: true,
  },
  {
    key: 'pkwiu',
    label: 'PKWiU',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 130,
    editableInDetailOnly: true,
  },
  {
    key: 'cn',
    label: 'CN',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 120,
    editableInDetailOnly: true,
  },
  {
    key: 'gtu',
    label: 'GTU',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 120,
    editableInDetailOnly: true,
  },
  {
    key: 'taxCategory',
    label: 'Налоговая категория',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
    editableInDetailOnly: true,
        // value: вспомогательная логика компонента.
value: (row) => {
      const name = relationName(row?.taxCategory, '');
      const rate = row?.taxCategory?.rate;
      if (name && rate !== undefined && rate !== null && rate !== '') return `${name} (${rate}%)`;
      return name || '—';
    },
  },
  {
    key: 'type',
    label: 'Тип товара',
    group: 'business',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 160,
    editableInDetailOnly: true,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.type),
  },

  {
    key: 'weight',
    label: 'Вес',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 120,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 3 }),
  },
  {
    key: 'length',
    label: 'Длина',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 120,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 3 }),
  },
  {
    key: 'width',
    label: 'Ширина',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 120,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 3 }),
  },
  {
    key: 'height',
    label: 'Высота',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 120,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 3 }),
  },
  {
    key: 'uom',
    label: 'Ед. изм.',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 120,
        // value: вспомогательная логика компонента.
value: (row) => getUomSymbol(row?.uom, '—'),
  },
  {
    key: 'shippingClass',
    label: 'Класс доставки',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 170,
    editableInDetailOnly: true,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.shippingClass),
  },
  {
    key: 'hsCode',
    label: 'HS Code',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 130,
    editableInDetailOnly: true,
  },
  {
    key: 'countryOfOrigin',
    label: 'Страна происхождения',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
    editableInDetailOnly: true,
  },
  {
    key: 'warrantyMonths',
    label: 'Гарантия, мес.',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 150,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 0 }),
  },
  {
    key: 'trackInventory',
    label: 'Учитывать остатки',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'center',
    width: 170,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => (asBool(value) ? 'Да' : 'Нет'),
  },
  {
    key: 'dangerousGoodsClass',
    label: 'Класс опасности',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 170,
    editableInDetailOnly: true,
  },
  {
    key: 'unNumber',
    label: 'UN номер',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 130,
    editableInDetailOnly: true,
  },
  {
    key: 'isSerialized',
    label: 'Серийный учёт',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'center',
    width: 150,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => (asBool(value) ? 'Да' : 'Нет'),
  },
  {
    key: 'isLotTracked',
    label: 'Учёт партий',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'center',
    width: 140,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => (asBool(value) ? 'Да' : 'Нет'),
  },
  {
    key: 'shelfLifeDays',
    label: 'Срок хранения, дн.',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'right',
    width: 170,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatNumber(value, { digits: 0 }),
  },
  {
    key: 'discontinuedAt',
    label: 'Снят с продажи',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 165,
    editableInDetailOnly: true,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value, { withTime: true }),
  },
  {
    key: 'replacement',
    label: 'Заменён на',
    group: 'logistics',
    defaultVisible: false,
    sortable: false,
    resizable: true,
    align: 'left',
    width: 190,
    editableInDetailOnly: true,
        // value: вспомогательная логика компонента.
value: (row) => relationName(row?.replacement, asText(row?.replacedByProductId) || '—'),
  },

  {
    key: 'createdAt',
    label: 'Создан',
    group: 'system',
    defaultVisible: false,
    sortable: true,
    resizable: true,
    align: 'left',
    width: 150,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value, { withTime: true }),
  },
  {
    key: 'updatedAt',
    label: 'Обновлён',
    group: 'system',
    defaultVisible: false,
    sortable: true,
    resizable: true,
    align: 'left',
    width: 160,
        // format: форматирует данные для отображения.
format: (value) => formatDate(value, { withTime: true }),
  },
];

// createProductListColumns: создаёт элемент в UI-потоке компонента.
export function createProductListColumns({ onOpenDetail } = {}) {
  return PRODUCT_COLUMN_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.label,
    managerLabel: definition.label,
    managerGroup: definition.group,
    defaultVisible: definition.defaultVisible !== false,
    sortable: definition.sortable === true,
    width: Number(definition.width || 170),
    canHide: definition.canHide !== false,
    align: definition.align || 'left',
    resizable: definition.resizable !== false,
    editableInList: definition.editableInList === true,
    editableInDetailOnly: definition.editableInDetailOnly === true,
    hiddenFromPicker: definition.hiddenFromPicker === true,
    managerHidden: definition.hiddenFromPicker === true,
        // render: описывает рендер соответствующего блока UI.
render: (row, rowIndex) => {
      if (typeof definition.render === 'function') {
        return definition.render(row, { rowIndex, onOpenDetail });
      }
      return renderValue(definition, row);
    },
  }));
}

