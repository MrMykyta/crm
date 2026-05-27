import { useMemo } from "react";
import { useEditorStore } from "../../store/editorStore";
import DocumentTemplateRenderer from "../../../../../../../features/documentTemplateRenderer";
import { getSampleDataContext } from "../../../../../../../features/documentTemplateRenderer/sampleData";
import s from "./Canvas.module.css";

function mapRenderMode(editorMode) {
  if (editorMode === "preview") return "screen_view";
  if (editorMode === "print") return "print";
  return "editor_preview";
}

function mapRenderChannel(editorMode) {
  if (editorMode === "preview") return "screen";
  if (editorMode === "print") return "print";
  return "editor";
}

function asMargin(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return fallback;
  }
  return num;
}

export default function Canvas() {
  const draft = useEditorStore((state) => state.draft);
  const editorMode = useEditorStore((state) => state.ui.editorMode);
  const localeMode = useEditorStore((state) => state.ui.localeMode);
  const zoom = useEditorStore((state) => state.ui.zoom);
  const selectedSectionKey = useEditorStore((state) => state.ui.selectedSectionKey);
  const selectedBlockKey = useEditorStore((state) => state.ui.selectedBlockKey);
  const selectedFieldKey = useEditorStore((state) => state.ui.selectedFieldKey);
  const setSelectedSection = useEditorStore((state) => state.setSelectedSection);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);
  const reorderBlocks = useEditorStore((state) => state.reorderBlocks);
  const moveBlockToSection = useEditorStore((state) => state.moveBlockToSection);
  const resizeBlockWidth = useEditorStore((state) => state.resizeBlockWidth);

  const dataContext = useMemo(
    () => getSampleDataContext(draft?.documentTypeKey),
    [draft?.documentTypeKey]
  );

  const renderContext = useMemo(
    () => ({
      mode: mapRenderMode(editorMode),
      channel: mapRenderChannel(editorMode),
      locale: localeMode || "pl",
      selectedSectionKey,
      selectedBlockKey,
      selectedFieldKey,
      isEditorInteractive: editorMode === "design",
      onSectionClick: (sectionKey) => {
        if (editorMode !== "design") return;
        setSelectedSection(sectionKey);
      },
      onBlockClick: (sectionKey, blockKey) => {
        if (editorMode !== "design") return;
        setSelectedBlock(sectionKey, blockKey);
      },
      onBlockReorder: (sectionKey, newKeys) => {
        if (editorMode !== "design") return;
        reorderBlocks(sectionKey, newKeys);
      },
      onMoveBlockToSection: (srcKey, tgtKey, blockKey, tgtIdx) => {
        if (editorMode !== "design") return;
        moveBlockToSection(srcKey, tgtKey, blockKey, tgtIdx);
      },
      onBlockResizeEnd: (sectionKey, blockKey, widthValue) => {
        if (editorMode !== "design") return;
        resizeBlockWidth(sectionKey, blockKey, widthValue);
      },
    }),
    [
      editorMode,
      localeMode,
      selectedSectionKey,
      selectedBlockKey,
      selectedFieldKey,
      setSelectedSection,
      setSelectedBlock,
      reorderBlocks,
      moveBlockToSection,
      resizeBlockWidth,
    ]
  );

  const pageMargins = useMemo(() => {
    const margins = draft?.page?.margins || {};
    return {
      top: asMargin(margins.top, 20),
      right: asMargin(margins.right, 15),
      bottom: asMargin(margins.bottom, 20),
      left: asMargin(margins.left, 15),
    };
  }, [draft?.page?.margins]);

  if (!draft) {
    return (
      <section className={s.wrap}>
        <div className={s.workspace}>
          <div className={s.stateCard}>
            <h3 className={s.stateTitle}>Canvas</h3>
            <p className={s.stateText}>Draft is not loaded yet.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={s.wrap}>
      <div className={s.workspace} style={{ "--canvas-zoom": zoom }}>
        <div className={s.pageOuter}>
          <div className={s.pageToolbar}>
            <span>A4 Preview</span>
            <span>Page 1 / 1 estimated</span>
          </div>

          <div
            className={s.page}
            style={{
              "--canvas-zoom": zoom,
              "--page-margin-top": `${pageMargins.top}mm`,
              "--page-margin-right": `${pageMargins.right}mm`,
              "--page-margin-bottom": `${pageMargins.bottom}mm`,
              "--page-margin-left": `${pageMargins.left}mm`,
            }}
          >
            {editorMode === "print" ? (
              <div className={s.printBadge}>
                Print preview engine not wired yet — visual approximation
              </div>
            ) : null}

            <div className={s.marginOverlay} />

            <div className={s.pageContent}>
              <DocumentTemplateRenderer
                templateDraft={draft}
                dataContext={dataContext}
                renderContext={renderContext}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
