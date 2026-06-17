import s from './WmsUi.module.css';
import { getWmsStatusLabel, getWmsStatusMarker, getWmsStatusTone } from './wmsStatusModel';

export default function WmsStatusChip({
  status,
  tone,
  marker,
  size = 'md',
  children,
  className = '',
}) {
  const resolvedTone = tone || getWmsStatusTone(status);
  const resolvedMarker = marker || getWmsStatusMarker(status, resolvedTone);
  const label = children != null ? children : getWmsStatusLabel(status);
  const cls = [
    s.statusChip,
    s[`tone_${resolvedTone}`],
    s[`size_${size}`],
    className,
  ].filter(Boolean).join(' ');
  const markerCls = [
    s.statusMarker,
    s[`marker_${resolvedMarker}`],
  ].filter(Boolean).join(' ');

  return (
    <span className={cls} data-tone={resolvedTone} data-marker={resolvedMarker}>
      <span className={markerCls} aria-hidden="true" />
      <span className={s.statusLabel}>{label}</span>
    </span>
  );
}
