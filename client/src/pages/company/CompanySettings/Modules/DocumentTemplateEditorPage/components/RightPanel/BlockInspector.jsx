import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
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
import { useEditorSelection } from "../../hooks/useEditorSelection";
import { useEditorStore } from "../../store/editorStore";
import s from "./RightPanel.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_COLUMNS = [
  "lp",
  "name",
  "quantity",
  "unit",
  "unitNetPrice",
  "vatRate",
  "netAmount",
  "vatAmount",
  "grossAmount",
];

const FIELD_CATALOGS = {
  document_dates: [
    { key: "issueDate", label: "Issue Date" },
    { key: "saleDate", label: "Sale Date" },
    { key: "dueDate", label: "Due Date" },
  ],
  company_identity: [
    { key: "legalName", label: "Legal Name" },
    { key: "address", label: "Address" },
    { key: "nip", label: "NIP" },
    { key: "regon", label: "REGON" },
    { key: "bankAccount", label: "Bank Account" },
  ],
  counterparty_identity: [
    { key: "legalName", label: "Legal Name" },
    { key: "address", label: "Address" },
    { key: "nip", label: "NIP" },
    { key: "regon", label: "REGON" },
  ],
  payment: [
    { key: "method", label: "Method" },
    { key: "dueDate", label: "Due Date" },
    { key: "daysNet", label: "Days Net" },
    { key: "bankAccount", label: "Bank Account" },
    { key: "bankName", label: "Bank Name" },
  ],
  items_table: [
    { key: "lp", label: "LP" },
    { key: "name", label: "Name" },
    { key: "quantity", label: "Quantity" },
    { key: "unit", label: "Unit" },
    { key: "unitNetPrice", label: "Unit Net Price" },
    { key: "vatRate", label: "VAT Rate" },
    { key: "netAmount", label: "Net Amount" },
    { key: "vatAmount", label: "VAT Amount" },
    { key: "grossAmount", label: "Gross Amount" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOptionalNumber(value) {
  if (value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return ITEM_COLUMNS;
  return columns.filter((col) => ITEM_COLUMNS.includes(col));
}

// ─── Sortable field row ───────────────────────────────────────────────────────

function SortableFieldRow({ field, config, onToggle, onLabelChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.key,
  });

  // Local state keeps typing smooth; store is only updated on blur.
  const [localLabel, setLocalLabel] = useState(config?.label ?? field.label);

  useEffect(() => {
    setLocalLabel(config?.label ?? field.label);
  }, [config?.label, field.label]);

  const enabled = config?.enabled ?? true;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        s.fieldConfigItem,
        isDragging ? s.fieldConfigItemDragging : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={s.fieldDragHandle}
        {...listeners}
        {...attributes}
        title="Drag to reorder"
      >
        ⠿
      </div>
      <label className={s.fieldConfigToggle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(field.key, e.target.checked)}
        />
      </label>
      <div className={s.fieldConfigMeta}>
        <span className={s.fieldConfigKey}>{field.key}</span>
        <input
          className={s.fieldConfigLabelInput}
          value={localLabel}
          onChange={(e) => setLocalLabel(e.target.value)}
          onBlur={() => onLabelChange(field.key, localLabel)}
          placeholder={field.label}
        />
      </div>
    </div>
  );
}

// ─── Field config list ────────────────────────────────────────────────────────

function FieldConfigList({ blockType, blockProps, sectionKey, blockKey }) {
  const updateBlockFieldConfig = useEditorStore((state) => state.updateBlockFieldConfig);
  const reorderBlockFields = useEditorStore((state) => state.reorderBlockFields);
  const updateBlockProps = useEditorStore((state) => state.updateBlockProps);

  const catalog = FIELD_CATALOGS[blockType] ?? null;
  const fieldsConfig = blockProps?.fieldsConfig || {};

  const columns = useMemo(() => normalizeColumns(blockProps?.columns), [blockProps?.columns]);

  const sortedFields = useMemo(() => {
    if (!catalog) return [];
    return [...catalog].sort((a, b) => {
      const idxA = catalog.findIndex((f) => f.key === a.key);
      const idxB = catalog.findIndex((f) => f.key === b.key);
      const orderA = fieldsConfig[a.key]?.order ?? idxA;
      const orderB = fieldsConfig[b.key]?.order ?? idxB;
      return orderA - orderB;
    });
  }, [catalog, fieldsConfig]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  if (!catalog) return null;

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sortedFields.findIndex((f) => f.key === active.id);
    const newIndex = sortedFields.findIndex((f) => f.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sortedFields, oldIndex, newIndex);
    reorderBlockFields(sectionKey, blockKey, reordered.map((f) => f.key));
  };

  const handleToggle = (fieldKey, enabled) => {
    updateBlockFieldConfig(sectionKey, blockKey, fieldKey, { enabled });
    // items_table: keep props.columns array in sync for renderer backward compat.
    if (blockType === "items_table") {
      let nextColumns;
      if (enabled) {
        const active = new Set([...columns, fieldKey]);
        nextColumns = ITEM_COLUMNS.filter((col) => active.has(col));
      } else {
        nextColumns = columns.filter((col) => col !== fieldKey);
      }
      updateBlockProps(sectionKey, blockKey, { columns: nextColumns });
    }
  };

  const handleLabelChange = (fieldKey, label) => {
    updateBlockFieldConfig(sectionKey, blockKey, fieldKey, { label });
  };

  const fieldIds = sortedFields.map((f) => f.key);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        <div className={s.fieldConfigList}>
          {sortedFields.map((field) => (
            <SortableFieldRow
              key={field.key}
              field={field}
              config={fieldsConfig[field.key]}
              onToggle={handleToggle}
              onLabelChange={handleLabelChange}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── Main inspector ───────────────────────────────────────────────────────────

export default function BlockInspector({ blockKey }) {
  const { selectedSectionKey, selectedBlockKey, selectedBlock } = useEditorSelection();
  const updateBlock = useEditorStore((state) => state.updateBlock);
  const updateBlockProps = useEditorStore((state) => state.updateBlockProps);
  const updateBlockLayout = useEditorStore((state) => state.updateBlockLayout);
  const updateBlockBindings = useEditorStore((state) => state.updateBlockBindings);
  const removeBlock = useEditorStore((state) => state.removeBlock);
  const duplicateBlock = useEditorStore((state) => state.duplicateBlock);

  const [bindingsText, setBindingsText] = useState("{}");
  const [bindingsError, setBindingsError] = useState("");

  useEffect(() => {
    setBindingsText(JSON.stringify(selectedBlock?.bindings || {}, null, 2));
    setBindingsError("");
  }, [selectedBlockKey, selectedBlock?.bindings]);

  const blockType = selectedBlock?.type || "";
  const blockProps =
    selectedBlock?.props && typeof selectedBlock.props === "object" ? selectedBlock.props : {};
  const blockLayout =
    selectedBlock?.layout && typeof selectedBlock.layout === "object"
      ? selectedBlock.layout
      : {};

  const bindingsList = useMemo(() => {
    const source =
      selectedBlock?.bindings &&
      typeof selectedBlock.bindings === "object" &&
      !Array.isArray(selectedBlock.bindings)
        ? selectedBlock.bindings
        : {};
    return Object.entries(source).map(([key, binding]) => ({
      key,
      path:
        binding && typeof binding === "object" && typeof binding.path === "string"
          ? binding.path
          : "—",
    }));
  }, [selectedBlock?.bindings]);

  if (!selectedBlock || !selectedSectionKey || !selectedBlockKey) {
    return (
      <section className={s.panel}>
        <h3 className={s.title}>Block Inspector</h3>
        <div className={s.note}>No block selected.</div>
      </section>
    );
  }

  const setProp = (key, value) => {
    updateBlockProps(selectedSectionKey, selectedBlockKey, { [key]: value });
  };

  const setLayout = (key, value) => {
    updateBlockLayout(selectedSectionKey, selectedBlockKey, { [key]: value });
  };

  const onDeleteBlock = () => {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (!window.confirm("Delete selected block?")) return;
    }
    removeBlock(selectedSectionKey, selectedBlockKey);
  };

  const onDuplicateBlock = () => {
    duplicateBlock(selectedSectionKey, selectedBlockKey);
  };

  const onBindingsBlur = () => {
    try {
      const parsed = JSON.parse(bindingsText || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setBindingsError("Bindings JSON must be an object.");
        return;
      }
      setBindingsError("");
      updateBlock(selectedSectionKey, selectedBlockKey, { bindings: parsed });
      setBindingsText(JSON.stringify(parsed, null, 2));
    } catch {
      setBindingsError("Invalid JSON.");
    }
  };

  const onRemoveBinding = (bKey) => {
    updateBlockBindings(selectedSectionKey, selectedBlockKey, { [bKey]: undefined });
  };

  const renderTypeProps = () => {
    if (blockType === "document_title") {
      return (
        <>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={blockProps.uppercase !== false}
              onChange={(e) => setProp("uppercase", e.target.checked)}
            />
            <span>Uppercase</span>
          </label>
          <div className={s.formGroup}>
            <label className={s.fieldLabel}>Align</label>
            <select
              className={s.select}
              value={String(blockProps.align || "left")}
              onChange={(e) => setProp("align", e.target.value)}
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </div>
          <div className={s.formGroup}>
            <label className={s.fieldLabel}>Fallback Label</label>
            <input
              className={s.input}
              value={String(blockProps.fallbackLabel || "")}
              onChange={(e) => setProp("fallbackLabel", e.target.value)}
            />
          </div>
        </>
      );
    }

    if (blockType === "document_number") {
      return (
        <>
          <div className={s.formGroup}>
            <label className={s.fieldLabel}>Label</label>
            <input
              className={s.input}
              value={String(blockProps.label || "")}
              onChange={(e) => setProp("label", e.target.value)}
            />
          </div>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={blockProps.showLabel !== false}
              onChange={(e) => setProp("showLabel", e.target.checked)}
            />
            <span>Show Label</span>
          </label>
        </>
      );
    }

    if (blockType === "document_dates") {
      return <div className={s.note}>Configure fields below.</div>;
    }

    if (blockType === "company_identity") {
      return <div className={s.note}>Configure fields below.</div>;
    }

    if (blockType === "counterparty_identity") {
      return (
        <div className={s.formGroup}>
          <label className={s.fieldLabel}>Section Label</label>
          <input
            className={s.input}
            value={String(blockProps.label || "")}
            onChange={(e) => setProp("label", e.target.value)}
          />
        </div>
      );
    }

    if (blockType === "items_table") {
      return (
        <label className={s.checkboxRow}>
          <input
            type="checkbox"
            checked={blockProps.showHeader !== false}
            onChange={(e) => setProp("showHeader", e.target.checked)}
          />
          <span>Show Header</span>
        </label>
      );
    }

    if (blockType === "totals_table") {
      return (
        <>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={blockProps.showByVatRate === true}
              onChange={(e) => setProp("showByVatRate", e.target.checked)}
            />
            <span>Show By VAT Rate</span>
          </label>
          <label className={s.checkboxRow}>
            <input
              type="checkbox"
              checked={blockProps.showCurrency !== false}
              onChange={(e) => setProp("showCurrency", e.target.checked)}
            />
            <span>Show Currency</span>
          </label>
        </>
      );
    }

    if (blockType === "payment") {
      return <div className={s.note}>Configure fields below.</div>;
    }

    if (blockType === "notes") {
      return (
        <div className={s.formGroup}>
          <label className={s.fieldLabel}>Label</label>
          <input
            className={s.input}
            value={String(blockProps.label || "")}
            onChange={(e) => setProp("label", e.target.value)}
          />
        </div>
      );
    }

    if (blockType === "legal_footer") {
      return (
        <label className={s.checkboxRow}>
          <input
            type="checkbox"
            checked={blockProps.showKsefReference !== false}
            onChange={(e) => setProp("showKsefReference", e.target.checked)}
          />
          <span>Show KSeF Reference</span>
        </label>
      );
    }

    return <div className={s.note}>No type-specific controls available.</div>;
  };

  const hasFieldCatalog = Boolean(FIELD_CATALOGS[blockType]);

  return (
    <section className={s.panel}>
      <h3 className={s.title}>Block Inspector</h3>

      <div className={s.metaList}>
        <div className={s.row}>
          <span className={s.label}>Block Key</span>
          <span className={s.value}>{blockKey}</span>
        </div>
        <div className={s.row}>
          <span className={s.label}>Block Type</span>
          <span className={s.value}>{blockType || "—"}</span>
        </div>
      </div>

      <div className={s.actionRow}>
        <button type="button" className={s.actionButton} onClick={onDuplicateBlock}>
          Duplicate
        </button>
        <button type="button" className={s.dangerButton} onClick={onDeleteBlock}>
          Delete
        </button>
      </div>

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>Block Key (readonly)</label>
        <input className={s.input} value={selectedBlockKey} readOnly />
      </div>

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>Block Type (readonly)</label>
        <input className={s.input} value={blockType} readOnly />
      </div>

      <h4 className={s.subtitle}>Layout</h4>
      <div className={s.formGroup}>
        <label className={s.fieldLabel}>widthMode</label>
        <select
          className={s.select}
          value={String(blockLayout.widthMode || "auto")}
          onChange={(e) => setLayout("widthMode", e.target.value)}
        >
          <option value="auto">auto</option>
          <option value="fraction">fraction</option>
          <option value="fixed">fixed</option>
        </select>
      </div>

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>widthValue</label>
        <input
          className={s.input}
          type="number"
          step="0.01"
          value={blockLayout.widthValue ?? ""}
          onChange={(e) => setLayout("widthValue", parseOptionalNumber(e.target.value))}
        />
      </div>

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>minWidthPx</label>
        <input
          className={s.input}
          type="number"
          step="1"
          value={blockLayout.minWidthPx ?? ""}
          onChange={(e) => setLayout("minWidthPx", parseOptionalNumber(e.target.value))}
        />
      </div>

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>horizontalAlign</label>
        <select
          className={s.select}
          value={String(blockLayout.horizontalAlign || "start")}
          onChange={(e) => setLayout("horizontalAlign", e.target.value)}
        >
          <option value="start">start</option>
          <option value="center">center</option>
          <option value="end">end</option>
        </select>
      </div>

      <h4 className={s.subtitle}>Props</h4>
      <div className={s.formBlock}>{renderTypeProps()}</div>

      {hasFieldCatalog ? (
        <>
          <h4 className={s.subtitle}>Fields / Columns</h4>
          <FieldConfigList
            blockType={blockType}
            blockProps={blockProps}
            sectionKey={selectedSectionKey}
            blockKey={selectedBlockKey}
          />
        </>
      ) : null}

      <h4 className={s.subtitle}>Bindings</h4>
      {bindingsList.length > 0 ? (
        <div className={s.bindingList}>
          {bindingsList.map((entry) => (
            <div key={entry.key} className={s.bindingPill}>
              <div className={s.bindingPillMeta}>
                <span className={s.bindingPillKey}>{entry.key}</span>
                <span className={s.bindingPillPath}>{entry.path}</span>
              </div>
              <button
                type="button"
                className={s.removeBindingButton}
                onClick={() => onRemoveBinding(entry.key)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={s.note}>No bindings assigned.</div>
      )}

      <div className={s.formGroup}>
        <label className={s.fieldLabel}>Bindings JSON</label>
        <textarea
          className={s.jsonArea}
          value={bindingsText}
          onChange={(e) => setBindingsText(e.target.value)}
          onBlur={onBindingsBlur}
          spellCheck={false}
        />
        {bindingsError ? <div className={s.localError}>{bindingsError}</div> : null}
      </div>
    </section>
  );
}
