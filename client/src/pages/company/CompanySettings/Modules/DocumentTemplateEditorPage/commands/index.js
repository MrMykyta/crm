function withSections(draft, updater) {
  const currentSections = Array.isArray(draft?.sections) ? draft.sections : [];
  const nextSections = updater(currentSections);

  if (!Array.isArray(nextSections) || nextSections === currentSections) {
    return draft;
  }

  return {
    ...draft,
    sections: nextSections,
  };
}

function updateSectionBlockList(section, updater) {
  const currentBlocks = Array.isArray(section?.blocks) ? section.blocks : [];
  const nextBlocks = updater(currentBlocks);
  if (!Array.isArray(nextBlocks) || nextBlocks === currentBlocks) {
    return section;
  }
  return {
    ...section,
    blocks: nextBlocks,
  };
}

export function SectionReorderCommand({ sectionKey, toIndex }) {
  return {
    type: "SECTION_REORDER",
    apply(draft) {
      return withSections(draft, (sections) => {
        const fromIndex = sections.findIndex((section) => section?.key === sectionKey);
        if (fromIndex < 0) return sections;

        const nextIndex = Math.max(0, Math.min(Number(toIndex) || 0, sections.length - 1));
        if (nextIndex === fromIndex) return sections;

        const nextSections = [...sections];
        const [moved] = nextSections.splice(fromIndex, 1);
        nextSections.splice(nextIndex, 0, moved);
        return nextSections.map((section, index) => ({
          ...section,
          order: index,
        }));
      });
    },
  };
}

export function BlockAddCommand({ sectionKey, block, atIndex = null }) {
  return {
    type: "BLOCK_ADD",
    apply(draft) {
      return withSections(draft, (sections) =>
        sections.map((section) => {
          if (section?.key !== sectionKey) return section;
          return updateSectionBlockList(section, (blocks) => {
            const insertIndex =
              atIndex === null || atIndex === undefined
                ? blocks.length
                : Math.max(0, Math.min(Number(atIndex) || 0, blocks.length));
            const nextBlocks = [...blocks];
            nextBlocks.splice(insertIndex, 0, block);
            return nextBlocks;
          });
        })
      );
    },
  };
}

export function BlockRemoveCommand({ sectionKey, blockKey }) {
  return {
    type: "BLOCK_REMOVE",
    apply(draft) {
      return withSections(draft, (sections) =>
        sections.map((section) => {
          if (section?.key !== sectionKey) return section;
          return updateSectionBlockList(section, (blocks) => {
            const nextBlocks = blocks.filter((block) => block?.key !== blockKey);
            return nextBlocks.length === blocks.length ? blocks : nextBlocks;
          });
        })
      );
    },
  };
}

export function StyleTokenUpdateCommand({ tokenKey, value }) {
  return {
    type: "STYLE_TOKEN_UPDATE",
    apply(draft) {
      return {
        ...draft,
        styleTokens: {
          ...(draft?.styleTokens || {}),
          [tokenKey]: value,
        },
      };
    },
  };
}

export function BindingSetCommand({ sectionKey, blockKey, bindingKey, binding }) {
  return {
    type: "BINDING_SET",
    apply(draft) {
      return withSections(draft, (sections) =>
        sections.map((section) => {
          if (section?.key !== sectionKey) return section;
          return updateSectionBlockList(section, (blocks) =>
            blocks.map((block) => {
              if (block?.key !== blockKey) return block;
              return {
                ...block,
                bindings: {
                  ...(block?.bindings || {}),
                  [bindingKey]: binding,
                },
              };
            })
          );
        })
      );
    },
  };
}

export function SectionSettingsUpdateCommand({ sectionKey, patch }) {
  return {
    type: "SECTION_SETTINGS_UPDATE",
    apply(draft) {
      return withSections(draft, (sections) =>
        sections.map((section) => {
          if (section?.key !== sectionKey) return section;
          return {
            ...section,
            ...(patch || {}),
          };
        })
      );
    },
  };
}
