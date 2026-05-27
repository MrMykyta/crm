import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTopbarOptional } from "../../Providers/TopbarProvider";
import DocumentForm from "../../components/documents/DocumentForm";
import DocumentViewModeSwitch from "../../components/documents/DocumentViewModeSwitch";
import DocumentEditorContainer, {
  DOCUMENT_EDITOR_MODES,
} from "../../components/documents/DocumentEditorContainer";
import {
  readDocumentSourceParams,
  useDocumentSourceResolver,
} from "../../components/documents/documentSourceResolver";
import { DOCUMENT_VIEW_MODES } from "../../components/documents/documentViewModes";
import { getDocumentTypeConfig } from "../../components/documents/documentTypeConfig";
import { getDocumentStatusLabel } from "../../components/documents/documentStatusConfig";
import styles from "./DocumentEditorPage.module.css";

const SPLIT_MODE_MIN_WIDTH = 1240;

function getClientLabel(clientId, clients = []) {
  const normalizedId = String(clientId || "").trim();
  if (!normalizedId) return "Клиент не выбран";
  const match = Array.isArray(clients)
    ? clients.find((client) => String(client?.id || "") === normalizedId)
    : null;
  return match?.shortName || match?.fullName || match?.name || `Клиент #${normalizedId.slice(0, 8)}`;
}

function getDirectionLabel(direction) {
  const normalized = String(direction || "").trim().toLowerCase();
  if (normalized === "sale") return "Продажа";
  if (normalized === "purchase") return "Закупка";
  return "—";
}

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const topbar = useTopbarOptional();
  const [viewMode, setViewMode] = useState(DOCUMENT_VIEW_MODES.EDIT);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < SPLIT_MODE_MIN_WIDTH;
  });
  const sourceParams = readDocumentSourceParams(searchParams);
  const sourceResolution = useDocumentSourceResolver(sourceParams);

  useEffect(() => {
    if (!topbar) return;
    topbar.setTitle("Документы");
    topbar.setSubtitle("Создание документа");
    return () => topbar.reset();
  }, [topbar]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(`(max-width: ${SPLIT_MODE_MIN_WIDTH - 1}px)`);
    const sync = () => setIsCompactViewport(media.matches);
    sync();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (isCompactViewport && viewMode === DOCUMENT_VIEW_MODES.SPLIT) {
      setViewMode(DOCUMENT_VIEW_MODES.EDIT);
    }
  }, [isCompactViewport, viewMode]);

  const handleBack = () => {
    navigate("/main/documents");
  };

  const handleCreateSuccess = (created) => {
    if (created?.id) {
      navigate(`/main/documents/${created.id}`);
      return;
    }
    navigate("/main/documents");
  };

  const sourceInfo = sourceResolution.sourceInfo
    ? {
      label: sourceResolution.sourceInfo.label,
      hint: "Данные источника скопированы в документ. После сохранения он редактируется независимо.",
    }
    : null;

  if (sourceResolution.hasSourceParams && sourceResolution.isLoading) {
    return (
      <div className={styles.page}>
        <section className={styles.stateCard}>
          <h2 className={styles.stateTitle}>Подготовка документа из источника</h2>
          <p className={styles.stateText}>Загружаем данные и формируем предзаполненный документ.</p>
        </section>
      </div>
    );
  }

  if (sourceResolution.hasSourceParams && sourceResolution.errorText) {
    return (
      <div className={styles.page}>
        <section className={styles.stateCard}>
          <h2 className={styles.stateTitle}>Не удалось загрузить источник</h2>
          <p className={styles.stateText}>{sourceResolution.errorText}</p>
          <div className={styles.stateActions}>
            {sourceResolution.refetch ? (
              <button type="button" className={styles.stateButton} onClick={() => sourceResolution.refetch?.()}>
                Повторить
              </button>
            ) : null}
            <button type="button" className={styles.stateButtonGhost} onClick={handleBack}>
              К списку документов
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <DocumentEditorContainer
      mode={DOCUMENT_EDITOR_MODES.CREATE}
      initialFormState={sourceResolution.draft}
      initialFormStateKey={sourceResolution.draftKey}
      onCreateSuccess={handleCreateSuccess}
    >
      {({ formState, clients, isClientsLoading, isSaving, saveError, onSave }) => {
        const typeConfig = getDocumentTypeConfig(formState?.header?.type);
        const statusLabel = getDocumentStatusLabel(formState?.header?.type, formState?.header?.status);
        const documentNumber = String(formState?.header?.number || "").trim() || "Автонумерация";
        const clientLabel = getClientLabel(formState?.meta?.clientId, clients);
        const issueDate = String(formState?.meta?.issueDate || "").trim() || "—";
        const direction = getDirectionLabel(formState?.header?.direction);

        return (
          <div className={styles.page}>
            <header className={styles.pageHeader}>
              <div className={styles.headerMain}>
                <button type="button" className={styles.backButton} onClick={handleBack}>
                  <ArrowLeft size={16} />
                  К документам
                </button>
                <p className={styles.breadcrumb}>Документы / Создание</p>
                <div className={styles.headerMeta}>
                  <span className={styles.headerTypeBadge}>{typeConfig.shortLabel}</span>
                  <span className={styles.headerStatusBadge}>{statusLabel}</span>
                </div>
                <h1 className={styles.title}>{documentNumber}</h1>
                <p className={styles.subtitle}>{typeConfig.copy.createSubtitle}</p>
                <div className={styles.headerFacts}>
                  <span className={styles.factChip}>Клиент: {clientLabel}</span>
                  <span className={styles.factChip}>Дата: {issueDate}</span>
                  <span className={styles.factChip}>Направление: {direction}</span>
                  {sourceInfo?.label ? (
                    <span className={`${styles.factChip} ${styles.factChipMuted}`}>Источник: {sourceInfo.label}</span>
                  ) : null}
                </div>
              </div>

              <div className={styles.actions}>
                <DocumentViewModeSwitch
                  value={viewMode}
                  onChange={setViewMode}
                  disabled={isSaving}
                  disabledModes={isCompactViewport ? [DOCUMENT_VIEW_MODES.SPLIT] : []}
                />
                <button type="button" className={styles.saveButton} onClick={onSave} disabled={isSaving}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </header>

            <DocumentForm
              formState={formState}
              clients={clients}
              isClientsLoading={isClientsLoading}
              disabled={isSaving}
              error={saveError}
              viewMode={viewMode}
            />
          </div>
        );
      }}
    </DocumentEditorContainer>
  );
}
