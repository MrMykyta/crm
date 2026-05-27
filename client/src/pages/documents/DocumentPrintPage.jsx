import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DocumentTemplateRenderer from "../../components/documents/DocumentTemplateRenderer";
import { mapDocumentToFormState } from "../../components/documents/documentFormMapping";
import { mapFormStateToPreviewModel } from "../../components/documents/documentPreviewMapping";
import { buildDefaultTemplate } from "../../components/documents/documentTemplateBuilderCatalog";
import { useGetCompanyQuery } from "../../store/rtk/companyApi";
import { useGetCounterpartyQuery } from "../../store/rtk/counterpartyApi";
import { useGetDocumentByIdQuery } from "../../store/rtk/documentsApi";
import styles from "./DocumentPrintPage.module.css";

function getDocumentDisplayNumber(document) {
  const number = String(document?.number || "").trim();
  if (number) return number;
  return String(document?.id || "").slice(0, 8) || "без номера";
}

export default function DocumentPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const documentId = String(id || "").trim();

  const { data: document, isLoading, isFetching, error } = useGetDocumentByIdQuery(documentId, {
    skip: !documentId,
    refetchOnMountOrArgChange: true,
  });
  const { data: companyData } = useGetCompanyQuery();
  const clientId = String(document?.clientId || "").trim();
  const { data: buyerData } = useGetCounterpartyQuery(clientId, {
    skip: !clientId,
  });

  const previewModel = useMemo(() => {
    if (!document) return null;
    const formState = mapDocumentToFormState(document);
    return mapFormStateToPreviewModel(formState, {
      clients: buyerData ? [buyerData] : [document?.client].filter(Boolean),
      company: companyData || {},
      buyer: buyerData || document?.client || null,
    });
  }, [buyerData, companyData, document]);

  const template = useMemo(() => {
    if (!previewModel) return null;
    return buildDefaultTemplate(previewModel.type);
  }, [previewModel]);

  const hasNotFoundError = Number(error?.status || error?.data?.status || 0) === 404;

  if (isLoading || (isFetching && !document)) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <h1>Подготовка печатной версии</h1>
          <p>Загружаем документ.</p>
        </section>
      </main>
    );
  }

  if (hasNotFoundError) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <h1>Документ не найден</h1>
          <p>Возможно, документ был удалён или недоступен в контексте текущей компании.</p>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate("/main/documents")}>
            К списку документов
          </button>
        </section>
      </main>
    );
  }

  if (error || !previewModel || !template) {
    return (
      <main className={styles.page}>
        <section className={styles.stateCard}>
          <h1>Ошибка загрузки</h1>
          <p>{error?.data?.message || error?.data?.error || "Не удалось подготовить документ для печати."}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate(`/main/documents/${documentId}`)}>
            Вернуться к документу
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarMeta}>
          <h1 className={styles.title}>Печать документа</h1>
          <p className={styles.subtitle}>{getDocumentDisplayNumber(document)}</p>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => navigate(`/main/documents/${documentId}`)}>
            Назад
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => window.print()}>
            Печать
          </button>
        </div>
      </header>

      <section className={styles.canvas}>
        <DocumentTemplateRenderer model={previewModel} template={template} mode="print" />
      </section>
    </main>
  );
}
