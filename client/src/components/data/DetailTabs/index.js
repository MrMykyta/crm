export default function DetailTabs({ tab, data }){
  switch(tab){
    case "overview":
      return <p>Тут будет описание объекта.</p>;
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