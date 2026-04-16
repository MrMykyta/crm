import DescriptionForm from '../sections/DescriptionForm';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';
import s from '../sections/sections.module.css';

// Компонент PlaceholderTab: отвечает за отображение UI и обработку взаимодействий пользователя.
function PlaceholderTab({ title, text, points = [] }) {
  return (
    <section className={s.placeholderCard}>
      <h3 className={s.placeholderTitle}>{title}</h3>
      <p className={s.placeholderText}>{text}</p>
      {points.length > 0 && (
        <ul className={s.placeholderList}>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Компонент TaskDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function TaskDetailTabs({ tab, data, onChange }) {
  if (!data) return null;

  switch (tab) {
    case 'description':
      return (
        <DescriptionForm
          taskId={data.id}
          initialHtml={data.description || ''}
          onSaved={(nextHtml) => onChange?.('description', nextHtml)}
        />
      );

    case 'notes':
      return <EntityNotesSection ownerType="task" ownerId={data.id} title="Заметки задачи" />;

    case 'files':
      return (
        <PlaceholderTab
          title="Файлы"
          text="Файлы задачи будут отображаться в этой панели."
          points={['Документы и вложения', 'Сортировка по дате/автору', 'Быстрый просмотр']}
        />
      );

    case 'links':
      return (
        <PlaceholderTab
          title="Связи"
          text="Связанные сущности: клиенты, сделки, проекты и другие записи CRM."
          points={['Связанные карточки CRM', 'Переход в один клик', 'Контекст по задаче']}
        />
      );

    case 'history':
      return (
        <PlaceholderTab
          title="История"
          text="Журнал изменений статусов, участников и описания задачи."
          points={['Кто и что изменил', 'Когда произошло изменение', 'Хронология по действиям']}
        />
      );

    case 'reminders':
      return (
        <PlaceholderTab
          title="Напоминания"
          text="Управление напоминаниями по срокам и ключевым этапам выполнения."
          points={['Напоминание о старте', 'Напоминание о дедлайне', 'Персональные уведомления']}
        />
      );

    case 'settings':
      return (
        <PlaceholderTab
          title="Настройки"
          text="Параметры задачи и дополнительные системные опции."
          points={['Режим агрегации статуса', 'Правила уведомлений', 'Видимость для участников']}
        />
      );

    default:
      return (
        <PlaceholderTab
          title="Раздел"
          text={`Таб «${tab}» пока не реализован.`}
        />
      );
  }
}

