import HtmlDescriptionSection from "../HtmlDescriptionSection";

// Компонент DetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DetailTabs({ tab, data, values, onChange }){
  const hasDescriptionField = Object.prototype.hasOwnProperty.call(values || {}, "description");
  const descriptionHtml = hasDescriptionField
    ? String(values?.description ?? "")
    : String(data?.description ?? "");
  const editable = hasDescriptionField && typeof onChange === "function";

  switch(tab){
    case "overview":
      return (
        <HtmlDescriptionSection
          title="Описание"
          value={descriptionHtml}
          editable={editable}
          onSave={async (nextHtml) => {
            if (!editable) return nextHtml;
            onChange("description", nextHtml);
            return nextHtml;
          }}
          placeholder="Опишите сущность: ключевые детали, договоренности, условия…"
          emptyText="Описание пока пустое. Нажмите «Редактировать», чтобы добавить HTML-описание."
          minHeight={340}
        />
      );
    case "notes":
      return <p>Заметки (лист + добавление)</p>;
    case "files":
      return <p>Файлы (загрузка/просмотр)</p>;
    case "orders":
      return <p>Заказы по контрагенту</p>;
    case "invoices":
      return <p>Фактуры</p>;
    case "history":
      return <p>История изменений</p>;
    case "reminders":
      return <p>Напоминания</p>;
    default:
      return <p>Тут будет текст или список — зависит от выбранной закладки.</p>;
  }
}

