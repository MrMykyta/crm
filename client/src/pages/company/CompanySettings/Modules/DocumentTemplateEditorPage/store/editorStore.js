import { create } from "zustand";

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildHash(value) {
  if (!value) return "";
  return stableStringify(value);
}

function cloneDraft(value) {
  if (!value) return value;
  return JSON.parse(JSON.stringify(value));
}

function pushPastCapped(past, currentDraft) {
  const nextPast = [...past, currentDraft];
  if (nextPast.length <= 50) return nextPast;
  return nextPast.slice(nextPast.length - 50);
}

function normalizeSectionOrders(sections) {
  return sections.map((sec, index) => ({ ...sec, order: index }));
}

const initialUi = {
  selectedSectionKey: null,
  selectedBlockKey: null,
  selectedFieldKey: null,
  editorMode: "design",
  localeMode: "pl",
  zoom: 1,
  showRulers: false,
  activeLeftTab: "sections",
  rightPanelExpanded: true,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
};

const initialInteraction = {
  dragState: null,
  resizeState: null,
  fieldWidthPending: null,
};

const initialValidation = {
  issues: [],
  lastValidated: null,
  isValid: true,
};

export const useEditorStore = create((set, get) => ({
  templateMeta: null,
  draft: null,

  ui: { ...initialUi },
  interaction: { ...initialInteraction },

  history: {
    past: [],
    future: [],
    savedHash: "",
  },

  validation: { ...initialValidation },

  setDraft: (draft) => {
    const nextHash = buildHash(draft);
    set(() => ({
      draft,
      interaction: { ...initialInteraction },
      validation: { ...initialValidation },
      history: {
        past: [],
        future: [],
        savedHash: nextHash,
      },
    }));
  },

  setTemplateMeta: (templateMeta) => {
    set(() => ({ templateMeta }));
  },

  setSelectedSection: (sectionKey) => {
    set((state) => ({
      ui: {
        ...state.ui,
        selectedSectionKey: sectionKey,
        selectedBlockKey: null,
        selectedFieldKey: null,
      },
    }));
  },

  setSelectedBlock: (sectionKey, blockKey) => {
    if (!sectionKey) {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedSectionKey: null,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
      }));
      return;
    }

    set((state) => ({
      ui: {
        ...state.ui,
        selectedSectionKey: sectionKey,
        selectedBlockKey: blockKey || null,
        selectedFieldKey: null,
      },
    }));
  },

  setSelectedField: (sectionKey, blockKey, fieldKey) => {
    if (!sectionKey) {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedSectionKey: null,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
      }));
      return;
    }

    if (!blockKey) {
      set((state) => ({
        ui: {
          ...state.ui,
          selectedSectionKey: sectionKey,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
      }));
      return;
    }

    set((state) => ({
      ui: {
        ...state.ui,
        selectedSectionKey: sectionKey,
        selectedBlockKey: blockKey,
        selectedFieldKey: fieldKey || null,
      },
    }));
  },

  clearSelection: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        selectedSectionKey: null,
        selectedBlockKey: null,
        selectedFieldKey: null,
      },
    }));
  },

  setEditorMode: (editorMode) => {
    set((state) => ({
      ui: {
        ...state.ui,
        editorMode,
      },
    }));
  },

  setLocaleMode: (localeMode) => {
    set((state) => ({
      ui: {
        ...state.ui,
        localeMode,
      },
    }));
  },

  setZoom: (zoom) => {
    set((state) => ({
      ui: {
        ...state.ui,
        zoom,
      },
    }));
  },

  setLeftTab: (activeLeftTab) => {
    set((state) => ({
      ui: {
        ...state.ui,
        activeLeftTab,
      },
    }));
  },

  toggleLeftPanel: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        leftPanelCollapsed: !state.ui.leftPanelCollapsed,
      },
    }));
  },

  toggleRightPanel: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        rightPanelCollapsed: !state.ui.rightPanelCollapsed,
      },
    }));
  },

  setValidationIssues: (issues) => {
    const safeIssues = Array.isArray(issues) ? issues : [];
    const hasBlocking = safeIssues.some((issue) => issue?.severity === "BLOCKING");

    set((state) => ({
      validation: {
        ...state.validation,
        issues: safeIssues,
        isValid: !hasBlocking,
        lastValidated: new Date().toISOString(),
      },
    }));
  },

  // ─── Section actions ────────────────────────────────────────────────────────

  addSection: (sectionType = "custom") => {
    const normalizedType = String(sectionType || "custom").trim() || "custom";

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections)) {
        nextDraft.sections = [];
      }

      const key = `${normalizedType}_${Date.now()}`;
      nextDraft.sections.push({
        key,
        type: normalizedType,
        order: nextDraft.sections.length,
        enabled: true,
        locked: false,
        layoutMode: "flow",
        blocks: [],
      });

      nextDraft.sections = normalizeSectionOrders(nextDraft.sections);

      return {
        draft: nextDraft,
        ui: {
          ...state.ui,
          selectedSectionKey: key,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  renameSection: (sectionKey, nextKey) => {
    const normalizedOldKey = String(sectionKey || "").trim();
    const normalizedNewKey = String(nextKey || "").trim();

    if (!normalizedOldKey || !normalizedNewKey) return;
    if (normalizedOldKey === normalizedNewKey) return;

    set((state) => {
      if (!state.draft) return state;

      const sections = state.draft.sections;
      if (!Array.isArray(sections)) return state;

      // Reject duplicate key
      const keyTaken = sections.some((sec) => sec?.key === normalizedNewKey);
      if (keyTaken) return state;

      const nextDraft = cloneDraft(state.draft);
      const idx = nextDraft.sections.findIndex((sec) => sec?.key === normalizedOldKey);
      if (idx < 0) return state;

      nextDraft.sections[idx] = { ...nextDraft.sections[idx], key: normalizedNewKey };
      nextDraft.sections = normalizeSectionOrders(nextDraft.sections);

      const wasSelected = state.ui.selectedSectionKey === normalizedOldKey;

      return {
        draft: nextDraft,
        ui: wasSelected
          ? {
              ...state.ui,
              selectedSectionKey: normalizedNewKey,
              // Block still belongs to the same section; key just changed — preserve selection
            }
          : state.ui,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  moveSection: (sectionKey, direction) => {
    const normalizedKey = String(sectionKey || "").trim();
    if (!normalizedKey || (direction !== "up" && direction !== "down")) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections) || nextDraft.sections.length < 2) return state;

      const sorted = [...nextDraft.sections].sort(
        (a, b) => Number(a.order) - Number(b.order)
      );

      const idx = sorted.findIndex((sec) => sec?.key === normalizedKey);
      if (idx < 0) return state;
      if (direction === "up" && idx === 0) return state;
      if (direction === "down" && idx === sorted.length - 1) return state;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];

      nextDraft.sections = normalizeSectionOrders(sorted);

      return {
        draft: nextDraft,
        ui: {
          ...state.ui,
          selectedSectionKey: normalizedKey,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  moveSectionUp: (sectionKey) => {
    get().moveSection(sectionKey, "up");
  },

  moveSectionDown: (sectionKey) => {
    get().moveSection(sectionKey, "down");
  },

  reorderSections: (nextOrderedKeys) => {
    if (!Array.isArray(nextOrderedKeys) || nextOrderedKeys.length === 0) return;

    set((state) => {
      if (!state.draft) return state;

      const sections = state.draft.sections;
      if (!Array.isArray(sections)) return state;

      const keyToSection = new Map(sections.map((sec) => [sec?.key, sec]));

      const reordered = nextOrderedKeys
        .map((key) => keyToSection.get(key))
        .filter(Boolean);

      if (reordered.length !== sections.length) return state;

      const nextDraft = cloneDraft(state.draft);
      nextDraft.sections = normalizeSectionOrders(reordered);

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateSection: (sectionKey, patch) => {
    const normalizedKey = String(sectionKey || "").trim();
    const safePatch = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : null;

    if (!normalizedKey || !safePatch) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections)) return state;

      const idx = nextDraft.sections.findIndex((sec) => sec?.key === normalizedKey);
      if (idx < 0) return state;

      nextDraft.sections[idx] = { ...nextDraft.sections[idx], ...safePatch };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateSectionLayoutMode: (sectionKey, layoutMode) => {
    get().updateSection(sectionKey, { layoutMode });
  },

  removeSection: (sectionKey) => {
    const normalizedKey = String(sectionKey || "").trim();
    if (!normalizedKey) return;

    set((state) => {
      if (!state.draft) return state;

      const sections = state.draft.sections;
      if (!Array.isArray(sections) || sections.length <= 1) return state;

      const section = sections.find((sec) => sec?.key === normalizedKey);
      if (!section) return state;
      if (section.locked) return state;

      const nextDraft = cloneDraft(state.draft);
      nextDraft.sections = normalizeSectionOrders(
        nextDraft.sections.filter((sec) => sec?.key !== normalizedKey)
      );

      const wasSelected = state.ui.selectedSectionKey === normalizedKey;

      let nextSelectedSectionKey = state.ui.selectedSectionKey;
      if (wasSelected) {
        const sorted = [...sections].sort((a, b) => Number(a.order) - Number(b.order));
        const removedIdx = sorted.findIndex((sec) => sec?.key === normalizedKey);
        const nearest = sorted[removedIdx - 1] ?? sorted[removedIdx + 1] ?? null;
        nextSelectedSectionKey = nearest?.key ?? null;
      }

      return {
        draft: nextDraft,
        ui: wasSelected
          ? {
              ...state.ui,
              selectedSectionKey: nextSelectedSectionKey,
              selectedBlockKey: null,
              selectedFieldKey: null,
            }
          : state.ui,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  duplicateSection: (sectionKey) => {
    const normalizedKey = String(sectionKey || "").trim();
    if (!normalizedKey) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections)) return state;

      const srcIdx = nextDraft.sections.findIndex((sec) => sec?.key === normalizedKey);
      if (srcIdx < 0) return state;

      const source = nextDraft.sections[srcIdx];
      const duplicate = cloneDraft(source);

      const ts = Date.now();
      duplicate.key = `${source.key}_copy_${ts}`;
      duplicate.locked = false;

      if (Array.isArray(duplicate.blocks)) {
        duplicate.blocks = duplicate.blocks.map((block, i) => ({
          ...block,
          key: `${block.type || "block"}_${ts}_${i}`,
        }));
      }

      nextDraft.sections.splice(srcIdx + 1, 0, duplicate);
      nextDraft.sections = normalizeSectionOrders(nextDraft.sections);

      return {
        draft: nextDraft,
        ui: {
          ...state.ui,
          selectedSectionKey: duplicate.key,
          selectedBlockKey: null,
          selectedFieldKey: null,
        },
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  // ─── Block actions ───────────────────────────────────────────────────────────

  addBlockToSection: (sectionKey, blockType) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockType = String(blockType || "").trim();
    const currentDraft = get().draft;

    if (!currentDraft || !normalizedSectionKey || !normalizedBlockType) {
      return;
    }

    const nextDraft = cloneDraft(currentDraft);
    if (!nextDraft || !Array.isArray(nextDraft.sections)) {
      return;
    }

    const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
    if (!section) {
      return;
    }

    if (!Array.isArray(section.blocks)) {
      section.blocks = [];
    }

    const blockKey = `${normalizedBlockType}_${Date.now()}`;
    section.blocks.push({
      key: blockKey,
      type: normalizedBlockType,
      props: {},
      bindings: {},
      layout: {},
    });

    set((state) => ({
      draft: nextDraft,
      ui: {
        ...state.ui,
        selectedSectionKey: normalizedSectionKey,
        selectedBlockKey: blockKey,
        selectedFieldKey: null,
      },
      history: {
        ...state.history,
        past: pushPastCapped(state.history.past, state.draft),
        future: [],
      },
    }));
  },

  updateBlock: (sectionKey, blockKey, patch) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();
    const safePatch = patch && typeof patch === "object" ? patch : null;

    if (!normalizedSectionKey || !normalizedBlockKey || !safePatch) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      section.blocks[blockIndex] = {
        ...section.blocks[blockIndex],
        ...safePatch,
      };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateBlockProps: (sectionKey, blockKey, propsPatch) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();
    const safePatch = propsPatch && typeof propsPatch === "object" ? propsPatch : null;

    if (!normalizedSectionKey || !normalizedBlockKey || !safePatch) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const block = section.blocks[blockIndex] || {};
      const nextProps = { ...(block.props || {}) };
      for (const [key, value] of Object.entries(safePatch)) {
        if (value === undefined) {
          delete nextProps[key];
        } else {
          nextProps[key] = value;
        }
      }

      section.blocks[blockIndex] = {
        ...block,
        props: nextProps,
      };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateBlockLayout: (sectionKey, blockKey, layoutPatch) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();
    const safePatch = layoutPatch && typeof layoutPatch === "object" ? layoutPatch : null;

    if (!normalizedSectionKey || !normalizedBlockKey || !safePatch) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const block = section.blocks[blockIndex] || {};
      const nextLayout = { ...(block.layout || {}) };
      for (const [key, value] of Object.entries(safePatch)) {
        if (value === undefined) {
          delete nextLayout[key];
        } else {
          nextLayout[key] = value;
        }
      }

      section.blocks[blockIndex] = {
        ...block,
        layout: nextLayout,
      };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateBlockFieldConfig: (sectionKey, blockKey, fieldKey, patch) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();
    const normalizedFieldKey = String(fieldKey || "").trim();
    const safePatch = patch && typeof patch === "object" && !Array.isArray(patch) ? patch : null;

    if (!normalizedSectionKey || !normalizedBlockKey || !normalizedFieldKey || !safePatch) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const block = section.blocks[blockIndex];
      const nextProps = { ...(block.props || {}) };
      const nextFieldsConfig = { ...(nextProps.fieldsConfig || {}) };
      nextFieldsConfig[normalizedFieldKey] = {
        ...(nextFieldsConfig[normalizedFieldKey] || {}),
        ...safePatch,
      };
      nextProps.fieldsConfig = nextFieldsConfig;
      section.blocks[blockIndex] = { ...block, props: nextProps };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  reorderBlockFields: (sectionKey, blockKey, orderedFieldKeys) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();

    if (!normalizedSectionKey || !normalizedBlockKey || !Array.isArray(orderedFieldKeys)) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const block = section.blocks[blockIndex];
      const nextProps = { ...(block.props || {}) };
      const nextFieldsConfig = { ...(nextProps.fieldsConfig || {}) };
      orderedFieldKeys.forEach((key, idx) => {
        nextFieldsConfig[key] = { ...(nextFieldsConfig[key] || {}), order: idx };
      });
      nextProps.fieldsConfig = nextFieldsConfig;
      section.blocks[blockIndex] = { ...block, props: nextProps };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  updateBlockBindings: (sectionKey, blockKey, bindingsPatch) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();
    const safePatch =
      bindingsPatch && typeof bindingsPatch === "object" && !Array.isArray(bindingsPatch)
        ? bindingsPatch
        : null;

    if (!normalizedSectionKey || !normalizedBlockKey || !safePatch) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const block = section.blocks[blockIndex] || {};
      const nextBindings = { ...(block.bindings || {}) };
      for (const [key, value] of Object.entries(safePatch)) {
        if (value === undefined) {
          delete nextBindings[key];
        } else {
          nextBindings[key] = value;
        }
      }

      section.blocks[blockIndex] = {
        ...block,
        bindings: nextBindings,
      };

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  removeBlock: (sectionKey, blockKey) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();

    if (!normalizedSectionKey || !normalizedBlockKey) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      section.blocks.splice(blockIndex, 1);

      const removedWasSelected =
        state.ui.selectedSectionKey === normalizedSectionKey &&
        state.ui.selectedBlockKey === normalizedBlockKey;

      return {
        draft: nextDraft,
        ui: removedWasSelected
          ? {
              ...state.ui,
              selectedSectionKey: normalizedSectionKey,
              selectedBlockKey: null,
              selectedFieldKey: null,
            }
          : state.ui,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  duplicateBlock: (sectionKey, blockKey) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();

    if (!normalizedSectionKey || !normalizedBlockKey) {
      return;
    }

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!nextDraft || !Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((item) => item?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const blockIndex = section.blocks.findIndex((item) => item?.key === normalizedBlockKey);
      if (blockIndex < 0) return state;

      const sourceBlock = section.blocks[blockIndex];
      const duplicatedBlock = cloneDraft(sourceBlock);
      duplicatedBlock.key = `${duplicatedBlock.type || "block"}_${Date.now()}`;

      section.blocks.splice(blockIndex + 1, 0, duplicatedBlock);

      return {
        draft: nextDraft,
        ui: {
          ...state.ui,
          selectedSectionKey: normalizedSectionKey,
          selectedBlockKey: duplicatedBlock.key,
          selectedFieldKey: null,
        },
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  moveBlockToSection: (sourceSectionKey, targetSectionKey, blockKey, targetIndex) => {
    const normalizedSourceKey = String(sourceSectionKey || "").trim();
    const normalizedTargetKey = String(targetSectionKey || "").trim();
    const normalizedBlockKey = String(blockKey || "").trim();

    if (!normalizedSourceKey || !normalizedTargetKey || !normalizedBlockKey) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections)) return state;

      const sourceSection = nextDraft.sections.find((s) => s?.key === normalizedSourceKey);
      const targetSection = nextDraft.sections.find((s) => s?.key === normalizedTargetKey);

      if (!sourceSection || !targetSection) return state;
      if (!Array.isArray(sourceSection.blocks)) return state;
      if (!Array.isArray(targetSection.blocks)) targetSection.blocks = [];

      const blockIdx = sourceSection.blocks.findIndex((b) => b?.key === normalizedBlockKey);
      if (blockIdx < 0) return state;

      const [block] = sourceSection.blocks.splice(blockIdx, 1);

      const safeTargetIndex = Math.max(
        0,
        Math.min(
          Number.isFinite(targetIndex) ? targetIndex : targetSection.blocks.length,
          targetSection.blocks.length
        )
      );

      targetSection.blocks.splice(safeTargetIndex, 0, block);

      return {
        draft: nextDraft,
        ui: {
          ...state.ui,
          selectedSectionKey: normalizedTargetKey,
          selectedBlockKey: normalizedBlockKey,
          selectedFieldKey: null,
        },
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  resizeBlockWidth: (sectionKey, blockKey, widthValue) => {
    const COLS = 12;
    const snapped = Math.round(widthValue * COLS) / COLS;
    const clamped = Math.max(2 / COLS, Math.min(1, snapped));
    get().updateBlockLayout(sectionKey, blockKey, {
      widthMode: "fraction",
      widthValue: clamped,
    });
  },

  reorderBlocks: (sectionKey, nextOrderedBlockKeys) => {
    const normalizedSectionKey = String(sectionKey || "").trim();
    if (!normalizedSectionKey || !Array.isArray(nextOrderedBlockKeys)) return;

    set((state) => {
      if (!state.draft) return state;

      const nextDraft = cloneDraft(state.draft);
      if (!Array.isArray(nextDraft.sections)) return state;

      const section = nextDraft.sections.find((sec) => sec?.key === normalizedSectionKey);
      if (!section || !Array.isArray(section.blocks)) return state;

      const keyToBlock = new Map(section.blocks.map((blk) => [blk?.key, blk]));
      const reordered = nextOrderedBlockKeys.map((k) => keyToBlock.get(k)).filter(Boolean);
      if (reordered.length !== section.blocks.length) return state;

      section.blocks = reordered;

      return {
        draft: nextDraft,
        history: {
          ...state.history,
          past: pushPastCapped(state.history.past, state.draft),
          future: [],
        },
      };
    });
  },

  applyCommand: (command) => {
    const currentDraft = get().draft;
    if (!currentDraft || !command || typeof command.apply !== "function") {
      return;
    }

    const nextDraft = command.apply(currentDraft);
    if (!nextDraft || nextDraft === currentDraft) {
      return;
    }

    set((state) => ({
      draft: nextDraft,
      history: {
        ...state.history,
        past: [...state.history.past, state.draft],
        future: [],
      },
    }));
  },

  undo: () => {
    const state = get();
    if (state.history.past.length === 0) {
      return;
    }

    const previousDraft = state.history.past[state.history.past.length - 1];
    const nextPast = state.history.past.slice(0, -1);

    set((current) => ({
      draft: previousDraft,
      history: {
        ...current.history,
        past: nextPast,
        future: [current.draft, ...current.history.future],
      },
    }));
  },

  redo: () => {
    const state = get();
    if (state.history.future.length === 0) {
      return;
    }

    const [nextDraft, ...nextFuture] = state.history.future;

    set((current) => ({
      draft: nextDraft,
      history: {
        ...current.history,
        past: [...current.history.past, current.draft],
        future: nextFuture,
      },
    }));
  },
}));

export const editorStoreHelpers = {
  buildHash,
};
