import { useMemo, useState } from "react";
import { useEditorSelection } from "../../hooks/useEditorSelection";
import { useEditorStore } from "../../store/editorStore";
import { BINDING_GROUPS, guessBindingKeyForBlock } from "../../data/bindingCatalog";
import s from "./LeftPanel.module.css";

function normalizeSearch(search) {
  return String(search || "").trim().toLowerCase();
}

export default function DataBindingsTab() {
  const [search, setSearch] = useState("");
  const { selectedSectionKey, selectedBlockKey, selectedBlock } = useEditorSelection();
  const updateBlockBindings = useEditorStore((state) => state.updateBlockBindings);

  const normalizedSearch = normalizeSearch(search);

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) {
      return BINDING_GROUPS;
    }

    return BINDING_GROUPS.map((group) => {
      const paths = group.paths.filter((entry) => {
        const haystack = `${entry.label} ${entry.path} ${entry.sample}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
      return { ...group, paths };
    }).filter((group) => group.paths.length > 0);
  }, [normalizedSearch]);

  const onAssignBinding = (path) => {
    if (!selectedSectionKey || !selectedBlockKey || !selectedBlock) {
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Select a block first.");
      } else {
        console.warn("Select a block first.");
      }
      return;
    }

    const bindingKey = guessBindingKeyForBlock(selectedBlock.type, path);
    updateBlockBindings(selectedSectionKey, selectedBlockKey, {
      [bindingKey]: { path },
    });
  };

  return (
    <div>
      <div className={s.formGroup}>
        <input
          className={s.searchInput}
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search bindings (e.g. nip, totals.gross)"
        />
      </div>

      <div className={s.selectedBlockHint}>
        {selectedBlock ? (
          <>
            Selected block: <strong>{selectedBlock.type}</strong> / <strong>{selectedBlock.key}</strong>
          </>
        ) : (
          "Select a block to assign bindings."
        )}
      </div>

      {filteredGroups.length === 0 ? (
        <div className={s.emptyState}>No bindings found for current search.</div>
      ) : (
        <div className={s.bindingGroups}>
          {filteredGroups.map((group) => (
            <section key={group.key} className={s.bindingGroup}>
              <h4 className={s.bindingGroupTitle}>{group.label}</h4>
              <div className={s.bindingRows}>
                {group.paths.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className={s.bindingRowButton}
                    onClick={() => onAssignBinding(entry.path)}
                  >
                    <span className={s.bindingLabel}>{entry.label}</span>
                    <span className={s.bindingPath}>{entry.path}</span>
                    <span className={s.bindingSample}>Sample: {entry.sample}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
