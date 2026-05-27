import { useState } from "react";
import {
  DndContext,
  closestCenter,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import SectionRenderer from "./renderers/SectionRenderer";
import { resolveStyleTokens } from "./utils/resolveStyleTokens";
import s from "./DocumentTemplateRenderer.module.css";

const measuringConfig = {
  droppable: { strategy: MeasuringStrategy.Always },
};

// --- ID helpers -----------------------------------------------------------

function parseBlockId(id) {
  const str = String(id ?? "");
  if (!str.startsWith("block:")) return null;
  const rest = str.slice(6);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  return { sectionKey: rest.slice(0, sep), blockKey: rest.slice(sep + 1) };
}

function parseSectionId(id) {
  const str = String(id ?? "");
  if (!str.startsWith("section:")) return null;
  return str.slice(8);
}

// --- Context normalization ------------------------------------------------

function normalizeRenderContext(renderContext = {}) {
  return {
    mode: renderContext?.mode || "editor_preview",
    channel: renderContext?.channel || "editor",
    locale: renderContext?.locale || "pl",
    selectedSectionKey: renderContext?.selectedSectionKey ?? null,
    selectedBlockKey: renderContext?.selectedBlockKey ?? null,
    selectedFieldKey: renderContext?.selectedFieldKey ?? null,
    isEditorInteractive: renderContext?.isEditorInteractive === true,
    onSectionClick:
      typeof renderContext?.onSectionClick === "function"
        ? renderContext.onSectionClick
        : null,
    onBlockClick:
      typeof renderContext?.onBlockClick === "function"
        ? renderContext.onBlockClick
        : null,
    onBlockReorder:
      typeof renderContext?.onBlockReorder === "function"
        ? renderContext.onBlockReorder
        : null,
    onMoveBlockToSection:
      typeof renderContext?.onMoveBlockToSection === "function"
        ? renderContext.onMoveBlockToSection
        : null,
    onBlockResizeEnd:
      typeof renderContext?.onBlockResizeEnd === "function"
        ? renderContext.onBlockResizeEnd
        : null,
  };
}

function getSections(templateDraft, isEditorInteractive) {
  const sections = Array.isArray(templateDraft?.sections) ? templateDraft.sections : [];
  return sections
    .filter((section) => section && (isEditorInteractive || section.enabled !== false))
    .sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
}

// --- Component ------------------------------------------------------------

export default function DocumentTemplateRenderer({
  templateDraft,
  dataContext,
  renderContext,
}) {
  // Hooks must be called before any early returns (rules of hooks).
  const [activeDragId, setActiveDragId] = useState(null);
  const [overSectionKey, setOverSectionKey] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (!templateDraft) {
    return <div className={s.emptyState}>No template draft loaded.</div>;
  }

  const normalizedContext = normalizeRenderContext(renderContext);
  const sections = getSections(templateDraft, normalizedContext.isEditorInteractive);
  const styleVars = resolveStyleTokens(templateDraft?.styleTokens || {});

  const activeSectionKey = activeDragId ? (parseBlockId(activeDragId)?.sectionKey ?? null) : null;

  // --- Drag handlers -------------------------------------------------------

  const handleDragStart = ({ active }) => {
    setActiveDragId(String(active.id));
    setDropIndicator(null);
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) {
      setOverSectionKey(null);
      setDropIndicator(null);
      return;
    }

    const overId = String(over.id);

    if (overId.startsWith("block:")) {
      const overInfo = parseBlockId(overId);
      if (!overInfo) {
        setOverSectionKey(null);
        setDropIndicator(null);
        return;
      }

      const targetSectionKey = overInfo.sectionKey;
      setOverSectionKey(targetSectionKey);

      const overSection = sections.find((sec) => sec.key === targetSectionKey);
      if (!overSection) {
        setDropIndicator(null);
        return;
      }

      const overBlocks = Array.isArray(overSection.blocks) ? overSection.blocks : [];
      const overBlockIdx = overBlocks.findIndex((b) => b?.key === overInfo.blockKey);

      // Determine insert before/after by comparing active center Y with over center Y.
      const activeTranslated = active.rect?.current?.translated;
      const overRect = over.rect;
      let insertAfter = false;
      if (activeTranslated && overRect) {
        const activeCenterY = activeTranslated.top + activeTranslated.height / 2;
        const overCenterY = overRect.top + overRect.height / 2;
        insertAfter = activeCenterY > overCenterY;
      }

      const targetIndex = overBlockIdx >= 0 ? (insertAfter ? overBlockIdx + 1 : overBlockIdx) : 0;
      setDropIndicator({ sectionKey: targetSectionKey, index: targetIndex });
    } else if (overId.startsWith("section:")) {
      const targetSectionKey = parseSectionId(overId);
      setOverSectionKey(targetSectionKey);
      setDropIndicator(targetSectionKey ? { sectionKey: targetSectionKey, index: 0 } : null);
    } else {
      setOverSectionKey(null);
      setDropIndicator(null);
    }
  };

  const handleDragEnd = ({ active, over }) => {
    const savedIndicator = dropIndicator;
    setActiveDragId(null);
    setOverSectionKey(null);
    setDropIndicator(null);

    if (!over || active.id === over.id) return;

    const activeInfo = parseBlockId(String(active.id));
    if (!activeInfo) return;
    const { sectionKey: srcSectionKey, blockKey: srcBlockKey } = activeInfo;

    const overId = String(over.id);
    let tgtSectionKey = null;
    let isSectionDrop = false;

    if (overId.startsWith("section:")) {
      tgtSectionKey = parseSectionId(overId);
      isSectionDrop = true;
    } else if (overId.startsWith("block:")) {
      const overInfo = parseBlockId(overId);
      if (!overInfo) return;
      tgtSectionKey = overInfo.sectionKey;
    } else {
      return;
    }

    if (!tgtSectionKey) return;

    if (srcSectionKey === tgtSectionKey) {
      // Same section — reorder
      const section = sections.find((sec) => sec.key === srcSectionKey);
      if (!section) return;
      const blockKeys = (Array.isArray(section.blocks) ? section.blocks : [])
        .map((b) => b?.key)
        .filter(Boolean);
      const oldIdx = blockKeys.indexOf(srcBlockKey);

      let newIdx;
      if (savedIndicator?.sectionKey === srcSectionKey) {
        // dropIndicator.index is the position in the original array (including the dragged block).
        // arrayMove semantics: adjust by -1 when moving forward (oldIdx < indicatorIdx) because
        // removing the item shifts subsequent items down by one.
        const rawIdx = savedIndicator.index;
        newIdx = oldIdx < rawIdx ? rawIdx - 1 : rawIdx;
      } else if (isSectionDrop) {
        newIdx = blockKeys.length - 1;
      } else {
        const overInfo = parseBlockId(overId);
        newIdx = overInfo ? blockKeys.indexOf(overInfo.blockKey) : -1;
      }

      if (oldIdx < 0 || newIdx < 0 || newIdx >= blockKeys.length || oldIdx === newIdx) return;
      normalizedContext.onBlockReorder?.(srcSectionKey, arrayMove(blockKeys, oldIdx, newIdx));
    } else {
      // Cross-section — move
      const tgtSection = sections.find((sec) => sec.key === tgtSectionKey);
      if (!tgtSection) return;
      const tgtBlocks = Array.isArray(tgtSection.blocks) ? tgtSection.blocks : [];

      let tgtIdx;
      if (savedIndicator?.sectionKey === tgtSectionKey) {
        tgtIdx = savedIndicator.index;
      } else if (isSectionDrop) {
        tgtIdx = tgtBlocks.length;
      } else {
        const overInfo = parseBlockId(overId);
        tgtIdx = overInfo
          ? Math.max(0, tgtBlocks.findIndex((b) => b?.key === overInfo.blockKey))
          : 0;
      }

      normalizedContext.onMoveBlockToSection?.(srcSectionKey, tgtSectionKey, srcBlockKey, tgtIdx);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setOverSectionKey(null);
    setDropIndicator(null);
  };

  // --- Render --------------------------------------------------------------

  if (sections.length === 0) {
    return (
      <article className={s.root} style={styleVars}>
        <div className={s.emptyState}>Template has no enabled sections.</div>
      </article>
    );
  }

  const article = (
    <article
      className={s.root}
      style={styleVars}
      data-render-mode={normalizedContext.mode}
      data-render-channel={normalizedContext.channel}
      data-render-locale={normalizedContext.locale}
    >
      {sections.map((section) => (
        <SectionRenderer
          key={section.key}
          section={section}
          dataContext={dataContext}
          renderContext={normalizedContext}
          isDropTarget={
            overSectionKey === section.key &&
            activeSectionKey !== null &&
            activeSectionKey !== section.key
          }
          dropIndicator={dropIndicator?.sectionKey === section.key ? dropIndicator : null}
        />
      ))}
    </article>
  );

  if (!normalizedContext.isEditorInteractive) {
    return article;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      measuring={measuringConfig}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {article}
    </DndContext>
  );
}
