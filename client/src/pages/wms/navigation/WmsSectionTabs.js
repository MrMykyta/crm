import { NavLink } from 'react-router-dom';

import s from './WmsSectionTabs.module.css';

export default function WmsSectionTabs({ title, groups = [] }) {
  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h1>{title}</h1>
      </div>
      <div className={s.groups}>
        {groups.map((group) => (
          <div className={s.group} key={group.key || group.label}>
            {group.label ? <span className={s.groupLabel}>{group.label}</span> : null}
            <div className={s.tabs}>
              {(group.items || []).map((item) => (
                <NavLink
                  key={item.key || item.to}
                  to={item.to}
                  className={() => `${s.tab} ${item.active ? s.active : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
