import s from './StatusBadge.module.css';

// Semantic tones for ERP statuses. Skin-aware: colors come from --success/--warning/
// --danger/--info tokens which V1/V2/V3 inherit from the theme.
const TONES = new Set(['neutral', 'success', 'warning', 'danger', 'info']);

// Common ERP status string -> tone. Extend as new statuses appear; unknown -> neutral.
const STATUS_TONE = {
  // generic / lifecycle
  draft: 'neutral',
  new: 'neutral',
  open: 'info',
  pending: 'warning',
  processing: 'warning',
  sent: 'info',
  issued: 'info',
  confirmed: 'info',
  accepted: 'success',
  approved: 'success',
  active: 'success',
  completed: 'success',
  done: 'success',
  paid: 'success',
  shipped: 'success',
  posted: 'success',
  closed: 'neutral',
  rejected: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  expired: 'danger',
  overdue: 'danger',
  failed: 'danger',
  returned: 'warning',
  corrected: 'warning',
  reserved: 'info',
  unpaid: 'warning',
  partial: 'warning',
};

// statusToTone: map a raw status string to a semantic tone (default 'neutral').
export function statusToTone(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_TONE[key] || 'neutral';
}

/**
 * StatusBadge — unified status pill.
 *
 * Use for: document/record statuses (Order, Invoice, WMS docs), lifecycle states.
 * Don't use for: actions/buttons, counts, free-form tags with custom colors.
 *
 * Props:
 *  - tone: 'neutral'|'success'|'warning'|'danger'|'info' (overrides status mapping)
 *  - status: raw status string used to auto-derive tone when `tone` is omitted
 *  - size: 'sm'|'md'
 *  - dot: show a leading status dot
 */
export default function StatusBadge({
  tone,
  status,
  size = 'md',
  dot = false,
  className = '',
  children,
}) {
  const resolvedTone = TONES.has(tone) ? tone : statusToTone(status);
  const label = children != null ? children : (status || '—');
  const cls = [s.badge, s[resolvedTone], s[size], className].filter(Boolean).join(' ');
  return (
    <span className={cls} data-tone={resolvedTone}>
      {dot ? <span className={s.dot} aria-hidden="true" /> : null}
      <span className={s.label}>{label}</span>
    </span>
  );
}
