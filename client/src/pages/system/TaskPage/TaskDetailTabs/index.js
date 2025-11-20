// src/pages/system/TaskPage/TaskDetailPage/TaskDetailTabs.jsx
import DescriptionForm from "../sections/DescriptionForm";

export default function TaskDetailTabs({ tab, data, values, onChange }) {
  if (!data) return null;

  switch (tab) {
    case "overview":
      return (
        <DescriptionForm
          taskId={data.id}
          initialHtml={data.description || ""}
          onSaved={(nextHtml) => onChange?.("description", nextHtml)}
        />
      );

    case "files":
      return <div style={{padding:16}}>Здесь будут <b>Файлы</b> задачи</div>;

    case "tasks":
      return <div style={{padding:16}}>Связанные <b>подзадачи</b> (или связанные тикеты)</div>;

    case "offers":
      return <div style={{padding:16}}>Связанные <b>предложения</b></div>;

    case "orders":
      return <div style={{padding:16}}>Связанные <b>заказы</b></div>;

    case "invoices":
      return <div style={{padding:16}}>Связанные <b>счета</b></div>;

    case "documents":
      return <div style={{padding:16}}>Привязанные <b>документы</b> (договора, приложения)</div>;

    case "email":
      return <div style={{padding:16}}>Почтовая <b>переписка</b> по задаче</div>;

    default:
      return <div style={{padding:16, color:"var(--muted)"}}>Таб «{tab}» пока не реализован</div>;
  }
}