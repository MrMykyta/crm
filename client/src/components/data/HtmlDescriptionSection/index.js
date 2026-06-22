import { useEffect, useMemo, useState } from 'react';
import { HtmlEditorField } from '../../ui/fields';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import s from './HtmlDescriptionSection.module.css';

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

// Компонент HtmlDescriptionSection: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function HtmlDescriptionSection({
  title = 'Описание',
  value = '',
  onSave,
  placeholder = 'Добавьте описание…',
  emptyText = 'Описание пока пустое. Нажмите «Редактировать», чтобы добавить описание.',
  minHeight = 320,
  editable = true,
  className = '',
}) {
  const [savedHtml, setSavedHtml] = useState(value || '');
  const [draft, setDraft] = useState(value || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const next = value || '';
    setSavedHtml(next);

    if (!isEditing) {
      setDraft(next);
    }

    if (!isEditing) {
      setMessage('');
    }
  }, [value, editable, isEditing]);

  const normalizedDraft = normalizeHtml(draft);
  const normalizedSaved = normalizeHtml(savedHtml);
  const dirty = normalizedDraft !== normalizedSaved;
  const previewHtml = useMemo(() => sanitizeHtml(savedHtml), [savedHtml]);

    // startEdit: вспомогательная логика компонента.
const startEdit = () => {
    if (!editable) return;
    setDraft(savedHtml);
    setIsEditing(true);
    setMessage('');
  };

    // cancelEdit: проверяет, доступно ли действие в текущем UI-состоянии.
const cancelEdit = () => {
    setDraft(savedHtml);
    setIsEditing(false);
    setMessage('');
  };

    // saveEdit: сохраняет изменения из формы/редактора.
const saveEdit = async () => {
    if (!editable) return;

    const payload = normalizeHtml(draft);

    try {
      setIsSaving(true);
      setMessage('');

      let next = payload;
      if (onSave) {
        const saved = await onSave(payload);
        if (typeof saved === 'string') {
          next = saved;
        }
      }

      setSavedHtml(next);
      setDraft(next);
      setIsEditing(false);
      setMessage('Сохранено');
    } catch (e) {
      setMessage(e?.data?.error || e?.data?.message || e?.message || 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={`${s.sectionCard} ${className}`.trim()}>
      <div className={s.headerRow}>
        <h3 className={s.title}>{title}</h3>
        {editable ? (
          <div className={s.actions}>
            {!isEditing ? (
              <button type="button" className={s.ghostBtn} onClick={startEdit}>
                Редактировать
              </button>
            ) : (
              <>
                <button type="button" className={s.ghostBtn} onClick={cancelEdit} disabled={isSaving}>
                  Отмена
                </button>
                <button
                  type="button"
                  className={s.primaryBtn}
                  onClick={saveEdit}
                  disabled={isSaving || !dirty}
                >
                  {isSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {isEditing ? (
        <HtmlEditorField
          value={draft}
          onValueChange={setDraft}
          placeholder={placeholder}
          minHeight={minHeight}
        />
      ) : previewHtml ? (
        <div className={s.htmlView} dangerouslySetInnerHTML={{ __html: previewHtml }} />
      ) : (
        <div className={s.emptyState}>{emptyText}</div>
      )}

      {editable ? (
        <div className={s.footerRow}>
          <span className={dirty ? s.dirty : s.clean}>
            {isSaving ? 'Сохранение…' : dirty ? 'Есть несохранённые изменения' : 'Все изменения сохранены'}
          </span>
          {message ? <span className={s.message}>{message}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
