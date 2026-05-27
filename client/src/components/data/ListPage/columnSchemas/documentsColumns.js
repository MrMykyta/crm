import LinkCell from "../../../cells/LinkCell";
import { DOCUMENT_TYPE_CONFIG, getDocumentTypeConfig } from "../../../documents/documentTypeConfig";
import { getDocumentStatusLabel } from "../../../documents/documentStatusConfig";

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DIRECTION_LABELS = {
  sale: "Продажа",
  purchase: "Закупка",
};

function asText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getTypeLabel(value, short = false) {
  const type = asText(value).toUpperCase();
  if (!type) return "—";
  if (!DOCUMENT_TYPE_CONFIG[type]) return asDash(value);
  const config = getDocumentTypeConfig(type);
  return short ? config.shortLabel : config.label;
}

function asDash(value) {
  const text = asText(value);
  return text || "—";
}

function asNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDate(value, withTime = false) {
  const text = asText(value);
  if (!text) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split("-");
    return `${d}.${m}.${y}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text;
  return withTime ? DATE_TIME_FORMATTER.format(date) : DATE_FORMATTER.format(date);
}

function formatMoney(value, currency = "PLN") {
  const n = asNumber(value);
  if (n === null) return "—";
  return `${MONEY_FORMATTER.format(n)} ${asText(currency) || "PLN"}`;
}

function clientName(row) {
  return (
    row?.client?.shortName ||
    row?.client?.fullName ||
    row?.clientId ||
    "—"
  );
}

const DOCUMENT_COLUMN_DEFINITIONS = [
  {
    key: "number",
    label: "Номер",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 200,
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={getTypeLabel(row?.type, true)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Открыть документ"
      />
    ),
  },
  {
    key: "type",
    label: "Тип",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 130,
    render: (row) => getTypeLabel(row?.type, true),
  },
  {
    key: "direction",
    label: "Направление",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 130,
    render: (row) => DIRECTION_LABELS[asText(row?.direction)] || asDash(row?.direction),
  },
  {
    key: "client",
    label: "Клиент",
    group: "main",
    defaultVisible: true,
    sortable: false,
    align: "left",
    width: 220,
    render: (row) => clientName(row),
  },
  {
    key: "issueDate",
    label: "Дата",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 130,
    render: (row) => formatDate(row?.issueDate, false),
  },
  {
    key: "totalGross",
    label: "Сумма brutto",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "right",
    width: 150,
    render: (row) => formatMoney(row?.totalGross, row?.currency),
  },
  {
    key: "status",
    label: "Статус",
    group: "main",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 140,
    render: (row) => getDocumentStatusLabel(row?.type, row?.status),
  },
  {
    key: "createdAt",
    label: "Создан",
    group: "system",
    defaultVisible: true,
    sortable: true,
    align: "left",
    width: 165,
    render: (row) => formatDate(row?.createdAt, true),
  },
];

export function createDocumentListColumns(options = {}) {
  const { onOpenDetail } = options;
  return DOCUMENT_COLUMN_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.label,
    managerLabel: definition.label,
    managerGroup: definition.group,
    defaultVisible: definition.defaultVisible !== false,
    sortable: definition.sortable === true,
    width: Number(definition.width || 170),
    canHide: definition.canHide !== false,
    align: definition.align || "left",
    resizable: definition.resizable !== false,
    render: (row) => definition.render(row, { onOpenDetail }),
  }));
}
