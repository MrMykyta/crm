import { cloneElement, isValidElement } from 'react';

import s from './Workspace.module.css';

function mergeClassName(current, extra) {
  return [current, extra].filter(Boolean).join(' ');
}

function enhanceControl(child, kind) {
  if (!isValidElement(child)) return child;
  if (typeof child.type === 'string') return child;

  const nextProps = {
    contentClassName: mergeClassName(child.props.contentClassName, s.controlSelectContent),
  };

  if (kind === 'search') {
    nextProps.inputClassName = mergeClassName(child.props.inputClassName, s.controlSearchInput);
  } else {
    nextProps.inputClassName = mergeClassName(child.props.inputClassName, s.controlSelectTrigger);
  }

  return cloneElement(child, nextProps);
}

export default function WorkspaceFilterBox({
  icon,
  label,
  children,
  kind = 'filter',
}) {
  const className = kind === 'search'
    ? s.searchBox
    : kind === 'quick'
      ? s.quickBox
      : s.filterBox;
  return (
    <label className={className}>
      {icon}
      {label ? <span>{label}</span> : null}
      {enhanceControl(children, kind)}
    </label>
  );
}
