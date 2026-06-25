import DetailContent from './DetailContent';
import DetailHeader from './DetailHeader';
import DetailSidebar from './DetailSidebar';
import s from './DetailLayout.module.css';

export default function DetailLayout({
  mode = 'entity',
  header,
  sidebar,
  content,
  children,
  breadcrumbs,
  title,
  subtitle,
  icon,
  status,
  priority,
  smartButtons,
  primaryAction,
  actions,
  overflowActions,
  saveState,
  metaPanel,
  documentEditor,
  tabs,
  activeTab,
  onActiveTabChange,
  className = '',
}) {
  const documentMode = mode === 'document';
  const headerNode = header || (
    <DetailHeader
      breadcrumbs={breadcrumbs}
      title={title}
      subtitle={subtitle}
      icon={icon}
      status={status}
      priority={priority}
      smartButtons={smartButtons}
      primaryAction={primaryAction}
      actionItems={actions}
      overflowActions={overflowActions}
      saveState={saveState}
    />
  );
  const sidebarNode = sidebar || (
    <DetailSidebar
      identity={metaPanel?.identity}
      sections={metaPanel?.sections}
    />
  );
  const contentNode = content || (
    <DetailContent
      tabs={tabs}
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
    >
      {documentMode ? documentEditor : null}
      {children}
    </DetailContent>
  );

  return (
    <div className={[
      s.layout,
      documentMode ? s.documentMode : s.entityMode,
      className,
    ].filter(Boolean).join(' ')}>
      {headerNode}
      <div className={s.bodyGrid}>
        {documentMode ? (
          <>
            {contentNode}
            {sidebarNode}
          </>
        ) : (
          <>
            {sidebarNode}
            {contentNode}
          </>
        )}
      </div>
    </div>
  );
}
