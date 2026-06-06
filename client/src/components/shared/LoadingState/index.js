import s from './LoadingState.module.css';

/**
 * LoadingState — inline loading indicator (spinner or skeleton rows).
 *
 * Use for: pages/sections/tabs waiting on data.
 * Don't use for: button-internal spinners (handle inline in the button).
 *
 * Props:
 *  - variant: 'spinner'|'skeleton'
 *  - label: accessible/visible text for spinner variant
 *  - rows: skeleton row count (skeleton variant)
 *  - size: 'sm'|'md'
 */
export default function LoadingState({
  variant = 'spinner',
  label,
  rows = 3,
  size = 'md',
  className = '',
}) {
  if (variant === 'skeleton') {
    const count = Math.max(1, Number(rows) || 1);
    return (
      <div className={`${s.skeletonWrap} ${className}`.trim()} aria-busy="true" aria-live="polite">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={s.skeletonRow} />
        ))}
      </div>
    );
  }

  return (
    <div className={`${s.spinnerWrap} ${s[size]} ${className}`.trim()} role="status" aria-live="polite">
      <span className={s.spinner} aria-hidden="true" />
      {label ? <span className={s.label}>{label}</span> : null}
    </div>
  );
}
