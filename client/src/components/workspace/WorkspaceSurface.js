import s from './Workspace.module.css';

export default function WorkspaceSurface({
  as: Component = 'div',
  className = '',
  children,
  ...props
}) {
  return (
    <Component className={`${s.surface} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
