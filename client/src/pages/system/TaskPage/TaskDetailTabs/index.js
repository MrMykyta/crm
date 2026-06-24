import { useTranslation } from 'react-i18next';
import DescriptionForm from '../sections/DescriptionForm';
import EntityNotesSection from '../../../../components/notes/EntityNotesSection';

// Компонент TaskDetailTabs: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function TaskDetailTabs({ tab, data, onChange }) {
  const { t } = useTranslation();
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
      return <EntityNotesSection ownerType="task" ownerId={data.id} title={t('crm.task.detail.notesTitle')} />;

    default:
      return null;
  }
}
