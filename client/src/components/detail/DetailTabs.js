import { useMemo, useState } from 'react';

import s from './DetailLayout.module.css';

function getDefaultTab(tabs) {
  return tabs.find((tab) => tab.key === 'overview' && !tab.hidden)?.key
    || tabs.find((tab) => !tab.hidden)?.key
    || '';
}

export default function DetailTabs({
  tabs = [],
  activeTab,
  onActiveTabChange,
  lazy = true,
}) {
  const visibleTabs = useMemo(() => tabs.filter((tab) => tab && !tab.hidden), [tabs]);
  const defaultTab = getDefaultTab(visibleTabs);
  const [internalActive, setInternalActive] = useState(defaultTab);
  const current = activeTab || internalActive || defaultTab;

  const setActive = (key) => {
    if (!activeTab) setInternalActive(key);
    onActiveTabChange?.(key);
  };

  if (!visibleTabs.length) return null;

  return (
    <div className={s.tabsWrap}>
      <div className={s.tabsList} role="tablist" aria-label="Detail tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === current}
            className={[s.tabButton, tab.key === current ? s.tabActive : ''].filter(Boolean).join(' ')}
            onClick={() => setActive(tab.key)}
          >
            {tab.icon ? <span>{tab.icon}</span> : null}
            {tab.label}
            {tab.count !== undefined ? <em>{tab.count}</em> : null}
          </button>
        ))}
      </div>
      <div className={s.tabPanels}>
        {visibleTabs.map((tab) => {
          const shouldRender = !lazy || tab.keepMounted || tab.key === current;
          if (!shouldRender) return null;
          return (
            <section
              key={tab.key}
              role="tabpanel"
              hidden={tab.key !== current}
              className={s.tabPanel}
            >
              {typeof tab.render === 'function' ? tab.render() : tab.children}
            </section>
          );
        })}
      </div>
    </div>
  );
}
