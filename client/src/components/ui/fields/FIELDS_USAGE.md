# `ui/fields` — Usage Guide (Phase 1)

Единая библиотека form field компонентов для Sunset CRM/ERP. Создана в рамках
**Phase 1** задачи FORM FIELDS STANDARDIZATION. Существующие формы **не мигрировались** —
это только совместимый слой.

## 1. Зачем нужна библиотека

Сейчас поля раскиданы по проекту: сырые `<input>/<select>/<textarea>`, `SmartForm`,
`ThemedSelect`, `AutocompleteSelect`, Formik-обёртки, локальные стили. Библиотека даёт
**единый props-контракт**, единые состояния (label / error / helper / required / counter),
единый вид (через токены темы) и **совместимость и с `useState`, и с Formik** без переписывания
бизнес-логики.

Компоненты v1 (Phase 1):

| Компонент | Назначение |
|---|---|
| `FieldShell` | Оболочка: label, required, description, helper, error, counter, иконки, loading, aria |
| `TextField` | Текстовый input (type настраивается) |
| `TextareaField` | Многострочный input |
| `NumberField` | Числовой input с `emitAs` string/number |
| `CheckboxField` | Булевый чекбокс |
| `SelectField` | Обёртка над `ThemedSelect` (RadixSelect) |
| `AutocompleteField` | Обёртка над `AutocompleteSelect` |
| `FieldsGrid` | Отзывчивая сетка формы |
| `FormSection` | Секция формы с заголовком/действиями |

Компоненты Phase 1B:

| Компонент | Назначение |
|---|---|
| `PasswordField` | TextField + toggle show/hide (lucide `Eye`/`EyeOff`) |
| `EmailField` | TextField type="email" |
| `PhoneField` | TextField type="tel" (без маски) |
| `UrlField` | TextField type="url" |
| `CurrencyField` | NumberField + prefix/suffix валюты |
| `PercentField` | NumberField + суффикс "%" (min/max 0..100) |
| `DateField` | Обёртка над `DateTimePicker` (date-only) |
| `TimeField` | input type="time" поверх TextField |
| `DateTimeField` | Обёртка над `DateTimePicker` (withTime) |
| `FileField` | Неконтролируемый file input |
| `CountryField` | SelectField на `utils/countries.js` (ISO2) |
| `FormActions` | Блок кнопок формы (submit/cancel) |

Импорт:

```js
import { TextField, SelectField, NumberField, FieldsGrid, FormSection } from "components/ui/fields";
```

## 2. Базовый onChange contract (dual-mode)

Каждый компонент по возможности вызывает **оба** колбэка:

```js
onValueChange?.(value);     // value-style (удобно для useState)
onChange?.(value, event);   // value + нативное событие (удобно для event-style/Formik)
```

- Для нативных `input/textarea/checkbox` `event` — это реальный DOM-событие.
- Для `SelectField`/`AutocompleteField` нативного события нет → второй аргумент `null`
  (а для autocomplete — выбранная опция).

Базовые props (поддерживаются всеми полями через `FieldShell`):

```
name, id, label, value, onChange, onValueChange, onBlur, placeholder,
disabled, readOnly, required, error, helperText, description,
className, inputClassName, fullWidth, size ('sm'|'md'|'lg'),
leftIcon, rightIcon, loading
```

## 3. Пример: useState

```jsx
const [name, setName] = useState("");

<TextField
  label="Название"
  value={name}
  onValueChange={setName}
  required
  maxLength={120}
  showCounter
/>
```

## 4. Пример: Formik (без изменения бизнес-логики)

```jsx
<TextField
  name="email"
  type="email"
  label={t("common.email")}
  value={formik.values.email}
  onChange={(value, event) => formik.handleChange(event)}
  onBlur={formik.handleBlur}
  error={formik.touched.email && formik.errors.email}
/>
```

`onChange` отдаёт `(value, event)` — `formik.handleChange(event)` продолжает работать,
`touched`/`errors`/`validation` Formik не ломаются.

## 5. Пример: SelectField

```jsx
// string-модель (по умолчанию) — совместимо с ThemedSelect
<SelectField
  label="Статус"
  value={status}                 // string
  onValueChange={setStatus}
  options={[
    { value: "new", label: "Новый" },
    { value: "done", label: "Завершён" },
  ]}
  placeholder="Выберите статус"
  clearable
/>

// number-модель — наружу уходит number | null (только явно)
<SelectField
  label="Приоритет"
  value={priorityId}             // number | null
  valueType="number"
  onValueChange={setPriorityId}  // получит number или null
  options={priorityOptions}
/>
```

`SelectField` — обёртка над `components/inputs/RadixSelect`. Сам RadixSelect не переписан;
string-based модель сохранена. `valueType="number"` коэрсит значение **только на выходе**.

## 6. Пример: NumberField (`emitAs`)

```jsx
// emitAs="string" (default) — payload остаётся строковым (безопасно)
<NumberField
  label="Количество"
  value={qty}                    // "" | "5"
  onValueChange={setQty}         // получит "" или "5"
/>

// emitAs="number" — наружу number | null
<NumberField
  label="Цена"
  value={price}                  // number | null
  emitAs="number"
  step="0.01"
  min={0}
  onValueChange={setPrice}       // получит number или null (пусто → null)
/>
```

Правила: пустое значение **не превращается в 0** (`""` либо `null`); `NaN` наружу не уходит.

## 7. Пример: AutocompleteField (wrapper)

```jsx
<AutocompleteField
  label="Контрагент"
  value={selected}               // { id, name } | null
  inputValue={query}
  onInputChange={setQuery}
  options={options}              // [{ id, name, secondary }]
  onSelect={(opt) => setSelected(opt)}
  onValueChange={(val) => setSelectedId(val)}  // val = id выбранной опции | null
  loading={isFetching}
  clearable
  // нативные возможности AutocompleteSelect пробрасываются как есть:
  showCreateAction={canCreate}
  createActionLabel={`Создать «${query}»`}
  onCreateOption={handleCreate}  // → нативный onCreateAction
  canEditOption={(o) => true}
  onEditOption={handleEdit}
  canDeleteOption={(o) => true}
  onDeleteOption={handleDelete}
/>
```

`AutocompleteField` **не меняет** `components/shared/AutocompleteSelect`: портал,
позиционирование, create/edit/delete actions и UX остаются прежними. Обёртка лишь
подключает его к `FieldShell` и единому API; алиасы `getOptionLabel/getOptionValue`
маппятся на нативные `getOptionPrimary/getOptionKey`, `onCreateOption` → `onCreateAction`.
Все прочие нативные props идут через `...rest`.

## 8. Правила

- **Новые формы** используют только `components/ui/fields`.
- **Старые формы** мигрируются отдельными фазами (см.
  `docs/audits/client/FORM_FIELDS_STANDARDIZATION_PLAN.md`). В Phase 1 ничего не мигрировано.
- **Не менять тип payload** (`string` ↔ `number`, дата-строки, boolean) без явного решения.
  По умолчанию `SelectField`=string, `NumberField`=string — payload не меняется.
- Не использовать `!important` и не хардкодить цвета — только токены из
  `styles/theme.css` / `styles/forms.css`.
- `value === undefined/null` всегда безопасно (поля не становятся uncontrolled).

## Phase 1B (планируемые поля)

Строятся поверх `FieldShell` + те же хелперы: `PasswordField`, `EmailField`, `PhoneField`,
`DateField`, `TimeField`, `DateTimeField`, `CurrencyField`, `PercentField`, `FileField`,
`CountryField`, `FormActions`.
