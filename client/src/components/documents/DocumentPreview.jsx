import { useMemo } from "react";
import DocumentTemplateRenderer from "./DocumentTemplateRenderer";
import { mapFormStateToPreviewModel } from "./documentPreviewMapping";
import { buildDefaultTemplate } from "./documentTemplateBuilderCatalog";
import { useGetCompanyQuery } from "../../store/rtk/companyApi";
import { useGetCounterpartyQuery } from "../../store/rtk/counterpartyApi";
import styles from "./DocumentPreview.module.css";

export default function DocumentPreview({ formState, clients = [] }) {
  const selectedClientId = String(formState?.meta?.clientId || "").trim();
  const selectedClient = Array.isArray(clients)
    ? clients.find((client) => String(client?.id || "") === selectedClientId) || null
    : null;
  const shouldFetchBuyer =
    Boolean(selectedClientId) && (!selectedClient || !selectedClient.street || !selectedClient.city);

  const { data: companyData } = useGetCompanyQuery();
  const { data: buyerData } = useGetCounterpartyQuery(selectedClientId, {
    skip: !shouldFetchBuyer,
  });
  const model = useMemo(
    () =>
      mapFormStateToPreviewModel(formState, {
        clients,
        company: companyData || {},
        buyer: buyerData || selectedClient || null,
      }),
    [buyerData, clients, companyData, formState, selectedClient]
  );

  const template = useMemo(() => {
    return buildDefaultTemplate(model.type);
  }, [model.type]);

  return (
    <div className={styles.stage}>
      <DocumentTemplateRenderer model={model} template={template} />
    </div>
  );
}
