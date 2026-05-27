import { useEditorHistory } from "../../hooks/useEditorHistory";
import { useEditorPreview } from "../../hooks/useEditorPreview";
import { useEditorStore } from "../../store/editorStore";
import s from "./TopBar.module.css";

const MODE_OPTIONS = ["design", "preview", "print"];
const LOCALE_OPTIONS = ["pl", "en"];
const ZOOM_OPTIONS = [
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1, label: "100%" },
  { value: 1.25, label: "125%" },
];

export default function TopBar({
  templateName,
  saveStatusLabel,
  onValidate,
  onPublish,
  publishInProgress = false,
}) {
  const { undo, redo, canUndo, canRedo } = useEditorHistory();
  const {
    editorMode,
    localeMode,
    zoom,
    setEditorMode,
    setLocaleMode,
    setZoom,
  } = useEditorPreview();
  const leftPanelCollapsed = useEditorStore((state) => state.ui.leftPanelCollapsed);
  const rightPanelCollapsed = useEditorStore((state) => state.ui.rightPanelCollapsed);
  const toggleLeftPanel = useEditorStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((state) => state.toggleRightPanel);

  return (
    <header className={s.wrap}>
      <div className={s.left}>
        <div className={s.templateName}>{templateName || "Template"}</div>
        <div className={s.saveStatus}>{saveStatusLabel || "Not saved yet"}</div>
      </div>

      <div className={s.center}>
        <button
          type="button"
          className={s.ghostBtn}
          onClick={undo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className={s.ghostBtn}
          onClick={redo}
          disabled={!canRedo}
        >
          Redo
        </button>
      </div>

      <div className={s.right}>
        <label className={s.control}>
          <span>Locale</span>
          <select
            value={localeMode}
            onChange={(event) => setLocaleMode(event.target.value)}
            className={s.select}
          >
            {LOCALE_OPTIONS.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className={s.control}>
          <span>Mode</span>
          <select
            value={editorMode}
            onChange={(event) => setEditorMode(event.target.value)}
            className={s.select}
          >
            {MODE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>

        <label className={s.control}>
          <span>Zoom</span>
          <select
            value={String(zoom)}
            onChange={(event) => setZoom(Number(event.target.value))}
            className={`${s.select} ${s.zoomSelect}`}
          >
            {ZOOM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`${s.ghostBtn} ${leftPanelCollapsed ? s.panelBtnCollapsed : ""}`}
          onClick={toggleLeftPanel}
        >
          Left Panel
        </button>

        <button
          type="button"
          className={`${s.ghostBtn} ${rightPanelCollapsed ? s.panelBtnCollapsed : ""}`}
          onClick={toggleRightPanel}
        >
          Right Panel
        </button>

        <button type="button" className={s.secondaryBtn} onClick={() => onValidate?.()}>
          Validate
        </button>
        <button
          type="button"
          className={s.primaryBtn}
          onClick={() => onPublish?.()}
          disabled={publishInProgress}
        >
          {publishInProgress ? "Publishing…" : "Publish"}
        </button>
      </div>
    </header>
  );
}
