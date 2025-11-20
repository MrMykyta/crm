// Чистит схему по whitelist и корректно расставляет секции (хедер до полей)
export function filterSchema(schema, allowNames = []) {
  const allow = new Set(allowNames);

  const keepItem = (it) => {
    if (!it) return false;
    if (it.kind === 'section') return true;           // обработаем отдельно
    if (it.kind === 'spacer') return true;            // разрешаем спейсер
    if (!it.name) return false;
    return allow.has(it.name);
  };

  const out = [];
  let currentSection = null;        // { ...section, _pushed?:bool }
  let hasFieldsInSection = false;

  const pushSectionHeaderIfNeeded = () => {
    if (currentSection && !currentSection._pushed) {
      out.push({ ...currentSection }); // без служебных полей
      currentSection._pushed = true;
    }
  };

  for (const raw of schema) {
    const item = raw && typeof raw === 'object' ? raw : null;

    if (item?.kind === 'section') {
      // открываем новую секцию; предыдущая, если была пустой, так и не будет добавлена
      currentSection = { ...item, _pushed: false };
      hasFieldsInSection = false;
      continue;
    }

    if (!keepItem(item)) continue;

    // если мы внутри секции — сначала пушим её заголовок (один раз)
    if (currentSection) {
      pushSectionHeaderIfNeeded();
      hasFieldsInSection = true;
    }

    out.push(item);
  }

  // если последняя секция оказалась пустой — её хедер так и не был запушен, это ок.
  return out;
}