import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useTopbarOptional } from "../../Providers/TopbarProvider";
import DocumentForm from "../../components/documents/DocumentForm";
import DocumentViewModeSwitch from "../../components/documents/DocumentViewModeSwitch";
import DocumentEditorContainer, {
  DOCUMENT_EDITOR_MODES,
} from "../../components/documents/DocumentEditorContainer";
import { DOCUMENT_VIEW_MODES } from "../../components/documents/documentViewModes";
import { getDocumentTypeConfig } from "../../components/documents/documentTypeConfig";
import { getDocumentStatusLabel } from "../../components/documents/documentStatusConfig";
import { getAllowedDocumentConversionTargets } from "../../components/documents/documentConversionConfig";
import { useConvertDocumentMutation, useGetDocumentRenderTemplateQuery } from "../../store/rtk/documentsApi";
import DocumentTemplateRenderer from "../../features/documentTemplateRenderer";
import styles from "./DocumentEditorPage.module.css";

const SPLIT_MODE_MIN_WIDTH = 1240;

const SOURCE_BADGE_LABELS = {
  selected: "Template: selected",
  company_default: "Template: company default",
  system_default: "Template: system default",
};

function getDocumentDisplayNumber(document) {
  const number = String(document?.number || "").trim();
  if (number) return number;
  return String(document?.id || "").slice(0, 8) || "без номера";
}

function getSourceInfo(document, source = {}) {
  const sourceDocumentType = String(source?.sourceDocumentType || document?.sourceDocumentType || "").trim();
  const sourceDocumentId = String(source?.sourceDocumentId || document?.sourceDocumentId || "").trim();
  const sourceEntityType = String(source?.sourceEntityType || document?.sourceEntityType || "").trim();
  const sourceEntityId = String(source?.sourceEntityId || document?.sourceEntityId || "").trim();

  if (sourceDocumentType || sourceDocumentId) {
    const sourceLabel = sourceDocumentType
      ? getDocumentTypeConfig(sourceDocumentType).shortLabel
      : "Документ";
    const sourceNumber = sourceDocumentId ? sourceDocumentId.slice(0, 8) : "без номера";
    return {
      label: `${sourceLabel} ${sourceNumber}`,
      hint: "Связь с исходным документом сохранена. Текущий документ редактируется независимо.",
    };
  }

  if (sourceEntityType || sourceEntityId) {
    const sourceLabel = sourceEntityType || "Источник";
    const sourceRef = sourceEntityId ? sourceEntityId.slice(0, 8) : "—";
    return {
      label: `${sourceLabel} ${sourceRef}`,
      hint: "Документ создан из источника и хранит ссылку на него.",
    };
  }

  return null;
}

function getErrorText(error, fallback = "Не удалось выполнить конвертацию документа.") {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

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

function getTemplatePageConfig(templateContent) {
  const page = templateContent?.page || {};
  const size = page.size || "A4";
  const orientation = page.orientation || "portrait";
  const margins = page.margins || {};
  const isLandscape = orientation === "landscape";

  return {
    size,
    orientation,
    width: isLandscape ? "297mm" : "210mm",
    minHeight: isLandscape ? "210mm" : "297mm",
    margins: {
      top: Number.isFinite(Number(margins.top)) ? Number(margins.top) : 20,
      right: Number.isFinite(Number(margins.right)) ? Number(margins.right) : 15,
      bottom: Number.isFinite(Number(margins.bottom)) ? Number(margins.bottom) : 20,
      left: Number.isFinite(Number(margins.left)) ? Number(margins.left) : 15,
    },
  };
}

// Renders the document using the resolved template from the API.
function DocumentTemplatePreview({ documentId }) {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useGetDocumentRenderTemplateQuery({ documentId }, { skip: !documentId });

  if (isLoading) {
    return (
      <div className={styles.templatePreviewSkeleton}>
        <div className={styles.templatePreviewSkeletonBar} style={{ width: "60%" }} />
        <div className={styles.templatePreviewSkeletonBar} style={{ width: "90%" }} />
        <div className={styles.templatePreviewSkeletonBar} style={{ width: "75%" }} />
        <div className={styles.templatePreviewSkeletonBar} style={{ width: "85%" }} />
        <div className={styles.templatePreviewSkeletonBar} style={{ width: "50%" }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.templatePreviewError}>
        <strong>Preview unavailable</strong>
        <div>{error?.data?.message || error?.data?.error || "Could not load render data."}</div>
      </div>
    );
  }

  const { template, dataContext } = data;
  const templateContent = template?.content;
  const pageConfig = getTemplatePageConfig(templateContent);

  const pageShellStyle = {
    width: pageConfig.width,
    minHeight: pageConfig.minHeight,
    "--preview-margin-top": `${pageConfig.margins.top}mm`,
    "--preview-margin-right": `${pageConfig.margins.right}mm`,
    "--preview-margin-bottom": `${pageConfig.margins.bottom}mm`,
    "--preview-margin-left": `${pageConfig.margins.left}mm`,
  };

  return (
    <div className={styles.templatePreviewViewport} data-print-area="document-template">
      <div>
        {template?.source ? (
          <div className={styles.templatePreviewSourceBadge}>
            {SOURCE_BADGE_LABELS[template.source] || template.source}
          </div>
        ) : null}
        <div
          className={styles.templatePreviewPageShell}
          data-orientation={pageConfig.orientation}
          data-size={pageConfig.size}
          style={pageShellStyle}
        >
          <div className={styles.templatePreviewPageContent}>
            <DocumentTemplateRenderer
              templateDraft={templateContent}
              dataContext={dataContext}
              renderContext={{
                mode: "screen_view",
                channel: "screen",
                locale: "pl",
                isEditorInteractive: false,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const topbar = useTopbarOptional();
  const [convertDocument, { isLoading: isConverting }] = useConvertDocumentMutation();
  const [conversionTargetType, setConversionTargetType] = useState("");
  const [conversionError, setConversionError] = useState("");
  const [viewMode, setViewMode] = useState(DOCUMENT_VIEW_MODES.EDIT);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < SPLIT_MODE_MIN_WIDTH;
  });

  useEffect(() => {
    if (!topbar) return;
    topbar.setTitle("Документы");
    topbar.setSubtitle("Карточка документа");
    return () => topbar.reset();
  }, [topbar]);

  useEffect(() => {
    setConversionTargetType("");
    setConversionError("");
    setViewMode(DOCUMENT_VIEW_MODES.EDIT);
  }, [id]);

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

  return (
    <DocumentEditorContainer mode={DOCUMENT_EDITOR_MODES.EDIT} documentId={id}>
      {({
        document,
        formState,
        clients,
        isClientsLoading,
        isInitialLoading,
        isSaving,
        saveError,
        saveSuccess,
        notFound,
        loadError,
        refetchDocument,
        onSave,
      }) => {
        if (isInitialLoading) {
          return (
            <div className={styles.page}>
              <section className={styles.stateCard}>
                <h2 className={styles.stateTitle}>Загрузка документа</h2>
                <p className={styles.stateText}>Подготавливаем данные для редактирования.</p>
              </section>
            </div>
          );
        }

        if (notFound) {
          return (
            <div className={styles.page}>
              <section className={styles.stateCard}>
                <h2 className={styles.stateTitle}>Документ не найден</h2>
                <p className={styles.stateText}>
                  Документ не существует или недоступен в контексте текущей компании.
                </p>
                <button type="button" className={styles.stateButton} onClick={handleBack}>
                  Вернуться к списку
                </button>
              </section>
            </div>
          );
        }

        if (loadError) {
          return (
            <div className={styles.page}>
              <section className={styles.stateCard}>
                <h2 className={styles.stateTitle}>Ошибка загрузки</h2>
                <p className={styles.stateText}>
                  {loadError?.data?.message || loadError?.data?.error || "Не удалось загрузить документ."}
                </p>
                <div className={styles.stateActions}>
                  <button type="button" className={styles.stateButton} onClick={refetchDocument}>
                    Повторить
                  </button>
                  <button type="button" className={styles.stateButtonGhost} onClick={handleBack}>
                    К списку
                  </button>
                </div>
              </section>
            </div>
          );
        }

        const displayNumber = getDocumentDisplayNumber(document);
        const sourceInfo = getSourceInfo(document, formState?.source);
        const typeConfig = getDocumentTypeConfig(formState?.header?.type);
        const statusLabel = getDocumentStatusLabel(formState?.header?.type, formState?.header?.status);
        const clientLabel = getClientLabel(formState?.meta?.clientId, clients);
        const issueDate = String(formState?.meta?.issueDate || "").trim() || "—";
        const direction = getDirectionLabel(formState?.header?.direction);
        const conversionTargets = getAllowedDocumentConversionTargets(document?.type);
        const hasConversionTargets = conversionTargets.length > 0;
        const resolvedConversionTargetType = conversionTargets.some(
          (target) => target.targetType === conversionTargetType
        )
          ? conversionTargetType
          : conversionTargets[0]?.targetType || "";
        const selectedConversion = conversionTargets.find(
          (target) => target.targetType === resolvedConversionTargetType
        );
        const helperText = saveSuccess || "";
        const isBusy = isSaving || isConverting;
        const isPreviewMode = viewMode === DOCUMENT_VIEW_MODES.PREVIEW;
        const isSplitMode = viewMode === DOCUMENT_VIEW_MODES.SPLIT;

        const handlePrint = () => {
          if (isPreviewMode || isSplitMode) {
            window.print();
          } else {
            setViewMode(DOCUMENT_VIEW_MODES.PREVIEW);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => window.print());
            });
          }
        };

        const handleConvert = async () => {
          if (!document?.id || !resolvedConversionTargetType || isBusy) return;
          setConversionError("");
          try {
            const converted = await convertDocument({
              id: document.id,
              targetType: resolvedConversionTargetType,
            }).unwrap();
            if (converted?.id) {
              navigate(`/main/documents/${converted.id}`);
              return;
            }
            setConversionError("Конвертация выполнена, но id нового документа не получен.");
          } catch (error) {
            setConversionError(getErrorText(error));
          }
        };

        const pageHeader = (
          <header className={styles.pageHeader}>
            <div className={styles.headerMain}>
              <button type="button" className={styles.backButton} onClick={handleBack}>
                <ArrowLeft size={16} />
                К документам
              </button>
              <p className={styles.breadcrumb}>Документы / {displayNumber}</p>
              <div className={styles.headerMeta}>
                <span className={styles.headerTypeBadge}>{typeConfig.shortLabel}</span>
                <span className={styles.headerStatusBadge}>{statusLabel}</span>
              </div>
              <h1 className={styles.title}>{displayNumber}</h1>
              <p className={styles.subtitle}>{typeConfig.copy.detailsSubtitle}</p>
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
                disabled={isBusy}
                disabledModes={isCompactViewport ? [DOCUMENT_VIEW_MODES.SPLIT] : []}
              />
              <button
                type="button"
                className={styles.printButton}
                onClick={handlePrint}
                disabled={isBusy}
              >
                <Printer size={14} />
                Печать
              </button>
              {hasConversionTargets ? (
                <div className={styles.convertActionBlock}>
                  <p className={styles.convertLabel}>Создать на основе</p>
                  <div className={styles.convertControls}>
                    <select
                      value={resolvedConversionTargetType}
                      onChange={(event) => {
                        setConversionTargetType(event.target.value);
                        setConversionError("");
                      }}
                      className={styles.convertSelect}
                      disabled={isBusy}
                    >
                      {conversionTargets.map((target) => (
                        <option key={target.targetType} value={target.targetType}>
                          {target.actionLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.convertButton}
                      onClick={handleConvert}
                      disabled={isBusy || !resolvedConversionTargetType}
                      title={selectedConversion?.hint || ""}
                    >
                      {isConverting ? "Создание..." : "Создать"}
                    </button>
                  </div>
                  {conversionError ? <p className={styles.convertError}>{conversionError}</p> : null}
                </div>
              ) : null}

              {!isPreviewMode ? (
                <button type="button" className={styles.saveButton} onClick={onSave} disabled={isBusy}>
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </button>
              ) : null}
            </div>
          </header>
        );

        // PREVIEW mode — full-width template renderer only
        if (isPreviewMode) {
          return (
            <div className={styles.page}>
              {pageHeader}
              <div className={styles.templatePreviewFull}>
                <DocumentTemplatePreview documentId={id} />
              </div>
            </div>
          );
        }

        // SPLIT mode — form on left, template renderer on right
        if (isSplitMode) {
          return (
            <div className={styles.page}>
              {pageHeader}
              <div className={styles.templatePreviewSplitWrap}>
                <div className={styles.templatePreviewSplitForm}>
                  <DocumentForm
                    formState={formState}
                    clients={clients}
                    isClientsLoading={isClientsLoading}
                    disabled={isSaving}
                    error={saveError}
                    helperText={helperText}
                    helperTone={saveSuccess ? "success" : "neutral"}
                    viewMode={DOCUMENT_VIEW_MODES.EDIT}
                  />
                </div>
                <div className={styles.templatePreviewSplitCanvas}>
                  <DocumentTemplatePreview documentId={id} />
                </div>
              </div>
            </div>
          );
        }

        // EDIT mode — existing behavior
        return (
          <div className={styles.page}>
            {pageHeader}
            <DocumentForm
              formState={formState}
              clients={clients}
              isClientsLoading={isClientsLoading}
              disabled={isSaving}
              error={saveError}
              helperText={helperText}
              helperTone={saveSuccess ? "success" : "neutral"}
              viewMode={viewMode}
            />
          </div>
        );
      }}
    </DocumentEditorContainer>
  );
}
