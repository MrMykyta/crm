import { useState, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useEditorStore } from "../../store/editorStore";
import { useEditorSelection } from "../../hooks/useEditorSelection";
import s from "./RightPanel.module.css";

const measuringConfig = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

function SortableBlockMiniItem({
  block,
  isBlockActive,
  onSelect,
  onDuplicate,
  onDelete,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 5 : "auto",
  };

  return (
    <li ref={setNodeRef} style={style} className={s.blockMiniItem}>
      <button
        type="button"
        className={[
          s.blockMiniRow,
          isBlockActive ? s.blockMiniRowActive : "",
          isDragging ? s.blockMiniItemDragging : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onSelect}
        {...attributes}
        {...listeners}
      >
        <div className={s.blockMiniMeta}>
          <span className={s.blockMiniKey}>{block.key}</span>
          <span className={s.blockMiniType}>{block.type || "—"}</span>
        </div>
      </button>
      <div className={s.blockMiniActions}>
        <button
          type="button"
          className={s.blockMiniActionBtn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDuplicate}
          title="Duplicate block"
        >
          ⊕
        </button>
        <button
          type="button"
          className={`${s.blockMiniActionBtn} ${s.blockMiniActionDanger}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          title="Delete block"
        >
          ×
        </button>
      </div>
    </li>
  );
}

export default function SectionInspector({ sectionKey }) {
  const { selectedSection, selectedBlockKey } = useEditorSelection();

  const draft = useEditorStore((state) => state.draft);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);
  const updateSection = useEditorStore((state) => state.updateSection);
  const removeSection = useEditorStore((state) => state.removeSection);
  const duplicateSection = useEditorStore((state) => state.duplicateSection);
  const moveSection = useEditorStore((state) => state.moveSection);
  const renameSection = useEditorStore((state) => state.renameSection);
  const removeBlock = useEditorStore((state) => state.removeBlock);
  const duplicateBlock = useEditorStore((state) => state.duplicateBlock);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);

  const [localKey, setLocalKey] = useState(sectionKey || "");
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    setLocalKey(sectionKey || "");
    setKeyError("");
  }, [sectionKey]);

  const sortedSections = useMemo(() => {
    const raw = Array.isArray(draft?.sections) ? draft.sections : [];
    return [...raw].sort((a, b) => Number(a.order) - Number(b.order));
  }, [draft]);

  const allKeys = useMemo(
    () => sortedSections.map((sec) => sec?.key),
    [sortedSections]
  );

  // Hooks must be called before any early return
  const blockSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const section = selectedSection;
  const blocks = useMemo(
    () => (Array.isArray(section?.blocks) ? section.blocks : []),
    [section]
  );
  const blockIds = useMemo(() => blocks.map((b) => b.key), [blocks]);

  const sectionCount = sortedSections.length;
  const sectionIdx = sortedSections.findIndex((sec) => sec?.key === sectionKey);
  const isFirst = sectionIdx === 0;
  const isLast = sectionIdx === sectionCount - 1;

  const handleBlockDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = blockIds.indexOf(active.id);
    const newIndex = blockIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderBlocks(sectionKey, arrayMove(blockIds, oldIndex, newIndex));
  };

  if (!section) {
    return (
      <section className={s.panel}>
        <h3 className={s.title}>Section</h3>
        <div className={s.note}>No section selected.</div>
      </section>
    );
  }

  const isLocked = Boolean(section.locked);
  const isEnabled = section.enabled !== false;
  const blockCount = blocks.length;
  const canDelete = !isLocked && sectionCount > 1;
  const canSaveKey =
    localKey.trim() !== "" && localKey.trim() !== sectionKey && !keyError;

  const handleLocalKeyChange = (e) => {
    const val = e.target.value;
    setLocalKey(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setKeyError("Key cannot be empty.");
    } else if (trimmed !== sectionKey && allKeys.includes(trimmed)) {
      setKeyError("Key already exists.");
    } else {
      setKeyError("");
    }
  };

  const handleRenameSave = () => {
    const trimmed = localKey.trim();
    if (!trimmed) {
      setKeyError("Key cannot be empty.");
      return;
    }
    if (trimmed === sectionKey) return;
    if (allKeys.includes(trimmed)) {
      setKeyError("Key already exists.");
      return;
    }
    renameSection(sectionKey, trimmed);
  };

  const handleKeyInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSave();
    }
    if (e.key === "Escape") {
      setLocalKey(sectionKey);
      setKeyError("");
    }
  };

  const handleEnabledChange = (e) => {
    updateSection(sectionKey, { enabled: e.target.checked });
  };

  const handleLayoutModeChange = (e) => {
    updateSection(sectionKey, { layoutMode: e.target.value });
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (blockCount > 0) {
      const confirmed = window.confirm(
        `This section contains ${blockCount} block${blockCount !== 1 ? "s" : ""}. Remove it anyway?`
      );
      if (!confirmed) return;
    }
    removeSection(sectionKey);
  };

  return (
    <section className={s.panel}>
      {/* Header */}
      <div className={s.titleRow}>
        <h3 className={s.title}>Section</h3>
        <div className={s.badgeRow}>
          {isLocked && <span className={s.badge}>locked</span>}
          {!isEnabled && <span className={`${s.badge} ${s.badgeMuted}`}>off</span>}
          <span className={s.badge}>{blockCount} blk</span>
        </div>
      </div>

      {/* Static meta */}
      <div className={s.metaList}>
        <div className={s.row}>
          <span className={s.label}>Type</span>
          <span className={s.value}>{section.type || "—"}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Order</span>
          <span className={s.value}>{sectionIdx >= 0 ? sectionIdx : "—"}</span>
        </div>
      </div>

      {/* Key rename */}
      <div className={s.formGroup}>
        <label className={s.fieldLabel}>Section key</label>
        <div className={s.sectionKeyEditRow}>
          <input
            className={`${s.input}${keyError ? ` ${s.inputError}` : ""}`}
            value={localKey}
            onChange={handleLocalKeyChange}
            onKeyDown={handleKeyInputKeyDown}
            spellCheck={false}
            aria-label="Section key"
          />
          <button
            type="button"
            className={s.smallButton}
            onClick={handleRenameSave}
            disabled={!canSaveKey}
            title="Save key (Enter)"
          >
            Save
          </button>
        </div>
        {keyError && <span className={s.localError}>{keyError}</span>}
      </div>

      {/* Enabled + layout */}
      <div className={s.formBlock}>
        <label className={s.checkboxRow}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleEnabledChange}
          />
          Enabled
        </label>

        <div className={s.formGroup}>
          <label className={s.fieldLabel}>Layout mode</label>
          <select
            className={s.select}
            value={section.layoutMode || "flow"}
            onChange={handleLayoutModeChange}
          >
            <option value="flow">flow</option>
            <option value="grid">grid</option>
            <option value="fixed">fixed</option>
          </select>
        </div>
      </div>

      {isLocked && (
        <div className={s.warningNote}>Locked section cannot be removed.</div>
      )}

      {/* Move actions */}
      <div className={s.actionRow}>
        <button
          type="button"
          className={s.actionButton}
          onClick={() => moveSection(sectionKey, "up")}
          disabled={isFirst}
          title="Move section up"
        >
          ↑ Up
        </button>
        <button
          type="button"
          className={s.actionButton}
          onClick={() => moveSection(sectionKey, "down")}
          disabled={isLast}
          title="Move section down"
        >
          ↓ Down
        </button>
      </div>

      {/* Structural actions */}
      <div className={s.actionRow}>
        <button
          type="button"
          className={s.actionButton}
          onClick={() => duplicateSection(sectionKey)}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={s.dangerButton}
          onClick={handleDelete}
          disabled={!canDelete}
          title={
            isLocked
              ? "Locked section cannot be removed"
              : sectionCount <= 1
              ? "Cannot remove the only section"
              : undefined
          }
        >
          Delete
        </button>
      </div>

      {/* Blocks */}
      <div className={s.formGroup}>
        <span className={s.fieldLabel}>Blocks</span>
        {blocks.length === 0 ? (
          <div className={s.note}>No blocks in this section.</div>
        ) : (
          <DndContext
            sensors={blockSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            measuring={measuringConfig}
            onDragEnd={handleBlockDragEnd}
          >
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
              <ul className={s.blocksList}>
                {blocks.map((block) => (
                  <SortableBlockMiniItem
                    key={block.key}
                    block={block}
                    isBlockActive={selectedBlockKey === block.key}
                    onSelect={() => setSelectedBlock(sectionKey, block.key)}
                    onDuplicate={() => duplicateBlock(sectionKey, block.key)}
                    onDelete={() => removeBlock(sectionKey, block.key)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </section>
  );
}
