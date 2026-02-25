# CHAT UI NOTES

## 1) Positioning Rules (menu + reactions)
- Source files:
  - [`client/src/pages/Chat/utils/calcFloatingPosition.js`](../../client/src/pages/Chat/utils/calcFloatingPosition.js)
  - [`client/src/pages/Chat/components/MessageContextMenu/index.js`](../../client/src/pages/Chat/components/MessageContextMenu/index.js)
  - [`client/src/pages/Chat/ChatWindow/index.js`](../../client/src/pages/Chat/ChatWindow/index.js)
- Inputs:
  - `bubbleEl.getBoundingClientRect()`
  - `containerEl.getBoundingClientRect()`
- Rules:
  - convert to container-local coordinates
  - prefer right for own message, left for others
  - horizontal clamp: `[8 .. containerWidth - menuWidth - 8]`
  - open down by default, open up if overflow bottom
  - vertical clamp: `[8 .. containerHeight - menuHeight - 8]`
  - reactions centered by bubble, bounded by container and `maxWidth`

## 2) Linkify Rules + Safety
- Source files:
  - [`client/src/utils/linkifyMessage.js`](../../client/src/utils/linkifyMessage.js)
  - [`client/src/pages/Chat/components/ChatMessages/index.js`](../../client/src/pages/Chat/components/ChatMessages/index.js)
  - [`client/src/pages/Chat/ChatPage.module.css`](../../client/src/pages/Chat/ChatPage.module.css)
- Detects:
  - `https://...`
  - `http://...`
  - `www....`
  - bare domains like `example.com/path`
- Safety:
  - no `dangerouslySetInnerHTML`
  - normalizes protocol to `https://` when absent
  - renders `<a target="_blank" rel="noopener noreferrer">`

## 3) Known UI Bugs (template)
- [ ] Case:
  - Repro:
  - Expected:
  - Actual:
  - Related files:
  - Notes:

