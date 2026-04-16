import { useEffect, useState } from 'react';
import HtmlDescriptionSection from '../../../../../components/data/HtmlDescriptionSection';
import { useUpdateTaskMutation } from '../../../../../store/rtk/tasksApi';

// htmlToText: вспомогательная логика компонента.
const htmlToText = (html = '') =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// normalizeHtml: нормализует данные для отображения и ввода.
const normalizeHtml = (html = '') => {
  const text = htmlToText(html);
  if (!text) return '';
  return String(html || '').trim();
};

// Компонент DescriptionForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function DescriptionForm({ taskId, initialHtml = '', onSaved }) {
  const [updateTask, { isLoading }] = useUpdateTaskMutation();

  const [value, setValue] = useState(initialHtml || '');

  useEffect(() => {
    const next = initialHtml || '';
    setValue(next);
  }, [initialHtml]);

    // save: сохраняет данные в рамках UI-компонента.
const save = async (nextHtml) => {
    const payloadHtml = normalizeHtml(nextHtml);
    const saved = await updateTask({
        id: taskId,
        payload: { description: payloadHtml },
      }).unwrap();

    const finalHtml = saved?.description ?? payloadHtml;
    setValue(finalHtml);
    onSaved?.(finalHtml);
    return finalHtml;
  };

  return (
    <HtmlDescriptionSection
      title="Описание"
      value={value}
      onSave={save}
      placeholder="Опишите задачу: цель, шаги, ссылки, чек-лист…"
      emptyText="Описание пока пустое. Нажмите «Редактировать», чтобы добавить HTML-описание."
      minHeight={320}
      editable={!isLoading}
    />
  );
}

