import s from './DetailLayout.module.css';

const TONE_CLASS = {
  neutral: s.statusNeutral,
  info: s.statusInfo,
  success: s.statusSuccess,
  warning: s.statusWarning,
  danger: s.statusDanger,
  muted: s.statusMuted,
};

export default function DetailStatusChip({
  status,
  tone,
  label,
  children,
  size = 'md',
}) {
  const normalized = typeof status === 'object' && status !== null ? status : {};
  const chipTone = tone || normalized.tone || 'neutral';
  const text = children || label || normalized.label || normalized.value || status;

  if (!text) return null;

  return (
    <span className={[
      s.statusChip,
      size === 'sm' ? s.statusChipSm : '',
      TONE_CLASS[chipTone] || TONE_CLASS.neutral,
    ].filter(Boolean).join(' ')}>
      <span aria-hidden="true" className={s.statusDot} />
      {text}
    </span>
  );
}
