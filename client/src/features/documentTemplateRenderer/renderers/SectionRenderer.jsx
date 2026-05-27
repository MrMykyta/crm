import { Fragment } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import BlockRenderer from "./BlockRenderer";
import s from "../DocumentTemplateRenderer.module.css";

// Empty-section droppable — gives dnd-kit a target when no blocks exist.
function DroppableEmptyHint({ sectionKey, isDropTarget, hasDropIndicator }) {
  const { setNodeRef } = useDroppable({ id: `section:${sectionKey}` });
  return (
    <div
      ref={setNodeRef}
      className={[
        s.sectionEmptyHint,
        isDropTarget || hasDropIndicator ? s.sectionEmptyHintDropTarget : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      Drop a block here
    </div>
  );
}

// Applies useSortable directly to BlockRenderer's root div via prop forwarding.
// No extra DOM node — layout is identical to the non-interactive render.
function SortableBlockWrapper({ block, idx, sectionKey, dataContext, renderContext }) {
  const compositeId = `block:${sectionKey}:${block?.key ?? idx}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: compositeId });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <BlockRenderer
      sectionKey={sectionKey}
      block={block}
      dataContext={dataContext}
      renderContext={renderContext}
      sortableRef={setNodeRef}
      sortableStyle={sortableStyle}
      sortableListeners={listeners}
      sortableAttributes={attributes}
      isDragging={isDragging}
    />
  );
}

export default function SectionRenderer({
  section,
  dataContext,
  renderContext,
  isDropTarget,
  dropIndicator,
}) {
  const blocks = Array.isArray(section?.blocks) ? [...section.blocks] : [];
  const layoutMode = section?.layoutMode || "flow";
  const isInteractive = renderContext?.isEditorInteractive === true;
  const isSelected = isInteractive && renderContext?.selectedSectionKey === section?.key;
  const isDisabled = section?.enabled === false;

  const onSectionClick =
    isInteractive && typeof renderContext?.onSectionClick === "function"
      ? () => renderContext.onSectionClick(section?.key || null)
      : undefined;

  const sectionClassName = [
    s.section,
    isSelected ? s.sectionSelected : "",
    isInteractive && isDisabled ? s.sectionDisabled : "",
    isInteractive && isDropTarget ? s.sectionDropTarget : "",
  ]
    .filter(Boolean)
    .join(" ");

  const contentClassName = [
    s.sectionContent,
    layoutMode === "grid" ? s.modeGrid : layoutMode === "fixed" ? s.modeFixed : s.modeFlow,
  ].join(" ");

  // Non-interactive (preview / print) — plain render, zero DnD
  if (!isInteractive) {
    return (
      <section
        className={sectionClassName}
        data-section-key={section?.key || ""}
        data-layout-mode={layoutMode}
      >
        <div className={contentClassName}>
          {blocks.map((block, idx) => (
            <BlockRenderer
              key={block?.key || `${section?.key ?? "section"}-block-${idx}`}
              sectionKey={section?.key}
              block={block}
              dataContext={dataContext}
              renderContext={renderContext}
            />
          ))}
        </div>
      </section>
    );
  }

  // Interactive (design) — SortableContext for this section's blocks.
  // DndContext lives one level up in DocumentTemplateRenderer.
  const blockCompositeIds = blocks.map((b) => `block:${section?.key}:${b?.key}`);

  return (
    <section
      className={sectionClassName}
      data-section-key={section?.key || ""}
      data-layout-mode={layoutMode}
      onClick={onSectionClick}
    >
      <header className={s.sectionHeader}>
        <span className={s.sectionTitle}>{section?.key || "section"}</span>
        {isDisabled && <span className={s.sectionTitle}>(disabled)</span>}
      </header>

      {blocks.length === 0 ? (
        <DroppableEmptyHint
          sectionKey={section?.key}
          isDropTarget={isDropTarget}
          hasDropIndicator={dropIndicator !== null && dropIndicator !== undefined}
        />
      ) : (
        <SortableContext items={blockCompositeIds} strategy={verticalListSortingStrategy}>
          <div className={contentClassName}>
            {blocks.map((block, idx) => (
              <Fragment key={block?.key || `${section?.key ?? "section"}-block-${idx}`}>
                {dropIndicator?.index === idx ? (
                  <div className={s.blockDropIndicator} />
                ) : null}
                <SortableBlockWrapper
                  block={block}
                  idx={idx}
                  sectionKey={section?.key}
                  dataContext={dataContext}
                  renderContext={renderContext}
                />
              </Fragment>
            ))}
            {dropIndicator?.index === blocks.length ? (
              <div className={s.blockDropIndicator} />
            ) : null}
          </div>
        </SortableContext>
      )}
    </section>
  );
}
