# Sunset ERP — Модуль **Projects**
## Financial & Operational Control Center (не «ещё одна Jira»)

> Документ архитектуры: рыночный анализ → целевая архитектура → ERD → backend/API/events/ACL → frontend/дашборды/KPI → roadmap по фазам → killer-features.
> Стек привязан к существующим конвенциям Sunset: PostgreSQL+Sequelize (UUID PK, `companyId` multi-tenancy, `field:` snake_case, `associate()`), тонкие контроллеры → сервисы, RTK Query per-domain, SSE→tag invalidation, event-log (`orderevent`).

---

# ЧАСТЬ 1. АНАЛИЗ РЫНКА

Формат по каждому продукту: сильные/слабые стороны, финансы, costing, time, budgeting, resources, reporting, **перенять / не повторять**.

## 1.1 Odoo Projects
- **Сильное:** глубокая встроенность в ERP (Sales→Project→Timesheet→Invoice→Accounting единым потоком); «billable time», авто-инвойсинг из таймшитов; analytic accounting (аналитические счета) как универсальный коллектор затрат на проект.
- **Слабое:** UX перегружен; планирование ресурсов и Gantt слабее специализированных; форкастинг почти отсутствует; кастомизация требует разработчика.
- **Финансы:** analytic accounts, billable/non-billable, milestone-billing, fixed-price vs T&M.
- **Costing:** через аналитические счета — таймшит × ставка, закупки/счета поставщиков с тегом проекта.
- **Time:** таймшиты на задачу/проект, табель, mobile.
- **Budgeting:** «Analytic budgets» — план vs факт по аналитике (базово).
- **Resources:** модуль Planning (отдельный), слабая capacity-картина.
- **Reporting:** pivot/cohort, маржа проекта, profitability.
- **✅ Перенять:** analytic-account как единый коллектор затрат; billable-time→invoice; milestone-billing; sales↔project↔invoice цепочку.
- **❌ Не повторять:** разрозненность (Planning отдельный продукт), перегруженный UX, слабый forecasting.

## 1.2 ERPNext Projects
- **Сильное:** open-source, полностью внутри ERP; Project→Task→Timesheet→Sales Invoice; «Project Profitability» из коробки; gross margin по проекту.
- **Слабое:** UI устаревший; Gantt примитивный; ресурс-планирование почти нет; форкастинг отсутствует.
- **Финансы:** costing (timesheet costing rate + billing rate), purchase/expense с project-тегом, project-wise P&L.
- **Costing:** costing rate сотрудника, материалы через Stock/Purchase с project link.
- **Time:** Timesheet doctype, costing+billing rate раздельно.
- **Budgeting:** через Cost Center budgets (не нативно в проекте).
- **Resources:** слабо.
- **Reporting:** Project Profitability, Gross Margin.
- **✅ Перенять:** разделение costing rate / billing rate; project-wise P&L отчёт; привязка purchase/stock к проекту.
- **❌ Не повторять:** UI; отсутствие планирования мощностей и forecasting.

## 1.3 Microsoft Project
- **Сильное:** эталон планирования — Gantt, critical path, зависимости (FS/SS/FF/SF, lead/lag), baselines, leveling ресурсов, EVM (Earned Value: BCWS/BCWP/ACWP, CPI/SPI).
- **Слабое:** не ERP — нет инвойсов/закупок/реального учёта денег; дорогой; кривая обучения; командная работа слабее облачных.
- **Финансы:** косвенно — cost из rate × work; нет связки с бухгалтерией.
- **Costing:** ресурсные ставки, fixed cost на задачу, cost accrual.
- **Time:** через Project Online/Timesheet (отдельно).
- **Budgeting:** budget resources, baseline cost.
- **Resources:** лучший в классе — resource leveling, overallocation.
- **Reporting:** EVM, burndown, resource usage.
- **✅ Перенять:** EVM-метрики (CPI/SPI), critical path, baselines (snapshot плана), зависимости задач, resource leveling.
- **❌ Не повторять:** изоляцию от финучёта; тяжесть desktop; отсутствие реального cash.

## 1.4 Monday.com
- **Сильное:** UX/гибкие boards, automations, dashboards-конструктор, низкий порог входа, виджеты.
- **Слабое:** «work OS», а не ERP — финансы поверхностные; учёт затрат/время через апсейлы; нет настоящего P&L/cash.
- **Финансы:** budget-колонки, формулы; не бухгалтерия.
- **Costing:** ручные колонки/формулы.
- **Time:** time-tracking column (в платных).
- **Budgeting:** numeric/formula columns, ручное.
- **Resources:** Workload view (базовый capacity).
- **Reporting:** дашборд-виджеты, charts.
- **✅ Перенять:** конструктор дашбордов; automations (no-code триггеры); Workload-view; превосходный UX/onboarding.
- **❌ Не повторять:** «всё руками в колонках» вместо реальной финмодели; vendor lock апсейлами.

## 1.5 ClickUp
- **Сильное:** «всё в одном», иерархия (Space→Folder→List→Task→Subtask→Checklist), custom fields, multiple views (List/Board/Gantt/Calendar), goals, native time-tracking, dashboards.
- **Слабое:** перегружен функциями («feature bloat»), производительность, неустойчивый UX; финансы — слабые (нет инвойсов/P&L/cash).
- **Финансы:** «Money» rollup поля, формулы; не учёт.
- **Costing:** time × rate (базово), money custom fields.
- **Time:** native tracking, estimates, billable flag.
- **Budgeting:** через goals/custom fields.
- **Resources:** Workload/Capacity view.
- **Reporting:** дашборды, time reports.
- **✅ Перенять:** гибкую иерархию + чеклисты; multiple views на одних данных; native timer с billable-флагом; goals/targets.
- **❌ Не повторять:** feature-bloat и переключатели всего; слабую финансовую глубину.

## 1.6 Asana
- **Сильное:** чистый UX, Timeline, Portfolios, Goals, Workload, rules (automations), формы.
- **Слабое:** нет нативного time-tracking (через интеграции), финансы отсутствуют, бюджет/costing нет.
- **Финансы:** нет нативно.
- **Costing/Time:** через интеграции (Harvest и т.п.).
- **Budgeting:** нет.
- **Resources:** Workload по «effort» полю.
- **Reporting:** Universal reporting, portfolio status.
- **✅ Перенять:** Portfolio rollup (статус/прогресс по портфелю проектов); Goals OKR-связку; чистый UX; status-updates с авто-сводкой.
- **❌ Не повторять:** отсутствие финансов/времени — для Sunset это ядро, а не плагин.

## 1.7 Jira
- **Сильное:** эталон для разработки — workflows, agile (scrum/kanban), JQL, гибкие схемы, огромная экосистема.
- **Слабое:** не для финансово-операционного управления; time/cost через Tempo и др. (платно); тяжёлая конфигурация; «инженерный» уклон.
- **Финансы:** только через Tempo/Marketplace.
- **Costing/Time:** Tempo Timesheets/Cost Tracker (внешнее).
- **Budgeting:** Tempo budgets.
- **Resources:** Tempo Planner / Advanced Roadmaps capacity.
- **Reporting:** burndown/velocity, dashboards (инженерные).
- **✅ Перенять:** конфигурируемые workflow со статус-машиной и transitions; мощный фильтр-язык (аналог JQL); agile-доски как опциональный view.
- **❌ Не повторять:** зависимость от платных аддонов для базовых вещей (время/деньги); сложность администрирования.

## 1.8 Oracle NetSuite Projects (SuiteProjects/PSA)
- **Сильное:** настоящая PSA внутри ERP — project accounting, revenue recognition (ASC 606), billing rules, resource management, WIP, percentage-of-completion.
- **Слабое:** дорого/сложно; внедрение = месяцы; UI устарел; избыточно для SMB.
- **Финансы:** revenue recognition, billing schedules, project P&L, WIP, deferred revenue.
- **Costing:** labor cost (rate cards), expenses, item/purchase costing на проект.
- **Time:** timesheets с approval-workflow, billable.
- **Budgeting:** baseline + revised budgets, charge-based.
- **Resources:** resource allocation, utilization, skills.
- **Reporting:** profitability, utilization, backlog, revenue forecast.
- **✅ Перенять:** revenue recognition (% завершения / milestone / по времени); billing rules (rate cards); WIP и backlog; utilization сотрудников.
- **❌ Не повторять:** стоимость/сложность внедрения; устаревший UX; over-engineering для SMB-сегмента.

## 1.9 SAP Project System (PS) / S/4HANA
- **Сильное:** глубочайшая интеграция в учёт — WBS (work breakdown structure), networks, EVM, cost/revenue planning по WBS-элементам, интеграция с MM/PP/CO/FI; масштаб корпораций.
- **Слабое:** монструозная сложность, требует консультантов, негибкость, дорого; UX недружелюбный.
- **Финансы:** план/факт стоимости и выручки на WBS, settlement (распределение на счета), commitments из закупок.
- **Costing:** activity-based, commitments (PO), actual из FI/CO.
- **Time:** CATS (Cross-Application Time Sheet).
- **Budgeting:** budget на WBS с availability control (блокировка перерасхода!).
- **Resources:** через HR/PP capacity.
- **Reporting:** очень глубокий cost/EVM.
- **✅ Перенять:** **WBS-иерархию** как универсальный коллектор план/факт; **availability control** (жёсткая блокировка трат сверх бюджета); **commitments** (зарезервированные деньги из открытых PO); settlement-rules.
- **❌ Не повторять:** сложность, негибкость, зависимость от консультантов, ужасный UX.

## 1.10 Zoho Projects
- **Сильное:** доступная цена, часть Zoho One (связь с CRM/Books/Invoice), Gantt, blueprints (workflow), timesheet+billing, неплохой баланс.
- **Слабое:** финансовая глубина средняя (P&L/cash живут в Zoho Books, не в проекте); форкастинг слабый; ресурс-план базовый.
- **Финансы:** через Zoho Books — invoice из timesheet, project budget.
- **Costing:** budget по hours/cost/revenue, planned vs actual.
- **Time:** timesheet billable/non-billable, approval.
- **Budgeting:** budget на проект (часы/деньги), threshold-алерты.
- **Resources:** Resource utilization chart.
- **Reporting:** EVM (есть!), planned vs actual, utilization.
- **✅ Перенять:** budget threshold-алерты; blueprint-workflow; интеграцию CRM→Project→Invoice; что EVM можно дать даже в среднем сегменте.
- **❌ Не повторять:** разнесённость финансов между Projects и Books (у нас всё в одной платформе — преимущество!).

## 1.11 Teamwork.com
- **Сильное:** заточен под агентства/клиентскую работу: billing, retainers, profitability, time→invoice, utilization, client-доступ.
- **Слабое:** вне агентского сценария избыточен; ERP-функций (склад/закупки) нет; форкастинг ограничен.
- **Финансы:** billable rates, budgets (time/fixed/retainer), profitability.
- **Costing:** cost rate vs billable rate, expenses.
- **Time:** сильный time-tracking, timers, billable.
- **Budgeting:** retainer/recurring budgets, burn-алерты.
- **Resources:** Workload planner, utilization.
- **Reporting:** profitability, utilization, budget burn.
- **✅ Перенять:** **retainer/recurring budgets** (абонентские бюджеты); billable vs cost rate; client-portal доступ; budget-burn алерты.
- **❌ Не повторять:** узкую агентскую заточенность без operational-ERP.

## 1.12 Wrike
- **Сильное:** enterprise work management, custom item types, request forms, динамические дашборды, resource/workload (Wrike Resource), proofing.
- **Слабое:** финансы поверхностны; дорогой enterprise; кривая обучения; billing/invoice нет нативно.
- **Финансы:** budget/cost поля, time×rate; не учёт.
- **Costing:** effort/cost поля.
- **Time:** time-tracking, timelog.
- **Budgeting:** custom fields/budget add-on.
- **Resources:** Wrike Resource (workload, bookings).
- **Reporting:** богатые дашборды, blueprint.
- **✅ Перенять:** request forms→авто-создание проектов/задач; blueprints (шаблоны проектов); resource bookings (бронь под проект до назначения людей).
- **❌ Не повторять:** слабую финмодель при высокой цене; сложность.

## 1.13 Smartsheet
- **Сильное:** «таблица как проект», знакомый Excel-like UX, формулы, Gantt, Control Center (масштабирование шаблонов), automations, dynamic view.
- **Слабое:** не реляционная БД (электронная таблица в основе → пределы масштаба/целостности); финансы — формулами; нет нативного учёта.
- **Финансы:** формульные бюджеты/cost rollup.
- **Costing/Time:** формулы / интеграции.
- **Budgeting:** ручные/формульные.
- **Resources:** Resource Management by Smartsheet (отдельный продукт).
- **Reporting:** sheet-reports, dashboards.
- **✅ Перенять:** grid-view с формулами для фин-моделирования; шаблоны проектов (provisioning); dynamic view для клиентов/подрядчиков.
- **❌ Не повторять:** таблично-файловую основу вместо нормализованной БД; финансы «на формулах».

## 1.14 Сводные выводы рынка

| Что брать (best-of-breed) | Откуда |
|---|---|
| WBS как универсальный коллектор план/факт затрат и выручки | SAP PS, Odoo (analytic) |
| Availability control — блок трат сверх бюджета | SAP PS |
| Commitments (резерв денег по открытым PO) | SAP PS |
| Revenue recognition (% completion / milestone / time) | NetSuite |
| Cost rate vs Billing rate раздельно | ERPNext, Teamwork |
| Billable time → авто-инвойс | Odoo, Zoho |
| EVM (CPI/SPI, PV/EV/AC) + baselines + critical path | MS Project, Zoho |
| Retainer/recurring budgets + burn-алерты | Teamwork |
| Portfolio rollup + Goals/OKR | Asana |
| Конструктор дашбордов + no-code automations | Monday |
| Гибкая иерархия + чеклисты + multiple views | ClickUp |
| Конфигурируемый workflow / status-machine | Jira |
| Шаблоны/blueprints + request forms | Wrike, Smartsheet |

**Главный вывод для Sunset:** ни один из «PM-инструментов» (Monday/ClickUp/Asana/Jira/Wrike/Smartsheet) не имеет настоящих финансов; все «ERP-PSA» (SAP/NetSuite/Odoo/ERPNext) имеют финансы, но слабый UX и почти нулевой forecasting/cash. **Окно Sunset = финансово-операционный проект-центр с UX уровня Monday и финансами уровня NetSuite, плюс реальный Cash Flow и AI-forecasting, которых нет ни у кого.**

---

# ЧАСТЬ 2. ЦЕЛЕВАЯ АРХИТЕКТУРА МОДУЛЯ PROJECTS

## 2.1 Продуктовые принципы
1. **Проект = коллектор денег.** Каждая задача/закупка/инвойс/таймшит может «оседать» на проекте (по образцу WBS/analytic account).
2. **Single source of truth для P&L.** План и факт доходов/расходов считаются из реальных документов Sunset (orders, offers, invoices, purchases, stock moves, timesheets), а не вводятся вручную.
3. **Forecast-first.** Cash Flow и P&L проекта прогнозируются на будущее, а не только показывают прошлое.
4. **Operational + Financial в одном экране.** Задачи и деньги — две стороны одной сущности.
5. **Multi-tenant, как весь Sunset:** всё через `companyId`, ACL, SSE-инвалидация, event-log.

## 2.2 Доменная модель (концептуально)

```
Portfolio
  └── Project ──────────────── финансовый коллектор (бюджеты, P&L, cash)
        ├── Phase (этап / milestone / WBS-узел)
        │     └── Task
        │           ├── Subtask (self-ref)
        │           ├── Checklist → ChecklistItem
        │           ├── TimeEntry (тайм-трекинг, billable/cost)
        │           └── Dependency (FS/SS/FF/SF)
        ├── Budget → BudgetLine (план доход/расход по категориям/периодам)
        ├── ProjectRevenue (план/факт доход; link → Offer/Order/Invoice/Milestone)
        ├── ProjectCost (план/факт расход; link → Purchase/Bill/StockMove/TimeEntry/Expense)
        ├── Allocation (назначение ресурса: член команды/роль, % capacity, период)
        ├── Risk
        ├── Document / File (через существующий documents-модуль)
        ├── Comment / Activity (event-log)
        └── Link (полиморфная связь с CRM/Deal/Counterparty/Order/Invoice/Warehouse/Purchase/HR/Calendar)
```

## 2.3 Финансовое ядро (как считается P&L и Cash)

- **Planned Revenue** = Σ BudgetLine(type=revenue) ИЛИ Σ ProjectRevenue(status=planned). Источник плана: оферты/ордера, привязанные к проекту, или milestone-billing.
- **Actual Revenue** = Σ Invoice(привязан к проекту, выставлен) + recognized revenue (по правилу признания).
- **Planned Cost** = Σ BudgetLine(type=cost) по категориям (labor/material/subcontract/overhead/expense).
- **Committed Cost** = Σ открытые Purchase Orders на проект (резерв, ещё не оплачено) — по образцу SAP commitments.
- **Actual Cost** = Σ (TimeEntry × costRate) + Σ Bills/Purchases(received) + Σ StockMove cost (себестоимость списанного со склада) + Σ Expenses.
- **Project P&L** = Actual Revenue − Actual Cost; маржа %, на дату/период.
- **Forecast (EAC)** = Actual + (Budget − Earned) с учётом CPI; или AI-модель (Phase 4).
- **Cash Flow** = ожидаемые поступления (по due-датам инвойсов/milestone) − ожидаемые выплаты (по due-датам bills/payroll) по неделям/месяцам.
- **EVM**: PV (planned value), EV (earned value = %complete × budget), AC (actual cost) → CPI=EV/AC, SPI=EV/PV.

---

# ЧАСТЬ 3. МОДЕЛЬ ДАННЫХ (ERD + ТАБЛИЦЫ + ПОЛЯ + СВЯЗИ)

> Конвенции Sunset: PK `id UUID UUIDV4`; `companyId UUID NOT NULL field:'company_id'`; аудит `created_by/updated_by` (User), `created_at/updated_at`; деньги — `DECIMAL(18,4)` + `currency` (ISO); все FK — UUID; soft-delete `deleted_at` где нужно. Префикс таблиц `pm_` для изоляции модуля.

## 3.1 ERD (текстовая нотация)

```
pm_portfolios 1───* pm_projects
pm_projects   1───* pm_phases
pm_projects   1───* pm_tasks
pm_phases     1───* pm_tasks
pm_tasks      1───* pm_tasks (parentTaskId, subtasks)
pm_tasks      1───* pm_checklists 1───* pm_checklist_items
pm_tasks      1───* pm_time_entries
pm_tasks      *───* pm_task_dependencies (predecessor/successor)
pm_projects   1───* pm_budgets 1───* pm_budget_lines
pm_projects   1───* pm_project_revenues   (→ Offer/Order/Invoice/Milestone)
pm_projects   1───* pm_project_costs       (→ Purchase/Bill/StockMove/TimeEntry/Expense)
pm_projects   1───* pm_milestones (billing/delivery)
pm_projects   1───* pm_allocations  (→ User/Role)
pm_projects   1───* pm_risks
pm_projects   1───* pm_project_members
pm_projects   1───* pm_comments        (polymorphic: entityType/entityId)
pm_projects   1───* pm_project_events   (event-log/activity)
pm_projects   1───* pm_project_links     (polymorphic → CRM/OMS/WMS/HR/Calendar)
pm_projects   1───* pm_project_documents  (→ documents module)
pm_projects   1───* pm_baselines (snapshot плана для EVM)
pm_rate_cards 1───* pm_rate_card_lines (ставки cost/billing по роли/пользователю)
pm_project_templates 1───* pm_template_items
```

## 3.2 Полный список таблиц (28)

| # | Таблица | Назначение |
|---|---|---|
| 1 | `pm_portfolios` | Портфели проектов (группировка, rollup) |
| 2 | `pm_projects` | Проект — финансовый коллектор |
| 3 | `pm_phases` | Этапы / WBS-узлы |
| 4 | `pm_tasks` | Задачи и подзадачи (self-ref) |
| 5 | `pm_checklists` | Чеклисты задачи |
| 6 | `pm_checklist_items` | Пункты чеклиста |
| 7 | `pm_task_dependencies` | Зависимости FS/SS/FF/SF + lag |
| 8 | `pm_time_entries` | Тайм-трекинг (billable/cost) |
| 9 | `pm_budgets` | Бюджет проекта (версия) |
| 10 | `pm_budget_lines` | Строки бюджета (категория/период, план дох/расх) |
| 11 | `pm_project_revenues` | Доходы план/факт (link на документ) |
| 12 | `pm_project_costs` | Расходы план/факт (link на документ) |
| 13 | `pm_milestones` | Вехи (billing/delivery), % completion |
| 14 | `pm_allocations` | Назначение ресурсов (capacity %) |
| 15 | `pm_project_members` | Команда проекта + роль в проекте |
| 16 | `pm_risks` | Реестр рисков |
| 17 | `pm_comments` | Комментарии (полиморфные) |
| 18 | `pm_project_events` | Activity / event-log |
| 19 | `pm_project_links` | Полиморфные связи с др. модулями |
| 20 | `pm_project_documents` | Привязка документов |
| 21 | `pm_baselines` | Снимки плана (EVM baseline) |
| 22 | `pm_rate_cards` | Тарифные сетки |
| 23 | `pm_rate_card_lines` | Ставки cost/billing по роли/юзеру |
| 24 | `pm_project_templates` | Шаблоны проектов (blueprints) |
| 25 | `pm_template_items` | Состав шаблона (фазы/задачи/чеклисты) |
| 26 | `pm_tags` / `pm_entity_tags` | Теги (опц., можно reuse общий) |
| 27 | `pm_cash_flow_entries` | Прогнозные/факт. движения денег проекта |
| 28 | `pm_forecasts` | Снимки прогноза (EAC/ETC/cash) для трендов |

## 3.3 Ключевые таблицы — поля

### `pm_projects`
| Поле | Тип | Прим. |
|---|---|---|
| id | UUID PK | |
| company_id | UUID NOT NULL | tenant |
| portfolio_id | UUID FK→pm_portfolios | nullable |
| code | STRING(32) | человекочит. номер (PRJ-0001), unique per company |
| name | STRING(255) NOT NULL | |
| description | TEXT | |
| status | ENUM | draft/active/on_hold/completed/cancelled/closed |
| health | ENUM | green/amber/red (авто + ручной override) |
| billing_type | ENUM | fixed_price / time_material / milestone / retainer / non_billable |
| revenue_recognition | ENUM | on_invoice / percent_complete / milestone / on_completion |
| currency | STRING(3) | ISO |
| customer_id | UUID FK→Counterparty | заказчик (CRM) |
| deal_id | UUID FK→Deal | nullable (источник из CRM) |
| owner_id | UUID FK→User | менеджер проекта |
| rate_card_id | UUID FK→pm_rate_cards | по умолчанию |
| planned_start / planned_end | DATE | |
| actual_start / actual_end | DATE | |
| budget_cost / budget_revenue | DECIMAL(18,4) | агрегированный план (денорм.) |
| percent_complete | DECIMAL(5,2) | % завершения |
| is_billable | BOOLEAN | |
| priority | ENUM | low/normal/high/critical |
| custom_fields | JSONB | расширяемость |
| created_by / updated_by | UUID FK→User | |
| created_at / updated_at / deleted_at | DATE | аудит/soft-delete |

### `pm_tasks`
id, company_id, project_id(FK), phase_id(FK null), parent_task_id(FK self null), title, description(TEXT), status(ENUM: todo/in_progress/review/blocked/done/cancelled), priority, assignee_id(FK→User), reporter_id, **estimate_hours**(DECIMAL), **logged_hours**(денорм), **billable**(BOOL), planned_start, planned_end(due), actual_start, completed_at, percent_complete, sort_order(INT), **is_milestone**(BOOL), color, labels(JSONB), custom_fields(JSONB), created_by/updated_by/created_at/updated_at/deleted_at.

### `pm_time_entries`
id, company_id, project_id, task_id(null), user_id, **date**, **hours**(DECIMAL(8,2)), description, **billable**(BOOL), **cost_rate**(DECIMAL snapshot из rate_card), **billing_rate**(DECIMAL snapshot), **cost_amount**(hours×cost_rate, денорм), **billing_amount**(hours×billing_rate), status(ENUM: draft/submitted/approved/rejected/invoiced), approved_by, invoice_id(FK→Invoice null), source(manual/timer), created_at...

### `pm_budgets` / `pm_budget_lines`
- budgets: id, company_id, project_id, version(INT), name, status(draft/approved/archived), is_active, total_revenue, total_cost, approved_by, created_at.
- budget_lines: id, company_id, budget_id, project_id, **type**(revenue/cost), **category**(labor/material/subcontract/equipment/travel/overhead/other), phase_id(null), period_month(DATE, для cash-распределения), **planned_amount**(DECIMAL), currency, notes, created_at.

### `pm_project_revenues`
id, company_id, project_id, milestone_id(null), **kind**(planned/actual/recognized), **amount**, currency, **source_type**(ENUM: offer/order/invoice/manual/milestone), **source_id**(UUID polymorphic), recognized_at, due_date, status, description, created_at.

### `pm_project_costs`
id, company_id, project_id, phase_id(null), task_id(null), **kind**(planned/committed/actual), **category**(labor/material/subcontract/...), **amount**, currency, **source_type**(ENUM: purchase/bill/stock_move/time_entry/expense/manual), **source_id**(UUID polymorphic), incurred_at, due_date, status, description, created_at.
> `committed` строки создаются из открытых PO (closurl при поставке/оплате → переходят в actual).

### `pm_milestones`
id, company_id, project_id, name, due_date, **billing_amount**(DECIMAL), **percent_weight**(вклад в %complete), status(pending/reached/invoiced/paid), reached_at, invoice_id(null), created_at.

### `pm_allocations` (Resource & Capacity Planning)
id, company_id, project_id, user_id(null)/role(STRING для «бронь до назначения»), **allocation_percent**(0–100), **start_date**, **end_date**, **hours_per_day**(DECIMAL), cost_rate, billing_rate, status(planned/confirmed), created_at.
> Capacity сотрудника = его рабочий календарь (HR) − сумма allocation по проектам → overallocation алерт.

### `pm_risks`
id, company_id, project_id, title, description, **probability**(low/med/high или 1–5), **impact**(1–5), **score**(prob×impact, денорм), category(financial/technical/resource/schedule/external), **status**(open/mitigating/closed/occurred), **mitigation_plan**(TEXT), owner_id, due_date, created_at.

### `pm_project_links` (полиморфная интеграция)
id, company_id, project_id, **entity_type**(ENUM: counterparty/contact/deal/offer/order/invoice/payment/purchase/shipment/receipt/stock_move/product/employee/calendar_event/document/chat), **entity_id**(UUID), relation(STRING: source/billing/delivery/related), created_by, created_at. Уникальность (project_id, entity_type, entity_id, relation).

### `pm_project_events` (event-log, как `orderevent`)
id, company_id, project_id, **event_type**(STRING: project.created/status.changed/task.completed/budget.approved/cost.posted/risk.raised/...), **actor_id**(User), **payload**(JSONB), entity_type, entity_id, created_at. → источник Activity-ленты и SSE.

### `pm_cash_flow_entries`
id, company_id, project_id, **direction**(inflow/outflow), **kind**(forecast/actual), amount, currency, **expected_date**, source_type, source_id, status, created_at.

### `pm_baselines` + `pm_forecasts`
- baselines: id, company_id, project_id, name, snapshot(JSONB: план дат/бюджета/EV-базы), is_current, created_by, created_at.
- forecasts: id, company_id, project_id, as_of_date, **eac_cost**, **etc_cost**, **eac_revenue**, **forecast_margin**, cpi, spi, method(linear/ai), payload(JSONB), created_at.

### `pm_rate_cards` / `pm_rate_card_lines`
- rate_cards: id, company_id, name, currency, is_default, valid_from/to.
- rate_card_lines: id, company_id, rate_card_id, **role**(STRING)/user_id(null), **cost_rate**, **billing_rate**, unit(hour/day), valid_from/to.

### `pm_project_templates` / `pm_template_items`
- templates: id, company_id, name, description, billing_type, default_budget(JSONB), created_by.
- template_items: id, company_id, template_id, item_type(phase/task/checklist), parent_ref(STRING для дерева), title, estimate_hours, offset_days(relative scheduling), sort_order.

## 3.4 Sequelize-модель (пример, в стиле репо)

```js
// server/src/models/pm/project.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Project extends Model {
    static associate(models) {
      Project.belongsTo(models.Company, { as: 'company', foreignKey: 'companyId' });
      Project.belongsTo(models.Portfolio, { as: 'portfolio', foreignKey: 'portfolioId' });
      Project.belongsTo(models.Counterparty, { as: 'customer', foreignKey: 'customerId' });
      Project.belongsTo(models.User, { as: 'owner', foreignKey: 'ownerId' });
      Project.belongsTo(models.User, { as: 'createdByUser', foreignKey: 'createdBy' });
      Project.hasMany(models.Phase, { as: 'phases', foreignKey: 'projectId', onDelete: 'CASCADE' });
      Project.hasMany(models.Task, { as: 'tasks', foreignKey: 'projectId', onDelete: 'CASCADE' });
      Project.hasMany(models.Budget, { as: 'budgets', foreignKey: 'projectId' });
      Project.hasMany(models.ProjectRevenue, { as: 'revenues', foreignKey: 'projectId' });
      Project.hasMany(models.ProjectCost, { as: 'costs', foreignKey: 'projectId' });
      Project.hasMany(models.Allocation, { as: 'allocations', foreignKey: 'projectId' });
      Project.hasMany(models.Risk, { as: 'risks', foreignKey: 'projectId' });
      Project.hasMany(models.ProjectLink, { as: 'links', foreignKey: 'projectId' });
    }
  }
  Project.init({
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.UUID, allowNull: false, field: 'company_id' },
    portfolioId: { type: DataTypes.UUID, field: 'portfolio_id' },
    code: { type: DataTypes.STRING(32), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    status: { type: DataTypes.ENUM('draft','active','on_hold','completed','cancelled','closed'), defaultValue: 'draft' },
    billingType: { type: DataTypes.ENUM('fixed_price','time_material','milestone','retainer','non_billable'), field: 'billing_type', defaultValue: 'time_material' },
    revenueRecognition: { type: DataTypes.ENUM('on_invoice','percent_complete','milestone','on_completion'), field: 'revenue_recognition', defaultValue: 'on_invoice' },
    currency: { type: DataTypes.STRING(3), defaultValue: 'PLN' },
    customerId: { type: DataTypes.UUID, field: 'customer_id' },
    dealId: { type: DataTypes.UUID, field: 'deal_id' },
    ownerId: { type: DataTypes.UUID, field: 'owner_id' },
    budgetCost: { type: DataTypes.DECIMAL(18,4), field: 'budget_cost', defaultValue: 0 },
    budgetRevenue: { type: DataTypes.DECIMAL(18,4), field: 'budget_revenue', defaultValue: 0 },
    percentComplete: { type: DataTypes.DECIMAL(5,2), field: 'percent_complete', defaultValue: 0 },
    health: { type: DataTypes.ENUM('green','amber','red'), defaultValue: 'green' },
    customFields: { type: DataTypes.JSONB, field: 'custom_fields' },
    createdBy: { type: DataTypes.UUID, field: 'created_by' },
    updatedBy: { type: DataTypes.UUID, field: 'updated_by' },
  }, {
    sequelize, modelName: 'Project', tableName: 'pm_projects',
    underscored: true, paranoid: true, timestamps: true,
    indexes: [
      { fields: ['company_id'] },
      { unique: true, fields: ['company_id','code'] },
      { fields: ['company_id','status'] },
      { fields: ['company_id','customer_id'] },
    ],
  });
  return Project;
};
```

---

# ЧАСТЬ 4. BACKEND / API / EVENTS / ACL

## 4.1 Слои (по конвенции Sunset)
```
routes/pm/*.js     → Express router, requireMember(permission)
controllers/pm/*   → тонкие, asyncHandler(controller)
services/pm/*      → бизнес-логика + DB; финансовые расчёты; транзакции
models/pm/*        → Sequelize
```
Ключевые сервисы:
- `projectService` — CRUD, статус-машина, rollup-агрегаты, provisioning из шаблона/сделки.
- `taskService` — задачи/подзадачи, зависимости, %complete пересчёт вверх по дереву.
- `timeService` — учёт времени, approval, расчёт cost/billing amount по rate-card.
- `budgetService` — версии бюджета, утверждение, availability control (блок трат).
- `financeService` — P&L, маржа, committed/actual из источников, recognition.
- `cashFlowService` — прогноз поступлений/выплат по due-датам.
- `resourceService` — allocation, capacity, utilization, overallocation.
- `forecastService` — EVM (CPI/SPI), EAC/ETC, тренды (Phase 3/4 + AI).
- `riskService`, `templateService`, `linkService`, `projectEventService`.

## 4.2 REST API (срез)
```
# Projects
GET    /api/pm/projects?status=&customerId=&q=&page=
POST   /api/pm/projects
GET    /api/pm/projects/:id
PATCH  /api/pm/projects/:id
POST   /api/pm/projects/:id/transition        {to: 'active'}
POST   /api/pm/projects/from-template/:tplId
POST   /api/pm/projects/from-deal/:dealId

# Structure
GET/POST   /api/pm/projects/:id/phases
GET/POST   /api/pm/projects/:id/tasks         (?view=board|list|gantt)
PATCH      /api/pm/tasks/:id
POST       /api/pm/tasks/:id/subtasks
POST       /api/pm/tasks/:id/dependencies
GET/POST   /api/pm/tasks/:id/checklists
POST       /api/pm/checklists/:id/items

# Time
GET/POST   /api/pm/time-entries
POST       /api/pm/time-entries/:id/submit | /approve | /reject
POST       /api/pm/projects/:id/time/invoice   (billable→draft invoice)

# Finance
GET    /api/pm/projects/:id/budgets ; POST .../budgets ; POST .../budgets/:id/approve
GET    /api/pm/projects/:id/pnl?asOf=
GET    /api/pm/projects/:id/cashflow?granularity=week|month
GET    /api/pm/projects/:id/forecast            (EVM/EAC)
GET    /api/pm/projects/:id/revenues | /costs
POST   /api/pm/projects/:id/milestones/:mid/invoice

# Resources
GET    /api/pm/resources/capacity?from=&to=&userId=
GET/POST/api/pm/projects/:id/allocations
GET    /api/pm/resources/utilization

# Aux
GET/POST   /api/pm/projects/:id/risks | /comments | /links | /documents
GET        /api/pm/portfolios/:id/rollup
GET        /api/pm/projects/:id/dashboard        (агрегированный payload)
POST       /api/pm/projects/:id/ai/ask           (AI-помощник)
```

## 4.3 Event-driven архитектура
- **Внутренние domain-events** пишутся в `pm_project_events` транзакционно вместе с изменением (outbox-паттерн). Типы: `project.created/updated/status_changed`, `task.created/assigned/completed`, `time.logged/approved`, `budget.approved/exceeded`, `cost.committed/posted`, `revenue.recognized`, `milestone.reached/invoiced`, `risk.raised/closed`, `allocation.overbooked`.
- **Реакции (подписчики):**
  - `task.completed` → пересчёт %complete фазы/проекта → пересчёт EV/health.
  - `time.approved` → создание `pm_project_costs(kind=actual, source=time_entry)`.
  - **OMS-интеграция (входящие):** `invoice.issued` (есть проектный link) → `pm_project_revenues(actual/recognized)` + cash inflow. `order.created from offer` с проектом → planned revenue.
  - **WMS:** `stock_move.posted` с project link → `pm_project_costs(actual, material)` по себестоимости (costlayer).
  - **Purchases:** `purchase.approved` → committed cost; `bill.received` → actual cost.
  - `budget.exceeded` / `allocation.overbooked` → нотификация + health=red.
- **Транспорт наружу:** существующий **SSE** (`/api/sse`) → RTK Query tag-инвалидация (`Project`, `PmTask`, `ProjectFinance`, `Allocation`). В `realtime.js` маппинг сущностей→тегов.
- **Шина:** на старте — синхронные доменные хендлеры в сервисах + outbox-таблица событий; масштабирование позже на очередь (BullMQ/pg-boss) без смены контракта (события уже нормализованы).

## 4.4 Permissions / ACL
Используем существующий `requireMember` + ACL (`aclApi`). Новые permission-узлы:
```
pm.project.view / create / update / delete / transition
pm.task.view / manage / assign
pm.time.log / time.approve
pm.finance.view / budget.manage / budget.approve
pm.cost.view / revenue.view
pm.resource.view / allocate
pm.risk.manage
pm.template.manage
pm.portfolio.view
pm.admin           (rate cards, settings)
```
- **Field-level:** финансовые поля (cost_rate, P&L, маржа) скрываются без `pm.finance.view` — сервис вырезает их из DTO (как DTO-enrichment в WMS).
- **Row-level:** видимость проекта = член `pm_project_members` ИЛИ роль с `pm.project.view:all`. «Свои проекты» vs «все».
- **Client-portal (Phase 4):** ограниченная роль заказчика — только свой проект, без costs/маржи.
- Всё, как везде в Sunset, под `companyIdGuard` (tenant-изоляция).

---

# ЧАСТЬ 5. FRONTEND / DASHBOARD / KPI / ОТЧЁТЫ

## 5.1 Структура (по конвенции)
```
client/src/pages/Projects/
  ProjectsListPage/          (List/Board/Portfolio views, фильтры — reuse ListPage)
  ProjectDetailPage/
    tabs: Overview | Tasks | Gantt | Finance | Time | Resources | Risks | Files | Activity
  ProjectCreatePage/         (из шаблона / из сделки / с нуля)
  ResourcePlanningPage/      (capacity heatmap)
  PortfolioDashboardPage/
client/src/store/rtk/
  projectsApi.js  pmTasksApi.js  pmTimeApi.js  pmFinanceApi.js  pmResourcesApi.js
client/src/components/projects/
  GanttChart/  KanbanBoard/  PnLWidget/  CashFlowChart/  BurnChart/  CapacityHeatmap/
  EvmGauge/  RiskMatrix/  TimerWidget/  ProjectHealthBadge/
```
- Один источник данных → несколько view (List/Board/Gantt/Calendar) — по образцу ClickUp, на одних RTK-данных.
- Tag-инвалидация через SSE `realtime.js` (как в остальных модулях).
- i18n ключи в `{en,pl,ru,ua}.json` (все 4 файла).

## 5.2 Dashboard проекта (Overview-таб)
Блоки:
1. **Health & Progress:** health-badge, %complete, дни до дедлайна, статус.
2. **Financial summary:** Budget vs Actual (revenue/cost), Margin %, Committed, P&L mini.
3. **EVM-гейдж:** CPI / SPI, EAC vs Budget.
4. **Cash Flow sparkline:** inflow/outflow forecast 8 недель.
5. **Burn-up/Burn-down** задач и бюджета.
6. **Team load:** utilization участников.
7. **Risks:** топ-риски по score (матрица 5×5).
8. **Activity feed** (event-log) + комментарии.
9. **AI-инсайт:** «проект отстаёт на 6%, при текущем CPI=0.88 прогноз перерасхода 12 400 PLN».

## 5.3 KPI проекта
| KPI | Формула |
|---|---|
| % Complete | Σ(weighted task/milestone progress) |
| Schedule Variance (SPI) | EV / PV |
| Cost Variance (CPI) | EV / AC |
| Gross Margin % | (Revenue − Cost) / Revenue |
| Budget Utilization | AC / Budget Cost |
| Billable Utilization | billable hours / capacity hours |
| Realization rate | billed amount / (logged hours × billing rate) |
| Forecast margin (EAC) | (EAC revenue − EAC cost)/EAC revenue |
| Cash position | Σ inflow(actual) − Σ outflow(actual) |
| Risk exposure | Σ(prob×impact×cost) открытых рисков |
| On-time delivery | завершено в срок / всего вех |

## 5.4 Финансовые отчёты
1. **Project P&L** (план/факт/отклонение по категориям).
2. **Portfolio profitability** (rollup маржи по проектам/клиентам/менеджерам).
3. **Cash Flow forecast** (по неделям/месяцам, drill-down до документа).
4. **WIP & Backlog** (незавершённое производство, невыставленная выручка).
5. **Time & Billing** (billable vs non-billable, realization).
6. **Resource utilization** (по сотрудникам/ролям).
7. **Budget vs Actual vs Committed** (с availability control).
8. **EVM report** (PV/EV/AC, CPI/SPI тренды).
9. **Revenue recognition schedule** (признанная/отложенная выручка).

---

# ЧАСТЬ 6. ROADMAP — ФАЗЫ

## Phase 1 — MVP: «Операционное ядро + бюджет»
**Цель:** проекты/этапы/задачи/время/базовый бюджет и связь с CRM/инвойсами; primitive P&L.
- **Таблицы:** portfolios, projects, phases, tasks, checklists, checklist_items, time_entries, budgets, budget_lines, project_members, comments, project_events, project_links, project_documents.
- **API:** CRUD проектов/фаз/задач/чеклистов; time-entries + submit/approve; budgets + approve; links; dashboard payload (без EVM).
- **Сервисы:** projectService, taskService, timeService, budgetService, projectEventService, linkService.
- **UI:** ProjectsList (List+Board), ProjectDetail (Overview/Tasks/Time/Budget/Files/Activity), Kanban, базовый Budget vs Actual виджет, таймер.
- **Интеграции:** CRM (deal→project, customer link), документы/файлы (existing module), инвойсы (link invoice→project, actual revenue), SSE-инвалидация, ACL-узлы, i18n×4.
- **Риски:** объём; пересчёт %complete вверх по дереву; гонки таймера/SSE; миграции под `pm_` без конфликтов.
- **Definition of done:** можно вести проект, логировать время, видеть план/факт расходов по бюджету и факт. выручку из инвойсов.

## Phase 2 — «Полноценные финансы проекта»
**Цель:** настоящий P&L, costing из всех источников, milestone-billing, billable→invoice.
- **Таблицы:** project_revenues, project_costs, milestones, rate_cards, rate_card_lines, cash_flow_entries.
- **API:** /pnl, /cashflow, /revenues, /costs, milestone invoice, time→invoice, rate-cards CRUD.
- **Сервисы:** financeService (committed/actual/recognition), cashFlowService, rate-card расчёт в timeService.
- **UI:** Finance-таб (P&L, маржа, committed), CashFlowChart, milestone-биллинг, billable→draft invoice, finance field-level ACL.
- **Интеграции:** OMS (invoice/order/offer events→revenue), WMS (stock_move cost→material cost), Purchases (PO→committed, bill→actual), HR (cost rate сотрудника).
- **Риски:** корректность recognition; мультивалютность; идемпотентность событий (двойной cost); согласованность денорм-агрегатов.

## Phase 3 — «Планирование ресурсов, прогноз, риски»
**Цель:** capacity/resource planning, EVM, forecasting, риски, Gantt с зависимостями, baselines.
- **Таблицы:** allocations, risks, task_dependencies, baselines, forecasts.
- **API:** /resources/capacity, /utilization, allocations CRUD, /forecast (EVM), dependencies, baseline snapshot.
- **Сервисы:** resourceService (capacity/overallocation), forecastService (CPI/SPI/EAC/ETC), riskService.
- **UI:** Gantt (critical path, зависимости), CapacityHeatmap, EvmGauge, RiskMatrix, baseline-сравнение, Portfolio dashboard rollup.
- **Интеграции:** HR (рабочий календарь→capacity, ставки), Calendar (вехи/дедлайны→события), availability control (блок трат сверх бюджета).
- **Риски:** алгоритмы leveling/critical path; точность capacity при отпусках/частичной занятости; производительность rollup по портфелю.

## Phase 4 — «AI, автоматизация, портал, инновации»
**Цель:** AI-помощник, шаблоны/automations, client-portal, killer-features.
- **Таблицы:** project_templates, template_items, (+ automations/rules, ai_insights — опц.).
- **API:** /ai/ask, /ai/forecast, from-template provisioning, automation rules, client-portal scoped endpoints.
- **Сервисы:** templateService, automationEngine, aiProjectService (RAG над событиями/финансами проекта, Claude API).
- **UI:** AI-панель, конструктор дашбордов (Monday-style), automation-builder, client-portal (scoped role).
- **Интеграции:** Claude API (прогноз/риски/саммари), уведомления, очередь событий (BullMQ/pg-boss) для масштаба.
- **Риски:** качество/безопасность AI-прогнозов (galлюцинации в деньгах → только как рекомендации + объяснимость); приватность данных в client-portal; стоимость токенов (кэширование).

---

# ЧАСТЬ 7. KILLER-FEATURES (чего нет у конкурентов)

1. **Live Project P&L из первичных документов.** P&L не вводится — он автоматически собирается из offers/orders/invoices/purchases/stock-moves/timesheets Sunset в реальном времени. Ни Monday/ClickUp/Asana, ни даже Odoo не дают цельную картину «из коробки» без ручной аналитики.

2. **Project Cash Flow Radar.** Прогноз денежного потока именно по проекту (поступления по due-датам инвойсов/вех − выплаты по bills/payroll/PO) с предупреждением о кассовом разрыве за N недель. У PM-инструментов этого нет вовсе, у ERP — только на уровне всей компании.

3. **Availability Control (из SAP, но дружелюбно).** Мягкая/жёсткая блокировка создания закупки/расхода, если пробивает утверждённый бюджет фазы — с workflow «запросить увеличение бюджета». Превращает бюджет из отчёта в реальный контроль.

4. **Commitment-aware costing.** Открытые PO сразу видны как «зарезервированные деньги» (committed) до факта — менеджер видит реальную доступную сумму, а не только оплаченное.

5. **AI Project Co-pilot (Claude).** Контекст = события + финансы + риски проекта. Делает: еженедельный health-summary, объяснимый forecast («перерасход из-за 3 задач с CPI<0.8»), черновик статус-репорта клиенту, выявление рисков из паттернов, «что будет если» сценарии.

6. **Capacity-to-Cash в одном экране.** Связь «загрузка людей → биллабл-часы → выручка → маржа»: видно не только кто перегружен, но и сколько денег приносит/стоит каждый час. Teamwork близок, но без WMS/закупок.

7. **One-click provisioning из сделки.** Выигранная сделка CRM → проект с фазами/бюджетом/командой по шаблону, перенос оферты в planned revenue. Бесшовный CRM→Project→Invoice пайплайн внутри одной БД (преимущество над Zoho, где Projects и Books разнесены).

8. **Inventory-linked project costing.** Списание материалов со склада (WMS costlayer) автоматически ложится в фактическую себестоимость проекта по реальной себестоимости партии — уникально для платформы с встроенным WMS.

9. **Retainer / recurring projects** с автопролонгацией бюджета и burn-алертами (из Teamwork) — для абонентского/сервисного бизнеса.

10. **Explainable EVM.** CPI/SPI не как «голые цифры», а с drill-down до задач/строк затрат, которые тянут проект вниз, + AI-объяснение и рекомендация.

---

## Резюме архитектурных решений
- **28 таблиц** с префиксом `pm_`, полностью в конвенциях Sunset (UUID, `companyId`, `field:` snake_case, `associate()`, paranoid).
- **Финансовое ядро = коллектор** (WBS/analytic-account идея): план/committed/actual из реальных документов, не ручной ввод.
- **Event-driven через outbox `pm_project_events` + существующий SSE**, готово к выносу в очередь.
- **ACL поверх `requireMember`/`aclApi`**, field-level для финансов, row-level для членства, client-portal в Phase 4.
- **4 фазы:** MVP (операционка+бюджет) → Финансы (P&L/cash/billing) → Ресурсы/EVM/риски → AI/портал/automations.
- **Дифференциатор:** live P&L + project cash-flow + availability control + AI co-pilot + inventory-linked costing — комбинация, которой нет ни у одного конкурента.
