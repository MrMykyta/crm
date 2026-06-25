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
| `DatePickerField` | Custom date picker поверх `DateTimePicker`; поддерживает `min`/`max`/`isDateDisabled` |
| `TimePickerField` | Custom time picker без native `input type="time"` |
| `DateField` | Back-compat alias для `DatePickerField` (date-only) |
| `TimeField` | Back-compat alias для `TimePickerField` |
| `DateTimeField` | Back-compat alias для `DatePickerField` с `withTime` |
| `FileField` | Неконтролируемый file input |
| `CountryField` | SelectField на `utils/countries.js` (ISO2) |
| `FormActions` | Блок кнопок формы (submit/cancel) |

Компоненты Phase 3B.0 prerequisites:

| Компонент | Назначение |
|---|---|
| `MultiSelectField` | Обёртка над `MultiSelectDropdown`; multi=`string[]`, single=`string` |
| `FieldShell float` | Opt-in floating label mode для будущей миграции SmartForm |

Компоненты Phase 3D:

| Компонент | Назначение |
|---|---|
| `RadioGroupField` | Grouped native radio field; value=`string`, vertical/horizontal layout |

Компоненты Phase 4B.0 prerequisites:

| Компонент | Назначение |
|---|---|
| `PriorityField` | Обёртка над `PriorityInput`; сохраняет value model существующего primitive |
| `SearchField` | `TextField type="search"` preset без встроенного debounce |

Компоненты Phase 5B.0 specialized wrappers:

| Компонент | Назначение |
|---|---|
| `SliderField` | Native `input type="range"`; emits raw string |
| `ColorField` | Native `input type="color"`; value is hex string |
| `HtmlEditorField` | Wrapper over existing `HTMLEditor`; value is HTML string |
| `ImageField` | Wrapper over existing `ImagePicker`; value is URL string |

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
leftIcon, rightIcon, loading, float, isFilled, isFocused
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

// disabled option — видим в списке, но не эмитит значение при выборе
<SelectField
  label="Тип"
  value={docType}
  onValueChange={setDocType}
  options={[
    { value: "", label: "Все типы" },
    { value: "PZ", label: "PZ" },
    { value: "MM", label: "MM", disabled: true },
  ]}
/>
```

`SelectField` — обёртка над `components/inputs/RadixSelect`. Сам RadixSelect не переписан;
string-based модель сохранена. `valueType="number"` коэрсит значение **только на выходе**.
`options[].disabled` поддержан на уровне wrapper: disabled options остаются видимыми, но выбор
такого значения не вызывает `onValueChange`/`onChange`. Existing options без `disabled` работают как раньше.

## 6. Пример: RadioGroupField

```jsx
<RadioGroupField
  name="visibility"
  label="Видимость"
  value={visibility}             // string
  options={[
    { value: "private", label: "Приватно" },
    { value: "team", label: "Команда", description: "Доступно участникам" },
  ]}
  onValueChange={setVisibility}
/>

<RadioGroupField
  name="density"
  label="Плотность"
  value={density}
  options={densityOptions}
  layout="horizontal"
/>
```

`RadioGroupField` использует native `<input type="radio">` внутри `FieldShell`.
Все radio в группе получают общий stable `name`. Значение всегда строковое, без number coercion;
`undefined` наружу не эмитится. `disabled`/`readOnly` блокируют изменение, option-level
`disabled` блокирует конкретный вариант. `float` принимается для API parity, но визуально no-op.

## 7. Пример: SearchField

```jsx
<SearchField
  name="query"
  label="Поиск"
  value={query}
  onValueChange={setQuery}
  placeholder="Найти..."
  clearable
/>
```

`SearchField` — preset поверх `TextField type="search"`. Значение всегда строка.
Clear button вызывает `onValueChange("")`, `onChange("", null)` и `onClear?.()`.
Встроенного debounce нет: debounce/query-param поведение остаётся на уровне потребителя.

## 8. Пример: PriorityField

```jsx
<PriorityField
  name="priority"
  label="Приоритет"
  value={priority}
  onValueChange={setPriority}
  min={0}
  max={100}
/>
```

`PriorityField` — тонкая обёртка над существующим `components/inputs/PriorityInput`.
`PriorityInput` и `NumericWithPresets` не переписываются. Value model сохраняется как у primitive:
wrapper не делает string/number coercion без необходимости и не эмитит `undefined`.

## 9. Пример: MultiSelectField

```jsx
// multi mode — наружу всегда string[]
<MultiSelectField
  label="Исполнители"
  value={assigneeIds}           // string[]
  options={userOptions}
  onValueChange={setAssigneeIds}
  placeholder="Выберите пользователей"
  maxPreview={2}
  clearable
/>

// single + filterable — наружу всегда string
<MultiSelectField
  label="Контакт"
  value={contactId}             // string
  options={contactOptions}
  single
  filterable
  onValueChange={setContactId}  // получит arr[0] || ""
  placeholder="Найти контакт"
/>
```

`MultiSelectField` — тонкая обёртка над `components/inputs/MultiSelectDropdown`.
Сам dropdown не переписан: portal/menu/filter/select-all UX остаются прежними. Модель значений
сохраняется строго строковой: multi → `string[]`, single → `string`. Компонент никогда не
коэрсит string IDs в numbers и не эмитит `undefined`.

## 10. Пример: NumberField (`emitAs`)

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

## 11. Пример: AutocompleteField (wrapper)

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

## 11B. FieldShell float mode

`FieldShell` поддерживает opt-in floating label mode для будущей миграции SmartForm:

```jsx
<TextField
  label="Название"
  value={name}
  onValueChange={setName}
  float
/>
```

Правила:
- `float={false}` по умолчанию — все существующие формы остаются с обычным top-label.
- `float` рендерит label внутри control wrapper и поднимает его при `focus-within`,
  `isFocused` или `isFilled`.
- `isFilled` можно передать явно; стандартные поля вычисляют его безопасно из value
  (`""`/`null`/`undefined` = empty, массив с length > 0 = filled).
- Это prerequisite для SmartForm migration. Сам SmartForm в Phase 3B.0 не мигрируется.

## 11C. Phase 1B компоненты

### PasswordField

```jsx
<PasswordField
  name="password"
  label={t("common.password")}
  value={pwd}
  onValueChange={setPwd}
  autoComplete="current-password"   // 'new-password' для регистрации
  required
/>
```
Кнопка show/hide переключает `type` password↔text (иконки из `lucide-react`,
новых зависимостей не добавлялось). dual-mode onChange наследуется от TextField.

### EmailField

```jsx
<EmailField
  name="email"
  label={t("common.email")}
  value={formik.values.email}
  onChange={(value, event) => formik.handleChange(event)}
  onBlur={formik.handleBlur}
  error={formik.touched.email && formik.errors.email}
/>
```
type/inputMode/autoComplete = email. Внутри **не валидирует** — валидация снаружи.
(`PhoneField` — type="tel", `UrlField` — type="url"; оба без внутренней валидации и без масок.)

### CurrencyField

```jsx
// emitAs="string" по умолчанию — payload остаётся строкой, без округления
<CurrencyField
  label="Сумма"
  currency="PLN"               // показывается как prefix
  value={amount}               // "" | "1234.5"
  onValueChange={setAmount}
/>

// с явным precision — округление ТОЛЬКО на blur
<CurrencyField
  label="Цена"
  suffix="€"
  precision={2}
  emitAs="number"              // наружу number | null
  value={price}
  onValueChange={setPrice}
/>
```
Пустое значение не превращается в 0. Без `precision` принудительного округления нет.

### PercentField

```jsx
<PercentField
  label="Скидка"
  value={discount}             // "" | "10"
  onValueChange={setDiscount}
  // min=0 / max=100 по умолчанию (переопределяемо), suffix="%"
/>
```

### DateField / DateTimeField

```jsx
// date-only — наружу local-naive строка "YYYY-MM-DD"
<DateField
  label="Дата"
  value={date}                 // "2026-06-22"
  onValueChange={setDate}      // получит ту же строку
/>

// дата+время — local-naive "YYYY-MM-DDTHH:mm", опциональный тогл времени
<DateTimeField
  label="Когда"
  value={dt}                   // "2026-06-22T14:30"
  onValueChange={setDt}
  allowTimeToggle
  onWithTimeChange={setHasTime}
/>
```
Обёртки над `components/inputs/DateTimePicker` (не переписан). **Никаких Date objects
и timezone-конвертаций** — наружу уходит та же строка, что и сейчас. Событие отсутствует
→ `onChange(value, null)`.

### TimeField

```jsx
<TimeField
  label="Время"
  value={time}                 // "09:30"
  onValueChange={setTime}      // dual-mode: onChange(value, event) тоже доступен
/>
```

### FileField

```jsx
<FileField
  label="Документы"
  accept=".pdf,.png"
  multiple
  onFilesChange={(files, event) => handleUpload(files)}
/>
```
file input **не контролируется** (`value` не задаётся — требование браузера). Выбор
приходит как `FileList` в `onFilesChange(files, event)` / `onValueChange(files)` /
`onChange(files, event)`. Существующий `ImagePicker` не переписывался; `ImageField` оборачивает его отдельно
и сохраняет URL-string model.

### CountryField

```jsx
<CountryField
  label="Страна"
  language={i18n.language}     // влияет только на labels
  value={countryCode}          // ISO2-строка, напр. "PL"
  onValueChange={setCountryCode}
  placeholder="Выберите страну"
/>
```
Источник — `utils/countries.js` (`getCountryOptions(language) → [{code,label}]`),
`code` → `value`. Значение хранится как ISO2-строка; labels/i18n не меняются.

### FormActions

```jsx
<form onSubmit={handleSubmit}>
  {/* поля формы */}
  <FormActions
    submitLabel={t("common.save")}
    submittingLabel={t("common.saving")}
    cancelLabel={t("common.cancel")}
    onCancel={handleCancel}
    isSubmitting={isSubmitting}
    align="right"               // 'left' | 'right' | 'space-between'
  />
</form>
```
Submit-кнопка `type="submit"` использует глобальный класс `.btn--primary`
(из `styles/forms.css`). Отдельный общий Button-компонент **не создавался**.

## 8. Правила

- **Новые формы** используют только `components/ui/fields`.
- **Старые формы** мигрируются отдельными фазами (см.
  `docs/audits/client/FORM_FIELDS_STANDARDIZATION_PLAN.md`). В Phase 1 ничего не мигрировано.
- **Не менять тип payload** (`string` ↔ `number`, дата-строки, boolean) без явного решения.
  По умолчанию `SelectField`=string, `NumberField`=string — payload не меняется.
- Не использовать `!important` и не хардкодить цвета — только токены из
  `styles/theme.css` / `styles/forms.css`.
- `value === undefined/null` всегда безопасно (поля не становятся uncontrolled).

## Phase 2A — migrated auth forms

Первая реальная миграция форм на библиотеку. Переведены **только** auth/company setup формы;
Formik / Yup / submit handlers / API / navigation / i18n сохранены 1:1.

Переведённые формы:

| Форма | Файл | Что заменено |
|---|---|---|
| Sign In | `components/auth/SignIn/index.js` | email→`EmailField`, password→`PasswordField` |
| Sign Up | `components/auth/SignUp/index.js` | name/lastName→`TextField`, email→`EmailField`, password→`PasswordField` |
| Company Setup | `components/company/CompanySetup/index.js` | text→`TextField`, country→`SelectField` (те же 5 опций + i18n, **не** `CountryField`) |
| Invite Accept | `pages/auth/InviteAcceptPage/index.js` | name→`TextField`, password/confirm→`TextField` (dynamic type), shared toggle→`CheckboxField` |
| Reset Password | `pages/auth/ResetPasswordPage/index.js` | password/confirm→`PasswordField` |

Используемый Formik-паттерн (dual-mode onChange — event пробрасывается в Formik):

```jsx
// через useField (SignIn/SignUp/Reset/CompanySetup)
const [field, meta] = useField(name);
<EmailField
  name={name}
  value={field.value}
  onChange={(value, event) => field.onChange(event)}  // event → Formik handleChange
  onBlur={field.onBlur}
  error={meta.touched && meta.error ? meta.error : undefined}
/>

// через render-prop (InviteAccept)
<TextField
  name="firstName"
  value={values.firstName}
  onChange={(value, event) => handleChange(event)}
  onBlur={handleBlur}
  error={touched.firstName && errors.firstName ? errors.firstName : undefined}
/>
```

Заметки:
- **Floating-label (formGlass) → стандартный top-label.** На момент Phase 2A float mode ещё не был
  доступен; заменён только control. Layout-классы formGlass (`.form`, `.btn`, `.link`, footer) и
  страничные стили (`AuthPage`, `InviteAccept`) сохранены. Это визуальное изменение лейблов, не редизайн логики.
- `FormActions` в auth **не применялся** — кнопки используют специфичные классы (`formGlass .btn`,
  `InviteAccept .primary` + router `<Link>`), замена изменила бы UX. Оставлено как есть.
- **InviteAccept**: общий тогл «Показать пароль» сохранён (→ `CheckboxField`), поэтому пароли —
  `TextField` с динамическим `type`, а не `PasswordField` (у того собственный per-field eye).
- Не тронуты: **UserSettings, SmartForm, WMS/OMS/CRM/PIM, server/API/migrations**.

## Phase 2B — migrated UserSettings forms

Переведены **только** UserSettings секции. Formik / Yup / initialValues / submit handlers /
payload shape / API calls / i18n keys сохранены 1:1.

Переведённые секции:

| Секция | Файл | Что заменено |
|---|---|---|
| Profile | `pages/users/UserSettingsPage/sections/ProfileForm/index.js` | firstName/lastName→`TextField`, email→`EmailField` |
| Security | `pages/users/UserSettingsPage/sections/SecurityForm/index.js` | current/next/confirm password→`PasswordField` |
| Preferences | `pages/users/UserSettingsPage/sections/PreferencesForm/index.js` | language/theme selects→`SelectField` |
| Appearance | `pages/users/UserSettingsPage/sections/AppearanceForm/index.js` | textSize/density/skin selects→`SelectField`, urlDraft→`TextField`, background upload→`FileField` |
| Notifications | `pages/users/UserSettingsPage/sections/NotificationsForm/index.js` | email/push checkboxes→`CheckboxField` |

Заметки:
- `FormActions` в UserSettings **не применялся** — существующие кнопки используют локальные классы
  `UserSettingsPage.module.css`, замена могла изменить layout/UX.
- `AppearanceForm` `input type="range"` для `fontScale` оставлен без миграции: в библиотеке нет
  разрешённого slider/range field-компонента для этой фазы.
- Не тронуты: **SmartForm, Auth, WMS/OMS/CRM/PIM, components/inputs, components/shared,
  server/API/migrations/routes/ACL**.

## Phase 3B.1 SmartForm low-risk branches

Первая внутренняя миграция SmartForm renderer. Внешний API SmartForm не менялся:
`SmartForm({ values, errors = {}, onChange, schema, i18n, className = "", variant = "" })`.
Внутренний `set(name, value)` остаётся единственным путём изменения значений, поэтому `upper`,
`max` slice, dependent date logic и `onChange(name, value)` contract сохранены.

Мигрировано внутри `components/forms/SmartForm/index.js`:

| Branch | Target field | Value type |
|---|---|---|
| default/text | `TextField` | `string` |
| textarea | `TextareaField` | `string` |
| checkbox | `CheckboxField` | `boolean` |
| dropdown-select / select без `multiple` | `SelectField` | `string` |

Не мигрировано в Phase 3B.1:
- `autocomplete-select`
- `date`, `datetime`, `date-or-datetime`
- `multiselect`, `dropdown-multiselect`, `dropdown-select-search`, `select` + `multiple`
- `ContactsEditor`

Заметки:
- Numeric-looking SmartForm fields (`inputMode: "decimal"|"numeric"`) остаются `TextField` и
  продолжают храниться как строки; `NumberField`/`CurrencyField` не используются.
- Counters для migrated text/textarea показываются через field shell, но native `maxLength` не включается:
  фактическое truncation по-прежнему делает SmartForm `set()`.
- `float={!!f.float}` передаётся только в migrated branches; high-risk branches сохраняют старый renderer.

## Phase 3B.2 SmartForm date branches

Вторая внутренняя миграция SmartForm renderer. Внешний API SmartForm и `set(name, value)` contract
не менялись.

Мигрировано внутри `components/forms/SmartForm/index.js`:

| Branch | Target field | Value type |
|---|---|---|
| date | `DateField` | local-naive `YYYY-MM-DD` string |
| datetime | `DateTimeField` | local-naive `YYYY-MM-DDTHH:mm` string |
| date-or-datetime | `DateTimeField` | local-naive string + existing `hasTimeField` boolean |

Заметки:
- `date-or-datetime` сохраняет SmartForm-side `handleWithTimeToggle`: запись `hasTimeField`,
  append `T00:00` при включении времени и `slice(0, 10)` при выключении времени.
- Date values не превращаются в `Date` objects и не проходят timezone conversion.
- Не мигрированы: `autocomplete-select` и multiselect family.

## Phase 3B.3 SmartForm autocomplete branch migrated

Третья внутренняя миграция SmartForm renderer. Мигрирован только branch
`type === "autocomplete-select"` на `AutocompleteField`.

Сохранено:
- SmartForm value остаётся string id.
- Query/display state остаётся в SmartForm (`autocompleteQueries`).
- `set(f.name, value)` остаётся единственным путём записи выбранного id.
- Existing create/edit/delete/clear handlers, local errors, loading state, `onSearchChange`,
  selected-actions/ref-menu behavior и options normalization остаются в SmartForm branch.
- Error text теперь выводится через `AutocompleteField`/`FieldShell`, без дублирующего `s.err`.

Не мигрировано:
- multiselect family (`multiselect`, `dropdown-multiselect`, `dropdown-select-search`, `select + multiple`)
- `ContactsEditor`

## Phase 3B.4 SmartForm multiselect branches migrated

Четвёртая внутренняя миграция SmartForm renderer. Мигрированы последние SmartForm multiselect branches
на `MultiSelectField`.

Мигрировано внутри `components/forms/SmartForm/index.js`:

| Branch | Target field | Value type |
|---|---|---|
| dropdown-multiselect | `MultiSelectField` | `string[]` |
| multiselect | `MultiSelectField` | `string[]` |
| dropdown-select-search | `MultiSelectField` single mode | `string` |
| select + multiple | `MultiSelectField` | `string[]` |

Сохранено:
- `normalizeOptions(f)` и dynamic `options(values)` остаются в SmartForm branch.
- Multi branches fallback к `[]`, single branch fallback к `""`; `undefined` наружу не эмитится.
- IDs остаются строками, без number coercion.
- `dropdown-select-search` остаётся single-string поверх внутреннего массива.
- `onOpenChange`, `maxPreview`, `selectAllLabel`, `clearLabel`, `filterable`, helper/error/counter и
  `float={!!f.float}` сохранены через wrapper.
- `components/inputs/MultiSelectDropdown` не переписан и не изменён.

SmartForm branch migration завершена. За пределами SmartForm остаются `ContactsEditor` и отдельные
specialized areas.

## Phase 3D RadioGroupField + ContactsEditor migrated

Добавлен `RadioGroupField` в `components/ui/fields`: native radio group поверх `FieldShell`,
string value model, без number coercion и без `undefined` emit.

`ContactsEditor` мигрирован на `ui/fields`:

| Control | Target |
|---|---|
| channel `ThemedSelect` | `SelectField` |
| contact value raw input | `TextField` |
| primary row radio | native row-level radio, unique per editor instance `name` |

Сохранено:
- `ContactsEditor({ value = [], onChange })`
- `onChange(nextArray)`
- value shape `{ channel, value, isPrimary }`
- `CHANNELS`, add/update/delete/setPrimary logic and all i18n keys
- deleting primary row does not auto-reassign primary

## Phase 4B.0 PriorityField + SearchField prerequisites

Добавлены prerequisite field-компоненты для следующей Task/System миграции:

| Component | Status |
|---|---|
| `PriorityField` | added; wraps existing `PriorityInput` |
| `SearchField` | added; `TextField type="search"` preset |

Сохранено:
- `PriorityField` не меняет `PriorityInput`/`NumericWithPresets` и сохраняет их текущий value model.
- `SearchField` не содержит debounce по умолчанию; debounce остаётся на уровне потребителя.
- Страницы Task/System/CRM/PIM/WMS/OMS не мигрировались в Phase 4B.0.

## Phase 4B.1 safe System/Shared migrations

Мигрированы только безопасные standalone/list/filter controls на `components/ui/fields`.

| File | Migrated controls |
|---|---|
| `components/workspace/index.js` | saved-view selects → `SelectField`, view-name input → `TextField` |
| `pages/system/NotificationsPage/index.js` | notification type filter select → `SelectField` |
| `components/common/WorkspaceViews/WorkspaceViewEditor.jsx` | view-name input → `TextField` |
| `components/common/WorkspaceViews/WorkspaceViewPicker.jsx` | dropdown search input → `SearchField` |
| `components/common/WorkspaceViews/WorkspaceViewsDrawer.jsx` | inline rename input → `TextField` |
| `pages/CRM/Deal/DealsListPage/index.js` | simple text/select controls → `TextField`/`SelectField`, counterparty picker → `AutocompleteField` |

Сохранено:
- debounce остаётся в потребителях (`Workspace filter controls`, picker touch debounce, deal counterparty lookup debounce).
- query/local state update callbacks не перенесены внутрь field components.
- option values остаются строковыми; empty/all option semantics сохранены.
- `DealsListPage` textarea/date/number controls оставлены без миграции в этой фазе, потому что `TextareaField`,
  `DateField` и `NumberField` не входят в разрешённый target set Phase 4B.1.

## Phase 4B.2 CreateTaskModal migrated

`components/dialogs/CreateTaskModal/index.js` мигрирован на `components/ui/fields` без изменения state/payload logic.

| Control | Target |
|---|---|
| title raw input | `TextField` |
| description raw textarea | `TextareaField` |
| priority/status `ThemedSelect` | `SelectField` |
| dueDate date-only `DateTimePicker` | `DateField` |
| assigneeId/counterpartyId/dealId raw inputs | `TextField` |
| isAllDay raw checkbox | `CheckboxField` |
| eventDate date-only `DateTimePicker` | `DateField` |
| startAt/endAt timed `DateTimePicker` | `DateTimeField` |

Сохранено:
- local state shape и submit payload assembly остаются в `CreateTaskModal`.
- `dueDate`/`eventDate` продолжают писаться как date-only local strings.
- `startAt`/`endAt` продолжают писаться field-level local-naive strings через существующий `DateTimePicker` wrapper;
  существующая submit-конвертация в payload не менялась.
- `SearchField` debounce policy не затрагивался; debounce по-прежнему не добавляется внутрь field components.

## Phase 4B.3 NotesPage migrated

`pages/system/NotesPage/index.js` мигрирован на `components/ui/fields` без изменения filters/editor/API logic.

| Control | Target |
|---|---|
| note owner type / visibility `ThemedSelect` | `SelectField` |
| toolbar owner type `ThemedSelect` | `SelectField` |
| note owner and toolbar owner `AutocompleteSelect` | `AutocompleteField` |
| pinned raw checkbox | `CheckboxField` |
| note content and quick-edit raw textarea | `TextareaField` |

Сохранено:
- owner/query state остаётся в `NotesPage`: `ownerSearch`, `ownerSearchDebounced`,
  `toolbarOwnerSearch`, `toolbarOwnerSearchDebounced`, selected owner objects.
- существующий 320ms debounce для owner lookup и 400ms `Workspace filter controls` search config не переносились в fields.
- owner autocomplete продолжает писать выбранный id в `ownerId`/query, а selected object остаётся отдельным state.
- create/update/quick-edit payload assembly и API calls не менялись.
- `Workspace filter controls` internals и встроенные `type: "search"` / `type: "select"` controls не мигрировались в этой фазе.

## Phase 4B.4 EventModal migrated

`pages/system/CalendarPage/components/EventModal.js` мигрирован на `components/ui/fields` без изменения
calendar event state/payload behavior.

| Control | Target |
|---|---|
| title/location raw text inputs | `TextField` |
| all-day raw checkbox | `CheckboxField` |
| start/end raw `type="time"` inputs | `TimeField` |

Сохранено:
- local state shape остаётся: `title`, `location`, `allDay`, `start`, `end`, `color`.
- `start`/`end` продолжают храниться как `HH:mm` strings.
- `handleSave` payload assembly не менялся и продолжает передавать `{ ...event, title, location, allDay, start, end, color }`.
- date display остаётся read-only text; новых `Date` conversions для editable fields не добавлялось.
- color buttons, header/footer/buttons и portal/click-outside/Escape behavior не менялись.

## Phase 4B.6A TaskForm simple controls migrated

`pages/system/TaskPage/TaskForm/index.js` частично мигрирован: только simple controls, без date/multiselect/
autocomplete веток.

| Control | Target |
|---|---|
| title raw input | `TextField` |
| description raw textarea | `TextareaField` |
| category raw input | `TextField` |
| status `ThemedSelect` | `SelectField` |
| priority `PriorityInput` | `PriorityField` |
| statusAggregate raw checkbox | `CheckboxField` |

Сохранено:
- existing `set(name, value)`, `toApiTask(values)`, `toBaseValues`, state shape и payload shape не менялись.
- ручные `st.field`/`st.spanN` wrappers, labels, counters, buttons/footer/layout сохранены.
- `maxLength` остаётся на title/description/category; counters остаются ручными.
- `priority` продолжает приходить из `PriorityField`/`PriorityInput` без coercion.
- `status` остаётся string, `statusAggregate` остаётся boolean.
- date fields, assignees/watchers multiselects и counterparty/contacts autocompletes не мигрировались в этой фазе.

## Phase 4B.6B TaskForm date fields migrated

`pages/system/TaskPage/TaskForm/index.js` продолжил частичную миграцию: только date fields внутри
`renderDateField(...)`.

| Control | Target |
|---|---|
| startAt `DateTimePicker` | `DateTimeField` |
| endAt `DateTimePicker` | `DateTimeField` |
| actualStartAt `DateTimePicker` | `DateTimeField` |
| actualEndAt `DateTimePicker` | `DateTimeField` |

Сохранено:
- `renderDateField(...)` wrapper, manual labels, `st.field`/`st.span6` layout и placeholders сохранены.
- local-naive string state остаётся: date-only `YYYY-MM-DD`, timed `YYYY-MM-DDTHH:mm`.
- paired hasTime booleans остаются: `plannedStartHasTime`, `plannedEndHasTime`,
  `actualStartHasTime`, `actualEndHasTime`.
- existing `handleWithTimeToggle` logic сохранена: append `T00:00` при включении времени,
  `slice(0, 10)` при выключении.
- `toApiTask(values)`/`toApiDateValue` не менялись; новых `Date` objects/timezone conversions в control layer нет.
- assignees/watchers multiselects и counterparty/contacts autocompletes не мигрировались в этой фазе.

## Phase 4B.6C TaskForm multiselects migrated

`pages/system/TaskPage/TaskForm/index.js` продолжил частичную миграцию: только assignees/watchers multiselects.

| Control | Target |
|---|---|
| assigneeIds `MultiSelectDropdown` | `MultiSelectField` |
| watcherIds `MultiSelectDropdown` | `MultiSelectField` |

Сохранено:
- `assigneeIds` и `watcherIds` остаются arrays; фактическая current emitted model остаётся `string[]`,
  как у прежнего `MultiSelectDropdown` (`String(o.value)` / `Array.from(set)`).
- `set("assigneeIds", next)` и `set("watcherIds", next)` остаются единственным путем записи.
- `watcherOptions` logic остаётся в TaskForm без изменений: исключает selected assignees и current user/self.
- options values, placeholders/i18n, manual labels, `st.field`/`st.span6` layout сохранены.
- `toApiTask(values)`, participantMode/watcherMode payload logic и payload converters не менялись.
- counterparty/contacts autocompletes не мигрировались в этой фазе.

## Phase 4B.6D TaskForm autocomplete controls migrated

`pages/system/TaskPage/TaskForm/index.js` завершил TaskForm control migration: только counterparty/contacts
autocomplete controls.

| Control | Target |
|---|---|
| counterparty picker `AutocompleteSelect` | `AutocompleteField` |
| contacts add-picker `AutocompleteSelect` | `AutocompleteField` |

Сохранено:
- `counterpartySearch`, `counterpartySearchDebounced`, `selectedCounterparty`, `contactSearch`,
  `contactSearchDebounced` и `selectedContacts` остаются в TaskForm без изменения state shape.
- RTK queries `useGetCounterpartyLookupQuery` и `useGetContactsQuery`, debounce delays, options normalization,
  loading flags, hints/searching/empty labels и `opaque` behavior сохранены.
- counterparty select продолжает писать `counterpartyId` как string и `counterpartyName`; edit-away clear
  продолжает сбрасывать selected counterparty/id/name.
- changing counterparty продолжает очищать `selectedContacts` и `contactIds`.
- contacts add-picker остаётся `value={null}`, добавляет deduped string id в `contactIds`, очищает search,
  а chips render/remove остаются снаружи поля без изменений.
- `toApiTask(values)`, payload converters, schemas/API/server, `TaskForm.module.css` и уже мигрированные
  simple/date/multiselect controls не менялись.

## Phase 4C.1 Workspace filter controls migrated

`components/filters/Workspace filter controls/index.js` мигрирован внутри shared toolbar only.

| Control | Target |
|---|---|
| search raw input | `SearchField` |
| select/mode `ThemedSelect` | `SelectField` |

Сохранено:
- external `Workspace filter controls` props, `controls` schema API, query shape и query keys не менялись.
- search debounce остаётся внутри Workspace filter controls: `searchCfg.debounce || 400`, local `search` state и timer сохранены.
- `SearchField` не получает debounce и не включает новый clear button behavior.
- search/select changes продолжают вызывать `onChange((q) => ({ ...q, [key]: value || undefined, page: 1 }))`
  через существующие helper paths.
- `emptyAsUndefined` behavior остаётся в `handleSelect(...)`; mode select продолжает вызывать `onModeChange`
  со string value.
- `custom` controls и все Workspace filter controls consumers не менялись.

## Phase 4C.2 Workspace/WorkspaceViews controls migrated

Shared column/saved-view controls migrated without changing data-filter query behavior.

| File | Controls |
|---|---|
| `components/common/WorkspaceViews/WorkspaceViewEditor.jsx` | description raw textarea → `TextareaField` |

Already migrated before this phase and verified, not duplicated:
- `components/workspace/Workspace.js` saved-view selects/name field use `SelectField`/`TextField`.
- `components/workspace/Workspace column menu.js` uses inline WMS-style check controls and does not depend on the old modal column editor.
- `components/common/WorkspaceViews/WorkspaceViewPicker.jsx` dropdown search uses `SearchField`.
- `components/common/WorkspaceViews/WorkspaceViewsDrawer.jsx` rename input uses `TextField`.

Сохранено:
- Workspace saved-view behavior remains in `Workspace.js`.
- column visibility/reset behavior is handled by `Workspace column menu`.
- Workspace view create/edit/rename/delete/apply callbacks, selected view ids, local state, and persistence payloads
  are unchanged.
- no debounce was added; Workspace filter controls, DataTable, page consumers, query/filter schema API, components/inputs,
  components/shared, server/API/migrations were not changed.

## Phase 4C.3 DealsListPage filters migrated

`pages/CRM/Deal/DealsListPage/index.js` page-specific remaining controls migrated.

| Control | Target |
|---|---|
| deal amount raw number input | `NumberField emitAs="string"` |
| deal description raw textarea | `TextareaField` |
| date range raw date inputs (`dateFrom`, `dateTo`) | `DateField` |

Already migrated before this phase and left unchanged:
- title/currency fields use `TextField`.
- owner/status selects use `SelectField`.
- counterparty picker uses `AutocompleteField`.

Сохранено:
- date range values remain date-only `YYYY-MM-DD` strings and still write `dateFrom`/`dateTo` query keys.
- clearing date range values still writes `undefined` and resets `page: 1` through the existing updater.
- amount value remains a string in local form state; empty string is not converted to `0`.
- description remains a string; create payload assembly remains unchanged.
- Workspace filter controls, Workspace, WorkspaceViews, DataTable, page consumers, schemas, components/inputs,
  components/shared, server/API/migrations were not changed.

## Phase 4C.4 ProductsPage filters migrated

`pages/PIM/Product/ProductsPage/index.js` page-specific controls migrated.

| Control | Target |
|---|---|
| product create name raw input | `TextField` |
| product create category `AutocompleteSelect` | `AutocompleteField` |
| product create brand `AutocompleteSelect` | `AutocompleteField` |
| product create SKU raw input | `TextField` |

Сохранено:
- category/brand search state, debounced search state, selected object derivation, lookup hooks
  `useListCategoriesLookupQuery` / `useListBrandsLookupQuery`, options normalization, loading state,
  empty/searching labels, and create-option actions are unchanged.
- category/brand edit-away clear behavior remains: edited text clears `primaryCategoryId` / `brandId`.
- selecting existing category/brand still writes `String(opt.id)`; create-action paths still use the existing
  created id behavior.
- Workspace filter controls query filters, categoryId/brandId filter option values, page reset behavior, API calls, schemas,
  components/inputs, components/shared, server/API/migrations were not changed.

## Phase 4C.5A WMS report select filters migrated

WMS report select filters migrated to `SelectField` in:

| File | Filters |
|---|---|
| `pages/wms/StockAsOfReportPage/index.js` | `warehouseId`, `groupBy` |
| `pages/wms/StockValuationReportPage/index.js` | `warehouseId`, `groupBy` |
| `pages/wms/InventoryLedgerReportPage/index.js` | `warehouseId` |
| `pages/wms/StockTurnoverReportPage/index.js` | `warehouseId`, `groupBy` |

Сохранено:
- values remain strings; empty option values remain `""`.
- existing `queryArgs` continue to convert empty strings with `field || undefined`.
- `updateFilter`, `filters` state shape, `skip` validation, and report RTK hooks are unchanged.
- date/asOf inputs, product/variant selects, product search inputs, and currency text inputs were not migrated
  in this phase.

## Phase 4C.5B WMS report date filters migrated

WMS report date/datetime filters migrated to `DateField` / `DateTimeField` in:

| File | Filters | Target |
|---|---|---|
| `pages/wms/StockAsOfReportPage/index.js` | `asOf` | `DateTimeField` |
| `pages/wms/InventoryLedgerReportPage/index.js` | `dateFrom`, `dateTo` | `DateField` |
| `pages/wms/StockTurnoverReportPage/index.js` | `dateFrom`, `dateTo` | `DateField` |

Сохранено:
- `asOf` remains the existing local-naive datetime string seeded by `currentLocalDateTime()`.
- `dateFrom` / `dateTo` remain date-only `YYYY-MM-DD` strings.
- existing `queryArgs` continue to convert empty strings with `field || undefined`.
- validation/`skip`, report RTK hooks, select filters, currency text inputs, product/variant selects,
  and editor/document controls are unchanged.
- `StockValuationReportPage` has only a disabled read-only "Coming soon" as-of display, not a migrated
  date/datetime report filter.

## Phase 4C.5C WMS report remaining filters migrated

Remaining WMS report text/product/variant filters migrated in:

| File | Filters | Target |
|---|---|---|
| `pages/wms/StockAsOfReportPage/index.js` | `productSearch`, `productId`, `currency` | `SearchField`, `SelectField`, `TextField` |
| `pages/wms/StockValuationReportPage/index.js` | `productSearch`, `productId`, `currency` | `SearchField`, `SelectField`, `TextField` |
| `pages/wms/InventoryLedgerReportPage/index.js` | `productSearch`, `productId`, `variantId`, `currency` | `SearchField`, `SelectField`, `TextField` |
| `pages/wms/StockTurnoverReportPage/index.js` | `productSearch`, `productId`, `currency` | `SearchField`, `SelectField`, `TextField` |

Сохранено:
- `currency` remains a string, including existing uppercase + `slice(0, 3)` behavior; empty remains `""`.
- `productId` / `variantId` remain string select values; empty remains `""`.
- existing lookup hooks, product search state, `queryArgs` `field || undefined`, validation/`skip`,
  and report RTK hooks are unchanged.
- no autocomplete was introduced and no new lookup hooks were added.
- select/date controls from 4C.5A/4C.5B, WMS/OMS editors, Workspace filter controls, server/API/migrations were not changed.
- `StockValuationReportPage` still contains a disabled read-only "Coming soon" as-of placeholder; it is not a
  query-bound report filter.

## Phase 4D.1 WMS master-data forms migrated

WMS master-data create/edit form controls migrated in:

| File | Fields | Target |
|---|---|---|
| `pages/wms/WarehousesPage/index.js` | `form.code`, `form.name`, `form.isActive` | `TextField`, `TextField`, `CheckboxField` |
| `pages/wms/LocationsPage/index.js` | `form.warehouseId`, `form.code`, `form.type` | `SelectField`, `TextField`, `SelectField` |

Сохранено:
- Warehouses `form` state shape remains `{ id, code, name, isActive }`; create/update payload remains
  `{ code, name, isActive: Boolean(form.isActive) }`.
- Locations `form` state shape remains `{ id, warehouseId, code, type }`; create/update payload remains
  `{ warehouseId, code, type }`.
- `warehouseId`, `code`, `type`, `name` remain strings; `isActive` remains boolean.
- Locations empty warehouse option and location type labels/order are unchanged.
- WMS document editors, report pages, OMS pages, Workspace filter controls, components/inputs, components/shared,
  server/API/migrations were not changed.

## Phase 4D.2 WMS/OMS picker/search/select controls migrated

Low/medium WMS/OMS picker and page-specific filter controls migrated in:

| File | Controls | Target |
|---|---|---|
| `pages/wms/WmsInventoryShellPage/index.js` | warehouse URL filter, search URL filter | `SelectField`, `SearchField` |
| `pages/wms/WmsDocumentsPage/WmsDocumentsWorkspace.js` | warehouse URL filter, search URL filter, status URL filter | `SelectField`, `SearchField`, `SelectField` |
| `pages/wms/PicksPage/index.js` | warehouse local filter, search local filter, status local filter | `SelectField`, `SearchField`, `SelectField` |
| `components/oms/OmsProductPicker.jsx` | picker search input | `SearchField` |

Сохранено:
- URL-param helpers (`updateParam`, `setParam`) and local setters are unchanged.
- search values remain strings; no debounce was added to `SearchField`.
- `OmsProductPicker` keeps the existing 250ms debounce, `useListProductsQuery` args, result rendering,
  and selection callback behavior.
- select values remain strings; empty/all values and option labels/order are unchanged.
- `WmsDocumentsWorkspace` type select remains raw because it has option-level `disabled` behavior
  (`disabledTypes[type]`) that must be preserved while `components/inputs/RadixSelect` is out of scope.
- WMS document editors/cells, qty/money/number/date controls, report pages, OMS pages outside
  `OmsProductPicker`, Workspace filter controls, components/inputs, components/shared, server/API/migrations were not changed.

## Phase 4D.2B SelectField disabled options + WmsDocumentsWorkspace type select

`SelectField` now supports `options[].disabled` without changing `components/inputs/RadixSelect`.
The wrapper guards disabled values before emission, so disabled options remain visible but do not update
the controlled value.

Migrated:
- `pages/wms/WmsDocumentsPage/WmsDocumentsWorkspace.js` type URL filter from raw `<select>` to `SelectField`.

Сохранено:
- `type` still writes through the existing `setTypeParam(searchParams, navigate, value)` helper.
- empty/all option remains `""`; document type option values, labels, and order are unchanged.
- `disabledTypes[type]` still blocks selecting unavailable document types.
- existing `SelectField` usages without disabled options are unchanged.
- `components/inputs/RadixSelect`, WMS document editors/cells, reports, OMS pages, Workspace filter controls,
  server/API/migrations were not changed.

## Phase 4D.3 WMS document shell header fields migrated

Migrated only header controls in `pages/wms/WmsDocumentShell/WmsDocumentShell.js`:

| Area | Previous control | Target |
|---|---|---|
| document type fixed header field | raw text input | `TextField` |
| warehouse/location header fields | `ThemedSelect` | `SelectField` |
| document date header fields | raw date input | `DateField` |
| free-text header fields | raw text input | `TextField` |
| correction reason header rail field | raw textarea | `TextareaField` |

Сохранено:
- header values still write through the existing `setHeaderField(field.key, value)` path.
- document dates remain date-only local-naive `YYYY-MM-DD` strings.
- warehouse/location/type values remain strings; option values, placeholders, hints, and disabled gates are unchanged.
- existing `fieldErrors` rendering, header layout classes, save/update handlers, adapters, and mutation payload assembly are unchanged.
- line item table controls, cell editors, qty/money fields, product picker cells, parcel fields, WMS reports,
  OMS pages, components/inputs, components/shared, server/API/migrations were not changed.

## Ref forwarding and keyboard passthrough

`TextField` and `NumberField` forward `ref` to the inner native `<input>`. Native input props such as
`onKeyDown`, `onKeyUp`, `onFocus`, `onBlur`, `onPaste`, `onInput`, `autoFocus`, `tabIndex`, `autoComplete`,
`inputMode`, `pattern`, `min`, `max`, `step`, `aria-*`, and `data-*` are passed through to that input.

This is a prerequisite for future WMS cell-editor migration, where grid focus and keyboard navigation depend on
direct input refs and `onKeyDown` handlers.

```jsx
const qtyRef = React.useRef(null);

<NumberField
  ref={qtyRef}
  value={row.qty}
  emitAs="string"
  min={0}
  step="0.0001"
  onKeyDown={handleCellKeyDown}
  onValueChange={(value) => updateRow(row.id, "qty", value)}
/>
```

Behavior remains unchanged:
- `TextField` still normalizes `null`/`undefined` to `""`.
- `NumberField emitAs="string"` still emits the raw string.
- `NumberField emitAs="number"` still emits `number`/`null` and never emits `NaN`.
- existing `onChange(value, event)` / `onValueChange(value)` and `onBlur` contracts are preserved.

## Phase 4D.4A WMS cellRenderers simple cells migrated

Migrated only simple inline cell controls in `pages/wms/WmsDocumentShell/cellRenderers.js`:

| Cell renderer | Target |
|---|---|
| `renderQtyCell` (`qty` / `quantity`) | `NumberField emitAs="string"` |
| `renderNumberCell` (`cost` and numeric-like columns) | `NumberField emitAs="string"` |
| `renderTextInputCell` (`text` / detail fallback) | `TextField` |
| `renderCurrencyCell` (`currency` code) | `TextField` with existing uppercase write |

Сохранено:
- numeric cell values remain raw strings in row state; empty string remains empty.
- decimal comma/number conversion remains deferred to existing save/summary adapters.
- `qtyRefs.current[row.localId]` still receives the native input via `NumberField` ref-forwarding.
- `onCellKeyDown(event, row, column)` still receives native keyboard events.
- existing `min`, `step`, disabled state, input classes, row warnings, and row errors are preserved.
- product picker cell, custom portal behavior, `productRefs`, `openPicker`, `selectProduct`, summary/save adapters,
  payload converters, WMS document shell, WarehouseDocumentDetailPage, server/API/migrations were not changed.

## Phase 4D.4B.1 WarehouseDocumentDetailPage header/simple fields migrated

Migrated only non-line simple controls in `pages/wms/WarehouseDocumentDetailPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| draft header warehouse | raw select | `SelectField` |
| draft header inbound location | raw select | `SelectField` |
| Ship modal source location | raw select | `SelectField` |
| Correction modal reason | raw textarea | `TextareaField` |

Сохранено:
- `header.warehouseId`, `header.inboundLocationId`, and `selectedLocationId` remain string values.
- empty `""` option semantics, option labels/order, and source arrays are unchanged.
- existing `onHeaderChange`, `onLocationChange`, `setReason`, disabled/submitting states, layout classes, buttons,
  and modal submit flows are unchanged.
- qty/unitCost inputs, row line table, lot/serial/currency cells, read-only detail location select, checkboxes,
  scan input, ProductPicker, payload builder, save/mutation logic, server/API/migrations were not changed.

## Phase 4D.4B.2 WarehouseDocumentDetailPage line text/select/check boxes migrated

Migrated only line text/select/checkbox controls in `pages/wms/WarehouseDocumentDetailPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| grid select-all checkbox | raw checkbox | `CheckboxField` |
| grid row-select checkbox | raw checkbox | `CheckboxField` |
| correction modal line-select checkbox | raw checkbox | `CheckboxField` |
| grid lot number | raw text input | `TextField` |
| grid serial number | raw text input | `TextField` |
| grid currency code | raw text input | `TextField` |
| details panel currency code | raw text input | `TextField` |
| details panel lot number | raw text input | `TextField` |
| details panel read-only inbound location | disabled raw select | disabled `SelectField` |

Сохранено:
- `row.lotNumber`, `row.serialNumber`, and `row.currency` remain strings; empty values remain `""`.
- currency still writes uppercase values.
- `selectedRowIds`, `allRowsSelected`, and correction `selectedIds` toggle behavior is unchanged.
- grid callback refs still point to native inputs via `TextField` ref-forwarding.
- existing currency keyboard navigation and details lot Enter handling are preserved.
- qty/unitCost inputs, ProductPicker, scan input, save/mutation logic, payload builder, `asNumber`/`asText`/`round4`,
  WMS document shell/cellRenderers, WzParcelsSection, server/API/migrations were not changed.

## Phase 4D.4B.3 WarehouseDocumentDetailPage qty/unitCost migrated

Migrated only qty/unitCost numeric controls in `pages/wms/WarehouseDocumentDetailPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| grid `qtyExpected` | raw number input | `NumberField emitAs="string"` |
| grid `unitCost` | raw number input | `NumberField emitAs="string"` |
| details panel `unitCost` | raw number input | `NumberField emitAs="string"` |

Сохранено:
- `row.qtyExpected` and `row.unitCost` remain raw strings; empty values remain `""` in row state.
- payload conversion remains only in the existing payload builder:
  `qtyExpected: asNumber(row.qtyExpected, 0)` and
  `unitCost: asText(row.unitCost) ? asNumber(row.unitCost, 0) : null`.
- empty qty still becomes `0` only at payload build time; empty unitCost still becomes `null` only at payload build time.
- no `Number()`, `parseFloat()`, `parseInt()`, or decimal-comma conversion was added to fields/rendering.
- `min`, `step`, callback refs, qty `onFocus`, existing `onKeyDown` navigation, and `commitQty(row)` behavior are preserved.
- ProductPicker, scan input, header fields, line text/select/checkbox fields, save/mutation logic, WMS document
  shell/cellRenderers, WzParcelsSection, server/API/migrations were not changed.

## Phase 4D.4B.4A WarehouseDocumentDetailPage scan input migrated

Migrated only the scan / quick-add input in `pages/wms/WarehouseDocumentDetailPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| draft scan / quick-add input | raw text input | `TextField` |

Сохранено:
- `scanInputRef` points to the native input through `TextField` ref-forwarding, so `focus()` and `select()` remain available.
- F2 focus/select behavior, Enter `resolveScan()`, Escape `clearScan()`, and `scanQuery` state behavior are unchanged.
- scan error/results reset on typing remains unchanged.
- `resolveScan`, `clearScan`, `applyScanResult`, busy/error/results dropdown rendering, payload logic, and server/API were not changed.
- ProductPicker is intentionally left untouched and accepted as a bespoke first-class product-selection control.

## Phase 4D.5B PicksPage scan input migrated

Migrated only the large scan input in `pages/wms/PicksPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| scan mode large input | raw text input | `TextField` |

Сохранено:
- `scanQuery` remains a string and still writes through `onScanQueryChange`.
- `autoFocus`, Enter `onScan()`, Escape `onClose()`, and placeholder logic are unchanged.
- no debounce or clearable behavior was added.
- progress chip, scan mode layout, warehouse/status/search filters, pick actions, pick mutations, and server/API were not changed.

## Phase 4D.5C WzParcelsSection migrated

Migrated only the parcel drawer form controls in `pages/wms/WmsDocumentShell/WzParcelsSection.js`:

| Area | Previous control | Target |
|---|---|---|
| `trackingNumber` | raw text input | `TextField` |
| `carrier` | raw text input | `TextField` |
| `dims` | raw text input | `TextField` |
| `weight` | raw input | `NumberField emitAs="string"` |

Сохранено:
- `trackingNumber`, `carrier`, and `dims` remain strings and still write through `setField`.
- `carrier` remains free text and was not converted to a select.
- `dims` format remains unchanged; no validation was added.
- `weight` remains a string in form state; empty weight remains `""`.
- `buildPayload` still converts weight with `asText(form.weight) ? Number(form.weight) : null`, so empty weight becomes `null` only during payload build.
- create/update parcel mutations, parcel list rendering, add/remove buttons, save logic, server/API, and migrations were not changed.

## Phase 4D.5A CycleCountDetailPage migrated

Migrated only the editable count-line controls in `pages/wms/CycleCountDetailPage/index.js`:

| Area | Previous control | Target |
|---|---|---|
| `locationId` | `ThemedSelect` | `SelectField` |
| `variantId` | raw text input | `TextField` |
| `lotId` | raw text input | `TextField` |
| `serialId` | raw text input | `TextField` |
| `qtyCounted` | raw number input | `NumberField emitAs="string"` |

Сохранено:
- `locationId`, `variantId`, `lotId`, and `serialId` remain string values and still write through `setDraftField`.
- empty location/warehouse-level stock option behavior is unchanged.
- `qtyCounted` remains a string in draft row state; default `"0"` and empty `""` behavior are unchanged.
- numeric conversion remains only in validation and `buildCycleCountItemsPayload({ rows: draftItems })`; no conversion was moved into the field.
- ProductPicker, product selection popup, cycle count mutations, payload adapters, save/post count flow, server/API, and migrations were not changed.

## Phase 5A Batch 1 completed

Quick standard swaps completed with existing field components only:

| Area | Files | Target components |
|---|---|---|
| WMS list custom filters | `LotsPage`, `StockMovesPage`, `SerialsPage`, `ReservationsPage` | `SearchField` |
| WMS stock balance filter | `StockBalancesPage` | `CheckboxField` |
| Auth/user/company small controls | `ForgotPasswordModal`, `InviteUserModal`, `UserAccessPanel`, `Topbar` | `TextField`, `SelectField`, `SearchField` |
| Entity notes controls | `EntityNotesSection` | `SearchField`, `TextField`, `SelectField`, `CheckboxField`, `TextareaField` |
| Chat search/name controls | `ChatSearchBar`, `ChatSidebar`, `ChatHeader`, `ChatCreateDirect` | `SearchField`, `TextField` |

Сохранено:
- query/page reset behavior in WMS and notes filters.
- Topbar Ctrl/Cmd+K focus through the existing `inputRef` path.
- Chat header search focus/select, Enter navigation, and parent event-handler contracts.
- Invite user email lookup debounce, form state, role value, and submit payload.
- User access role/permission filtering and switch behavior.
- No new field components were created.

Skipped in this batch:
- `components/company/CompanySelect/index.js` contains a hidden native radio that backs a custom listbox card UI.
  It is not a standard field control and was left unchanged.

## Phase 5A Batch 2 CRM/PIM/company settings migrated

Migrated standard controls with existing field components only:

| Area | Files | Target components |
|---|---|---|
| CRM standalone forms | `CounterpartyForm`, `ContactForm` | `TextField`, `TextareaField`, `SelectField`, `CheckboxField`, `AutocompleteField` |
| PIM detail tabs | `ProductDetailTabs` | `SelectField` for existing `ThemedSelect` controls |
| Company WMS/document settings | `WarehouseDocumentSettings`, `WarehouseWmsSettings`, `DocumentNumberingSettings`, `DocumentNumberingSettingsTable`, `DocumentTemplateSettings`, `DocumentTemplatesPage` | `TextField`, `SelectField`, `CheckboxField` |
| Document detail header action | `DocumentDetailsPage` | `SelectField` |

Сохранено:
- form state, payload builders, validation, query/mutation calls, and save handlers.
- ContactForm counterparty search/input state, debounced lookup, selected object, and `counterpartyId` payload.
- ProductDetailTabs option values/labels/order for migrated selects.
- DocumentDetailsPage conversion target value and conversion handler behavior.
- No new field components were created.

Skipped in this batch:
- `CounterpartyForm` primary contact radio stays raw because it is interleaved per dynamic contact row and does not map cleanly to a grouped `RadioGroupField`.
- `ProductDetailTabs` raw file/image, numeric/measurement, stock/price, and checkbox/text editor controls were left untouched for specialized or payload-aware follow-up work.
- document engine line-item controls, specialized HTML/image/color/range controls, ProductPicker, ContactsEditor primary radio, server/API/migrations were not changed.

## Phase 5A Batch 3 completed

Final ACTION REQUIRED controls migrated with existing field components only:

| Area | Files | Target components |
|---|---|---|
| Invoice settings selects | `InvoicesSettings` | `SelectField` |
| Company deal stage selector | `CompanyDeals` | `SelectField` |
| WMS settings policy controls | `WmsSettingsPanel` | `SelectField`, `CheckboxField` |
| Chat group name edit | `ChatInfoHeader` | `TextField` |
| Counterparty primary contact selector | `CounterpartyForm` | `RadioGroupField` |
| Product merge target selector | `ProductDetailPage` | `SelectField` |

Сохранено:
- settings state and save payloads for invoice/WMS/company deals controls.
- chat group title value and room update payload.
- counterparty contacts payload with exactly one `isPrimary` row.
- product merge target id and merge handler behavior.
- `HtmlEditorField`, `ColorField`, `ImageField`, image/gallery managers, ProductPicker, AvatarEditable,
  ChatInput composer, server/API/migrations were not changed.
- ACTION REQUIRED count from `FINAL_FIELD_STANDARDIZATION_VERIFICATION.md` is now 0.

## Phase 5A′.1 DocumentHeader/DocumentMetaForm migrated

Migrated only low-risk document header/meta controls:

| File | Controls | Target |
|---|---|---|
| `components/documents/DocumentHeader.jsx` | document type, direction, number, status | `SelectField`, `TextField` |
| `components/documents/DocumentMetaForm.jsx` | client, issue date | `SelectField`, `DateField` |

Сохранено:
- `header.type`, `header.direction`, `header.number`, and `header.status` remain strings.
- `meta.clientId` remains a string; empty `""` option remains `Выберите клиента`.
- `meta.issueDate` remains a local-naive `YYYY-MM-DD` string; no Date object or timezone conversion was added.
- disabled states, manual labels, and required `*` hints are preserved.
- document form mapping/state hooks, line items, payment fields, type-mode fields, totals, server/API/migrations were not changed.

## Phase 5A′.2 document line text/select controls migrated

Migrated only low/medium line text/select controls:

| File | Controls | Target |
|---|---|---|
| `components/documents/DocumentItemsTable.jsx` | line item name, unit | `TextField` |
| `components/documents/LineItemsEditor/LineItemsEditor.jsx` | line item name, discount type | `TextField`, `SelectField` |

Сохранено:
- item `name` and `unit` remain strings and still write through the existing line update callbacks.
- `discountType` remains a string; option values, labels, order, placeholder, and readonly state are unchanged.
- table headers continue to provide labels, so field components are rendered without labels.
- qty/money numeric fields, OmsProductPicker, drag handles, reorder logic, mapping/state hooks, totals,
  server/API/migrations were not changed.

## Phase 5A′.3 document numeric/money/day fields migrated

Migrated only document numeric/money/day controls to `NumberField emitAs="string"`:

| File | Controls |
|---|---|
| `components/documents/DocumentItemsTable.jsx` | `quantity`, `unitNet`, `vatRate` |
| `components/documents/LineItemsEditor/LineItemsEditor.jsx` | `qty`, `priceNet`, `taxRate`, `discountValue` |
| `components/documents/DocumentForm.jsx` | payment `paidAmount` |
| `components/documents/DocumentTypeModeFields.jsx` | `validDays`, `paymentDays` |

Сохранено:
- line and payment numeric values remain strings in component/form state.
- `validDays` and `paymentDays` still route raw strings through existing `normalizeIntInput`, so state remains `int|""`.
- empty string behavior and decimal-comma handling ownership are unchanged.
- conversion remains in `documentFormMapping.js`; `toNumber`, `round`, `mapItem`, payment normalization, and totals
  calculation were not changed.
- dates, `paymentDate`, `paymentMethod`, DocumentEnginePage, OmsProductPicker, drag/reorder logic, server/API/migrations
  were not changed.

## Phase 5A′.4 remaining document fields migrated

Migrated the remaining low-risk document fields:

| File | Controls | Target |
|---|---|---|
| `components/documents/DocumentTypeModeFields.jsx` | `validFrom`, `validTo`, `paymentDueDate` | `DateField` |
| `components/documents/DocumentForm.jsx` | `paymentDate`, `paymentMethod` | `DateField`, `TextField` |
| `components/documents/DocumentEngine/DocumentEnginePage.jsx` | generic select, textarea, date, text renderer | `SelectField`, `TextareaField`, `DateField`, `TextField` |

Сохранено:
- all date values remain local-naive `YYYY-MM-DD`; no Date object or timezone conversion was added.
- generic renderer still uses `field.value`, `field.onChange(value)`, `field.options`, `field.placeholder`,
  `field.disabled`, and `field.type` without schema/API changes.
- payment mapping, document form state hooks, totals, line item controls, OmsProductPicker, drag/reorder logic,
  server/API/migrations were not changed.
- Document Engine field migration is closed; bespoke/specialized controls remain intentionally outside ui/fields.

## Phase 5B.0 specialized field wrappers created

Created specialized wrappers only. No consumers/pages were migrated.

### SliderField

```jsx
<SliderField
  label="Scale"
  value={fontScale}
  min="70"
  max="160"
  step="5"
  showValue
  formatValue={(value) => `${value}%`}
  onValueChange={(value) => setFontScale(Number(value))}
/>
```

`SliderField` wraps native `input type="range"`. It emits raw `event.target.value` as a string:
`onValueChange(value)` and `onChange(value, event)`. Consumers keep any `Number(...)` conversion.
`ref` points to the native range input.

### ColorField

```jsx
<ColorField
  label="Color"
  value={color}
  onValueChange={setColor}
/>
```

`ColorField` wraps native `input type="color"`. Value is a hex string such as `#8fdb60`.
The wrapper does not validate or transform the color beyond native browser behavior.
`ref` points to the native color input.

### HtmlEditorField

```jsx
<HtmlEditorField
  label="Description"
  value={html}
  onValueChange={setHtml}
  toolbarPreset="full"
/>
```

`HtmlEditorField` wraps existing `components/inputs/HTMLEditor`. Editor internals, toolbar behavior,
sanitization, and HTML round-trip are unchanged. `HTMLEditor.onChange(html)` is mapped to
`onValueChange(html)` and `onChange(html, null)`.

### ImageField

```jsx
<ImageField
  label="Image"
  value={imageUrl}
  uploader={uploadImage}
  urlUploader={uploadImageUrl}
  pickerLabel="Upload image"
  onValueChange={setImageUrl}
/>
```

`ImageField` wraps existing `components/inputs/ImagePicker`. Value is a URL string. Upload stays inside
`ImagePicker` through `uploader` / `urlUploader`; the field boundary does not expose `File` or `FormData`.
Preview behavior and ImagePicker internals are unchanged. Use `pickerLabel` when the wrapped `ImagePicker` button
label must be preserved separately from the FieldShell label.

## Phase 5B.1/5B.2 specialized consumers migrated

Migrated Slider/Color/HtmlEditor consumers:

| File | Control | Target |
|---|---|---|
| `pages/users/UserSettingsPage/sections/AppearanceForm/index.js` | font scale range | `SliderField` |
| `pages/company/CompanySettings/Modules/CompanyDeals/index.js` | stage color picker | `ColorField` |
| `components/data/HtmlDescriptionSection/index.js` | description editor | `HtmlEditorField` |
| `pages/company/CompanySettings/Modules/InvoicesSettings/index.jsx` | invoice annotation template editor | `HtmlEditorField` |

Сохранено:
- `SliderField` emits a string, and `AppearanceForm` still converts it with `Number(raw)`, so `fontScale` remains a number.
- CompanyDeals stage color remains a hex string; no validation or payload changes were added.
- HTML editor consumers still write HTML strings to the same draft/settings fields.
- `HTMLEditor` internals, toolbar behavior, sanitization, `ImagePicker`, ImageField consumers, AvatarEditable,
  ProductDetail image/gallery, server/API/migrations were not changed.

## Phase 5B.3 ImageField consumers migrated

Migrated direct chat info `ImagePicker` consumers:

| File | Control | Target |
|---|---|---|
| `components/chat/info/ChatInfoHeader.jsx` | group avatar image picker | `ImageField` |
| `components/chat/info/ChatInfoPanel.jsx` | removed direct `ImagePicker` import after header migration | `ImageField` via header |

Сохранено:
- chat avatar value remains a URL string; upload remains internal to existing `ImagePicker` through `uploader`.
- `pickerLabel` preserves the previous ImagePicker button label while FieldShell label remains optional.
- group avatar draft/save behavior, preview, upload handler, and chat room payload were not changed.
- `ImagePicker` internals, `AvatarEditable`, ProductDetail image/gallery, ChatInput composer, server/API/migrations were not changed.

## Статус

- **Phase 1** — базовые поля: CLOSED.
- **Phase 1B** — `PasswordField`, `EmailField`, `PhoneField`, `UrlField`, `CurrencyField`,
  `PercentField`, `DateField`, `TimeField`, `DateTimeField`, `FileField`, `CountryField`,
  `FormActions`: **CLOSED**.
- **Phase 2A** — auth/company setup формы: **migrated** (5 файлов).
- **Phase 2B** — UserSettings формы: **migrated** (5 секций). Phase 3 — следующий.
- **Phase 3B.0** — SmartForm prerequisites: `MultiSelectField` + opt-in `FieldShell float`
  созданы. SmartForm/schemas/forms не мигрировались.
- **Phase 3B.1** — SmartForm low-risk branches migrated: text, textarea, checkbox, single select.
- **Phase 3B.2** — SmartForm date branches migrated: date, datetime, date-or-datetime.
- **Phase 3B.3** — SmartForm autocomplete-select branch migrated.
- **Phase 3B.4** — SmartForm multiselect family migrated.
- **Phase 3D** — `RadioGroupField` added; `ContactsEditor` migrated to `SelectField`/`TextField`
  with native row-level primary radio.
- **Phase 4B.0** — `PriorityField` added; `SearchField` added/verified for Task/System prerequisites.
- **Phase 4B.1** — safe Workspace, NotificationsPage, WorkspaceViews, DealsListPage controls migrated.
- **Phase 4B.2** — `CreateTaskModal` controls migrated to `TextField`, `TextareaField`,
  `SelectField`, `CheckboxField`, `DateField`, and `DateTimeField`.
- **Phase 4B.3** — `NotesPage` controls migrated to `SelectField`, `AutocompleteField`,
  `CheckboxField`, and `TextareaField`.
- **Phase 4B.4** — `EventModal` controls migrated to `TextField`, `CheckboxField`, and `TimeField`.
- **Phase 4B.6A** — `TaskForm` simple controls migrated to `TextField`, `TextareaField`,
  `SelectField`, `PriorityField`, and `CheckboxField`.
- **Phase 4B.6B** — `TaskForm` date fields migrated to `DateTimeField`.
- **Phase 4B.6C** — `TaskForm` assignees/watchers multiselects migrated to `MultiSelectField`.
- **Phase 4B.6D** — `TaskForm` counterparty/contacts autocompletes migrated to `AutocompleteField`;
  TaskForm migration complete.
- **Phase 4C.1** — shared `Workspace filter controls` migrated to `SearchField`/`SelectField`.
- **Phase 4C.2** — shared Workspace column controls and WorkspaceViews remaining controls migrated.
- **Phase 4C.3** — DealsListPage page-specific filters migrated.
- **Phase 4C.4** — ProductsPage page-specific filters migrated.
- **Phase 4C.5A** — WMS report select filters migrated.
- **Phase 4C.5B** — WMS report date/datetime filters migrated.
- **Phase 4C.5C** — WMS report text/product/variant filters migrated; WMS/OMS filter phase complete.
- **Phase 4D.1** — WMS Warehouses/Locations master-data forms migrated.
- **Phase 4D.2** — WMS inventory/documents/picks filters and OmsProductPicker search migrated.
- **Phase 4D.2B** — `SelectField` disabled options support added; WmsDocumentsWorkspace type select migrated.
- **Phase 4D.3** — WMS document shell header fields migrated.
- **Phase 4D.4.0** — `TextField`/`NumberField` ref-forwarding and keyboard passthrough added.
- **Phase 4D.4A** — WMS cellRenderers simple text/number cells migrated; product picker cell deferred.
- **Phase 4D.4B.1** — WarehouseDocumentDetailPage header/simple non-line fields migrated.
- **Phase 4D.4B.2** — WarehouseDocumentDetailPage line text/select/checkbox controls migrated.
- **Phase 4D.4B.3** — WarehouseDocumentDetailPage qty/unitCost fields migrated to `NumberField emitAs="string"`.
- **Phase 4D.4B.4A** — WarehouseDocumentDetailPage scan input migrated to `TextField`; ProductPicker accepted as bespoke.
- **Phase 4D.5B** — PicksPage scan input migrated to `TextField`.
- **Phase 4D.5C** — WzParcelsSection migrated.
- **Phase 4D.5A** — CycleCountDetailPage migrated; WMS operational phase closed.
- **Phase 5A Batch 1** — quick standard swaps completed for selected WMS filters, small one-offs, notes, user access, and chat search controls.
- **Phase 5A Batch 2** — CRM/PIM/company settings standard controls migrated.
- **Phase 5A Batch 3** — final ACTION REQUIRED controls migrated; functional field standardization complete.
- **Phase 5A′.1** — DocumentHeader and DocumentMetaForm migrated.
- **Phase 5A′.2** — document line text/select controls migrated.
- **Phase 5A′.3** — document numeric/money/day fields migrated to `NumberField emitAs="string"`.
- **Phase 5A′.4** — remaining low-risk document fields migrated; Document Engine field migration closed.
- **Phase 5B.0** — `SliderField`, `ColorField`, `HtmlEditorField`, and `ImageField` wrappers created.
- **Phase 5B.1/5B.2** — SliderField, ColorField, and HtmlEditorField consumers migrated.
- **Phase 5B.3** — ImageField chat info consumers migrated.

### Future (не в этой фазе)

- `AvatarEditable` and product image/gallery managers remain bespoke.
- Общий `Button` — при необходимости; сейчас `FormActions` использует глобальные классы кнопок.
