import { useState, useMemo } from "react";
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
import s from "./LeftPanel.module.css";

const SECTION_TYPES = [
  "header",
  "seller_buyer",
  "document_meta",
  "items_table",
  "totals",
  "payment",
  "notes",
  "legal_footer",
  "custom",
];

const measuringConfig = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

function SectionRowContent({ section, idx, isDisabled, isLocked }) {
  return (
    <>
      <span className={s.primaryText}>
        {section.key}
        {isLocked && <span className={s.sectionBadge}>lock</span>}
        {isDisabled && (
          <span className={`${s.sectionBadge} ${s.sectionMuted}`}>off</span>
        )}
      </span>
      <span className={s.secondaryText}>
        {section.type} &middot; #{idx}
      </span>
    </>
  );
}

function SortableSectionRow({ section, idx, isActive, onSelect, moveSection, isFirst, isLast }) {
  const isDisabled = section.enabled === false;
  const isLocked = Boolean(section.locked);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 5 : "auto",
  };

  return (
    <li ref={setNodeRef} style={style} className={s.sortableItem}>
      <div
        className={[
          s.sectionRow,
          isActive ? s.sectionRowActive : "",
          isDisabled ? s.sectionRowDisabled : "",
          isDragging ? s.sectionRowSource : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className={s.dragHandle}
          {...attributes}
          {...listeners}
          tabIndex={-1}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          ⠿
        </button>

        <button
          type="button"
          className={s.sectionRowMain}
          onClick={() => onSelect(section.key)}
        >
          <SectionRowContent
            section={section}
            idx={idx}
            isDisabled={isDisabled}
            isLocked={isLocked}
          />
        </button>

        <div className={s.sectionRowActions}>
          <button
            type="button"
            className={s.sectionMoveButton}
            onClick={(e) => {
              e.stopPropagation();
              moveSection(section.key, "up");
            }}
            disabled={isFirst}
            title="Move up"
            aria-label="Move section up"
          >
            ↑
          </button>
          <button
            type="button"
            className={s.sectionMoveButton}
            onClick={(e) => {
              e.stopPropagation();
              moveSection(section.key, "down");
            }}
            disabled={isLast}
            title="Move down"
            aria-label="Move section down"
          >
            ↓
          </button>
        </div>
      </div>
    </li>
  );
}

export default function SectionsTab() {
  const draft = useEditorStore((state) => state.draft);
  const addSection = useEditorStore((state) => state.addSection);
  const moveSection = useEditorStore((state) => state.moveSection);
  const reorderSections = useEditorStore((state) => state.reorderSections);
  const { selectedSectionKey, selectSection } = useEditorSelection();

  const [newType, setNewType] = useState("custom");

  const sections = useMemo(() => {
    const raw = Array.isArray(draft?.sections) ? draft.sections : [];
    return [...raw].sort((a, b) => Number(a.order) - Number(b.order));
  }, [draft]);

  const sectionIds = useMemo(() => sections.map((sec) => sec.key), [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = sectionIds.indexOf(active.id);
    const newIndex = sectionIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextKeys = arrayMove(sectionIds, oldIndex, newIndex);
    reorderSections(nextKeys);
  };

  return (
    <div className={s.sectionsTabWrap}>
      <div className={s.sectionToolbar}>
        <select
          className={s.sectionTypeSelect}
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          aria-label="New section type"
        >
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={s.sectionAddButton}
          onClick={() => addSection(newType)}
          aria-label="Add section"
        >
          + Add
        </button>
      </div>

      {sections.length === 0 ? (
        <div className={s.placeholder}>No sections in draft.</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          measuring={measuringConfig}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            <ul className={s.list}>
              {sections.map((section, idx) => (
                <SortableSectionRow
                  key={section.key}
                  section={section}
                  idx={idx}
                  isActive={selectedSectionKey === section.key}
                  isFirst={idx === 0}
                  isLast={idx === sections.length - 1}
                  onSelect={selectSection}
                  moveSection={moveSection}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
