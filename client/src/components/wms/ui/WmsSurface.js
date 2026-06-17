import s from './WmsUi.module.css';

export default function WmsSurface({
  as: Component = 'section',
  variant = 'panel',
  padding = 'md',
  className = '',
  children,
  ...props
}) {
  const cls = [
    s.surface,
    s[`surface_${variant}`],
    s[`pad_${padding}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <Component className={cls} {...props}>
      {children}
    </Component>
  );
}
