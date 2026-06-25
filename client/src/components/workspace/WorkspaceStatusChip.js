import s from './Workspace.module.css';
import {
  workspaceStatusMarkers,
  workspaceTones,
} from './workspaceTokens';

const STATUS_TONE = Object.freeze({
  draft: workspaceTones.neutral,
  new: workspaceTones.neutral,
  planned: workspaceTones.neutral,
  open: workspaceTones.neutral,
  counting: workspaceTones.progress,
  packing: workspaceTones.progress,
  picking: workspaceTones.progress,
  in_transit: workspaceTones.progress,
  intransit: workspaceTones.progress,
  partial: workspaceTones.progress,
  partial_received: workspaceTones.progress,
  partially_received: workspaceTones.progress,
  partially_shipped: workspaceTones.progress,
  needs_action: workspaceTones.warning,
  received: workspaceTones.success,
  shipped: workspaceTones.success,
  posted: workspaceTones.success,
  reconciled: workspaceTones.success,
  completed: workspaceTones.success,
  done: workspaceTones.success,
  active: workspaceTones.success,
  warning: workspaceTones.warning,
  blocked: workspaceTones.danger,
  blocking: workspaceTones.danger,
  failed: workspaceTones.danger,
  error: workspaceTones.danger,
  negative: workspaceTones.danger,
  corrected: workspaceTones.muted,
  canceled: workspaceTones.muted,
  cancelled: workspaceTones.muted,
  closed: workspaceTones.muted,
  archived: workspaceTones.muted,
  inactive: workspaceTones.muted,
});

const TONE_MARKER = Object.freeze({
  [workspaceTones.neutral]: workspaceStatusMarkers.solid,
  [workspaceTones.progress]: workspaceStatusMarkers.half,
  [workspaceTones.success]: workspaceStatusMarkers.solid,
  [workspaceTones.warning]: workspaceStatusMarkers.warning,
  [workspaceTones.danger]: workspaceStatusMarkers.danger,
  [workspaceTones.muted]: workspaceStatusMarkers.solid,
  [workspaceTones.info]: workspaceStatusMarkers.solid,
});

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function getWorkspaceStatusTone(status, fallbackTone = workspaceTones.neutral) {
  return STATUS_TONE[normalizeStatus(status)] || fallbackTone;
}

export function getWorkspaceStatusMarker(statusOrTone, explicitTone) {
  const tone = explicitTone || getWorkspaceStatusTone(statusOrTone);
  return TONE_MARKER[tone] || workspaceStatusMarkers.solid;
}

export default function WorkspaceStatusChip({
  status,
  tone,
  marker,
  size = 'md',
  children,
  className = '',
}) {
  const resolvedTone = tone || getWorkspaceStatusTone(status);
  const resolvedMarker = marker || getWorkspaceStatusMarker(status, resolvedTone);
  const label = children != null ? children : (String(status || '').trim() || '-');
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
