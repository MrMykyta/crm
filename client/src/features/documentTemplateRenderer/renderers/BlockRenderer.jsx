import { useState, useRef, useCallback } from "react";
import DocumentTitleBlock from "../blocks/DocumentTitleBlock";
import DocumentNumberBlock from "../blocks/DocumentNumberBlock";
import DocumentDatesBlock from "../blocks/DocumentDatesBlock";
import CompanyIdentityBlock from "../blocks/CompanyIdentityBlock";
import CounterpartyIdentityBlock from "../blocks/CounterpartyIdentityBlock";
import ItemsTableBlock from "../blocks/ItemsTableBlock";
import TotalsTableBlock from "../blocks/TotalsTableBlock";
import PaymentBlock from "../blocks/PaymentBlock";
import NotesBlock from "../blocks/NotesBlock";
import LegalFooterBlock from "../blocks/LegalFooterBlock";
import s from "../DocumentTemplateRenderer.module.css";

const BLOCK_COMPONENTS = {
  document_title: DocumentTitleBlock,
  document_number: DocumentNumberBlock,
  document_dates: DocumentDatesBlock,
  company_identity: CompanyIdentityBlock,
  counterparty_identity: CounterpartyIdentityBlock,
  items_table: ItemsTableBlock,
  totals_table: TotalsTableBlock,
  payment: PaymentBlock,
  notes: NotesBlock,
  legal_footer: LegalFooterBlock,
};

const SNAP_COLS = 12;
const MIN_FRACTION = 2 / SNAP_COLS;

function snapFraction(raw) {
  const snapped = Math.round(raw * SNAP_COLS) / SNAP_COLS;
  return Math.max(MIN_FRACTION, Math.min(1, snapped));
}

function resolveBlockStyle(layout = {}, overrideFraction = null) {
  const style = {};

  const hasFractionOverride =
    overrideFraction != null && Number.isFinite(overrideFraction);

  const widthMode = hasFractionOverride ? "fraction" : (layout?.widthMode || "auto");
  const widthValue = hasFractionOverride ? overrideFraction : Number(layout?.widthValue);

  if (widthMode === "fraction" && Number.isFinite(widthValue) && widthValue > 0) {
    const pct = `${Math.min(widthValue, 1) * 100}%`;
    style.flex = `0 0 ${pct}`;
    style.maxWidth = pct;
    style.minWidth = 0;
  } else if (widthMode === "fixed" && Number.isFinite(widthValue) && widthValue > 0) {
    style.flex = "0 0 auto";
    style.width = `${widthValue}px`;
  }

  const minWidthPx = Number(layout?.minWidthPx);
  if (!hasFractionOverride && Number.isFinite(minWidthPx) && minWidthPx > 0) {
    style.minWidth = `${minWidthPx}px`;
  }

  if (layout?.horizontalAlign === "center") {
    style.marginInline = "auto";
  } else if (layout?.horizontalAlign === "end") {
    style.marginInlineStart = "auto";
  }

  return style;
}

export default function BlockRenderer({
  sectionKey,
  block,
  dataContext,
  renderContext,
  // Optional sortable props — provided by SortableBlockWrapper, absent in plain render
  sortableRef,
  sortableStyle,
  sortableListeners,
  sortableAttributes,
  isDragging,
}) {
  const [dragWidthFraction, setDragWidthFraction] = useState(null);
  const ownRef = useRef(null);
  const resizeStartRef = useRef(null);

  const blockType = String(block?.type || "").trim();
  const BlockComponent = BLOCK_COMPONENTS[blockType];

  const isInteractive = renderContext?.isEditorInteractive === true;
  const isSelected =
    isInteractive &&
    renderContext?.selectedSectionKey === sectionKey &&
    renderContext?.selectedBlockKey === block?.key;

  const isResizing = dragWidthFraction != null;

  const onBlockClick =
    isInteractive && typeof renderContext?.onBlockClick === "function"
      ? (e) => {
          e.stopPropagation();
          renderContext.onBlockClick(sectionKey, block?.key ?? null);
        }
      : undefined;

  // Merge ownRef with dnd-kit's setNodeRef without adding a DOM wrapper.
  const setRef = useCallback(
    (el) => {
      ownRef.current = el;
      if (typeof sortableRef === "function") sortableRef(el);
    },
    [sortableRef]
  );

  // ─── Resize handle handlers ───────────────────────────────────────────────

  const handleResizePointerDown = (e) => {
    if (!isSelected) return;
    // Prevent dnd-kit from seeing this event.
    e.stopPropagation();
    e.preventDefault();
    // Capture pointer so move/up fire on this element even when cursor leaves.
    e.currentTarget.setPointerCapture(e.pointerId);

    const blockEl = ownRef.current;
    const containerEl = blockEl?.parentElement;
    if (!blockEl || !containerEl) return;

    const containerWidth = containerEl.getBoundingClientRect().width;
    if (containerWidth <= 0) return;

    resizeStartRef.current = {
      containerWidth,
      startX: e.clientX,
      startBlockWidth: blockEl.getBoundingClientRect().width,
    };
  };

  const handleResizePointerMove = (e) => {
    const drag = resizeStartRef.current;
    if (!drag) return;
    const delta = e.clientX - drag.startX;
    const raw = (drag.startBlockWidth + delta) / drag.containerWidth;
    setDragWidthFraction(snapFraction(raw));
  };

  const handleResizePointerUp = (e) => {
    const drag = resizeStartRef.current;
    if (!drag) return;
    const delta = e.clientX - drag.startX;
    const raw = (drag.startBlockWidth + delta) / drag.containerWidth;
    const finalFraction = snapFraction(raw);

    resizeStartRef.current = null;
    setDragWidthFraction(null);
    renderContext?.onBlockResizeEnd?.(sectionKey, block?.key, finalFraction);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={setRef}
      className={[
        s.block,
        isSelected ? s.blockSelected : "",
        isDragging ? s.blockDragging : "",
        isResizing ? s.blockResizing : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ...resolveBlockStyle(block?.layout, dragWidthFraction), ...sortableStyle }}
      data-block-key={block?.key ?? ""}
      data-block-type={blockType || "unknown"}
      onClick={onBlockClick}
      {...(sortableListeners ?? {})}
      {...(sortableAttributes ?? {})}
    >
      {BlockComponent ? (
        <BlockComponent
          block={block}
          dataContext={dataContext}
          renderContext={renderContext}
        />
      ) : (
        <div className={s.unknownBlock}>
          <strong>Unsupported block:</strong> {blockType || "unknown"}
        </div>
      )}
      {isSelected ? (
        <div
          className={s.blockResizeHandle}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      ) : null}
    </div>
  );
}
