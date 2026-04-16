# CHAT UI NOTES

## 1) Правила позиционирования (menu + reactions)
- Исходные файлы:
  - [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
  - [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
  - [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)
- Входные данные:
  - `bubbleEl.getBoundingClientRect()`
  - `containerEl.getBoundingClientRect()`
- Правила:
  - перевод координат в локальные координаты контейнера
  - приоритет вправо для своих сообщений, влево для чужих
  - горизонтальный clamp: `[8 .. containerWidth - menuWidth - 8]`
  - по умолчанию открывать вниз, если overflow снизу — открывать вверх
  - вертикальный clamp: `[8 .. containerHeight - menuHeight - 8]`
  - реакции центрируются по bubble, ограничиваются контейнером и `maxWidth`

## 2) Правила linkify + безопасность
- Исходные файлы:
  - [`client/src/utils/linkifyMessage.js`](../../client/src/utils/linkifyMessage.js)
  - [`client/src/pages/Chat/components/ChatMessages/index.js`](../../client/src/pages/Chat/components/ChatMessages/index.js)
  - [`client/src/pages/Chat/ChatPage.module.css`](../../client/src/pages/Chat/ChatPage.module.css)
- Что детектится:
  - `https://...`
  - `http://...`
  - `www....`
  - домены без протокола, например `example.com/path`
- Безопасность:
  - без `dangerouslySetInnerHTML`
  - если протокол не указан, добавляется `https://`
  - рендер ссылки: `<a target="_blank" rel="noopener noreferrer">`

## 3) Известные UI баги (шаблон)
- [ ] Кейс:
  - Шаги воспроизведения:
  - Ожидаемое поведение:
  - Фактическое поведение:
  - Связанные файлы:
  - Примечания:
