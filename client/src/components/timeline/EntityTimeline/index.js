import { AlertTriangle, FileText, Info, Link2, Loader2, Pencil, PlusCircle } from "lucide-react";

import s from "./EntityTimeline.module.css";

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") {
    if (value.changed) return `changed (${value.length || 0})`;
    if (value.label) return value.label;
    if (value.id && value.name) return value.name;
    return JSON.stringify(value);
  }
  return String(value);
}

function getIcon(category) {
  switch (category) {
    case "created":
      return PlusCircle;
    case "updated":
    case "status_changed":
      return Pencil;
    case "document_created":
    case "document_sent":
    case "document_viewed":
    case "document_downloaded":
      return FileText;
    case "linked":
    case "unlinked":
      return Link2;
    default:
      return Info;
  }
}

function defaultFormatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function EntityTimeline({
  events = [],
  loading = false,
  error = false,
  emptyTitle,
  emptyText,
  loadingText,
  errorTitle,
  errorText,
  loadMoreLabel,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  formatDate = defaultFormatDate,
}) {
  if (loading) {
    return (
      <div className={s.state}>
        <span className={s.stateIcon} aria-hidden="true"><Loader2 size={18} /></span>
        <div>
          <strong>{loadingText || "Loading history"}</strong>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.state}>
        <span className={s.stateIcon} aria-hidden="true"><AlertTriangle size={18} /></span>
        <div>
          <strong>{errorTitle || "History is unavailable"}</strong>
          <p>{errorText || "Could not load timeline events."}</p>
        </div>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className={s.state}>
        <span className={s.stateIcon} aria-hidden="true"><Info size={18} /></span>
        <div>
          <strong>{emptyTitle || "No history yet"}</strong>
          <p>{emptyText || "Timeline events will appear here."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.timeline}>
      {events.map((event) => {
        const Icon = getIcon(event.eventCategory);
        const changes = Array.isArray(event.changes) ? event.changes : [];
        const links = Array.isArray(event.links) ? event.links : [];
        return (
          <article key={event.id} className={s.event}>
            <span className={s.eventIcon} aria-hidden="true"><Icon size={15} /></span>
            <div className={s.eventBody}>
              <header className={s.eventHeader}>
                <strong>{event.title || event.eventType}</strong>
                <span>{formatDate(event.createdAt)}</span>
              </header>
              {event.actorNameSnapshot ? <div className={s.actor}>{event.actorNameSnapshot}</div> : null}
              {event.summary ? <p className={s.summary}>{event.summary}</p> : null}
              {changes.length ? (
                <div className={s.changes}>
                  {changes.map((change) => (
                    <div key={`${event.id}:${change.field}`} className={s.change}>
                      <span className={s.changeLabel}>{change.label || change.field}</span>
                      <span className={s.changeValues}>
                        <b>{formatValue(change.oldValue)}</b>
                        <span>{"->"}</span>
                        <b>{formatValue(change.newValue)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {links.length ? (
                <div className={s.links}>
                  {links.map((link) => (
                    <span key={link.id}>{link.role}: {link.entityType}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      {hasMore ? (
        <button type="button" className={s.loadMore} onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? (loadingText || "Loading...") : (loadMoreLabel || "Load more")}
        </button>
      ) : null}
    </div>
  );
}
