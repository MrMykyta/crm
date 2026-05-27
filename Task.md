

# M7.1 — Document Template: Print UX + Theme System + Canvas DnD Foundation

## 🎯 Цель
Довести Document Template Renderer и DocumentDetailsPage до production уровня:

- чистая печать A4 (без мусора)
- нормальные отступы
- footer с брендингом
- подготовка theme system (цвета)
- заложить фундамент для DnD в canvas

---

# 1. 🖨 PRINT FIX (критично)

## ❌ Сейчас:
- большой верхний отступ  
- сверху "Sunset system" + дата (лишнее)  
- снизу печатается URL (/main/documents/...)  

---

## ✅ Нужно:

### 1.1 Убрать системный header

В renderer убрать:

- "Sunset system"  
- дату генерации (если не часть шаблона)  

Если это приходит из данных — не рендерить по умолчанию.

---

### 1.2 Уменьшить верхний отступ

@media print {
  [data-print-area="document-template"] {
    margin: 0;
    padding: 10mm 12mm 15mm 12mm;
  }
}

---

### 1.3 Убрать URL снизу

@media print {
  a[href]:after {
    content: none !important;
  }
}

---

### 1.4 Добавить footer

В DocumentTemplateRenderer (внутри страницы):

<div className={s.footer}>
  Dokument wygenerowany przez Sunset System
</div>

.footer {
  position: absolute;
  bottom: 10mm;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  color: #888;
}

---

# 2. 🎨 THEME SYSTEM

## 2.1 Добавить theme в props

block.props.theme = {
  primary: "#2563eb",
  text: "#111",
  muted: "#666",
  border: "#e5e7eb",
  background: "#ffffff",
}

---

## 2.2 CSS variables

:root {
  --doc-primary: #2563eb;
  --doc-text: #111;
  --doc-muted: #666;
  --doc-border: #e5e7eb;
}

В renderer:

style={{
  "--doc-primary": theme.primary,
  "--doc-text": theme.text,
  "--doc-muted": theme.muted,
  "--doc-border": theme.border,
}}

---

## 2.3 Применение

.label {
  color: var(--doc-muted);
}

.value {
  color: var(--doc-text);
}

.table {
  border-color: var(--doc-border);
}

---

# 3. 🧠 CANVAS DnD FOUNDATION

## 3.1 Drop zones

<div data-drop-zone data-block-id={block.id}>

---

## 3.2 Drag state

{
  draggingBlockId,
  hoverTargetId,
  position: "before" | "after"
}

---

## 3.3 Hover стиль

.dropTarget {
  border: 1px dashed #2563eb;
}

---

❗ НЕ делать полный DnD — только подготовить архитектуру

---

# 4. 🧩 UI/UX ДОПИЛ

## 4.1 Отступы

.metaRow {
  margin-bottom: 4px;
}

---

## 4.2 Таблица

table {
  border-collapse: collapse;
}

td, th {
  padding: 6px 8px;
}

---

## 4.3 Заголовок

.title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 10px;
}

---

# ✔ Критерии готовности

- нет URL в print  
- нет "Sunset system" сверху  
- есть footer  
- нормальные отступы  
- theme работает  
- подготовлен DnD  
- UI стал компактнее  

---

# 🚀 ВАЖНО

Не ломать:

- fieldsConfig  
- bindings  
- render pipeline  

Только улучшение UI/print + подготовка архитектуры