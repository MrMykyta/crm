import DetailTabs from './DetailTabs';
import s from './DetailLayout.module.css';

export default function DetailContent({
  tabs,
  activeTab,
  onActiveTabChange,
  children,
}) {
  return (
    <main className={s.content}>
      {children}
      {tabs ? (
        <DetailTabs
          tabs={tabs}
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
        />
      ) : null}
    </main>
  );
}
