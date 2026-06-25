import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Workspace } from '../../components/workspace';
import AddButton from "../../components/buttons/AddButton/AddButton";
import useGridPrefs from "../../hooks/useGridPrefs";
import useAclPermissions from "../../hooks/useAclPermissions";
import { createDocumentListColumns } from "../../components/workspace/columnSchemas/documentsColumns";
import { DOCUMENT_TYPE_OPTIONS } from "../../components/documents/documentTypeConfig";

const TYPE_OPTIONS = [{ value: "", label: "Все типы" }, ...DOCUMENT_TYPE_OPTIONS];

const DIRECTION_OPTIONS = [
  { value: "", label: "Любое направление" },
  { value: "sale", label: "Продажа" },
  { value: "purchase", label: "Закупка" },
];

export default function DocumentsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canCreateDocument = can("document:create");

  const {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs("crm.documents");

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/documents/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createDocumentListColumns({ onOpenDetail: openDetail }),
    [openDetail]
  );

  return (
    <Workspace
      source="documents"
      title={t("menu.documents", "Документы")}
      columns={columns}
      defaultQuery={{ sort: "createdAt", dir: "DESC", limit: 25 }}
      actions={canCreateDocument ? (
        <AddButton onClick={() => navigate("/main/documents/create")}>
          Создать документ
        </AddButton>
      ) : null}
      columnWidths={colWidths}
      onColumnResize={onColumnResize}
      columnOrder={colOrder}
      onColumnOrderChange={onColumnOrderChange}
      columnVisibility={colVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      savedViews={savedViews}
      activeViewId={activeViewId}
      onSavedViewsChange={onSavedViewsChange}
      onActiveViewChange={onActiveViewChange}
      onResetColumns={resetGridPrefs}
      dynamicColumnsMode="custom-only"
      filterControls={[
            {
              type: "search",
              key: "search",
              placeholder: "Поиск по номеру...",
              debounce: 350,
            },
            {
              type: "select",
              key: "type",
              label: "Тип",
              options: TYPE_OPTIONS,
            },
            {
              type: "select",
              key: "direction",
              label: "Направление",
              options: DIRECTION_OPTIONS,
            },
          ]}
    />
  );
}
