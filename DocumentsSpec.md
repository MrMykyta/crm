

# DOCUMENT MODULE SPEC (CRM)

## 1. OVERVIEW

Модуль документов — это ядро CRM, отвечающее за:
- создание коммерческих предложений
- управление заказами
- выставление счетов (faktura / invoice / bill / receipt)
- работу с договорами
- конвертацию документов между этапами

Система должна быть универсальной, расширяемой и пригодной для:
- e-commerce
- услуг
- B2B
- склада

---

## 2. DOCUMENT TYPES

Поддерживаемые типы:

- QUOTE (предложение)
- ORDER (заказ)
- INVOICE (фактура)
- BILL (счёт)
- RECEIPT (чек)
- CONTRACT (договор)

---

## 3. DOCUMENT STRUCTURE

Основная сущность: Document

id  
companyId  

type  
direction (sale / purchase)  
status  

number  

clientId  
contactId  

issueDate  

validFrom  
validTo  
validDays  

paymentDueDate  
paymentDays  

paymentStatus  
paidAmount  
remainingAmount  

currency  
language  
template  

notes  
internalNotes  

sourceDocumentId  
sourceDocumentType  

relatedDealId  
warehouseId  
ownerId  

totalNet  
totalVat  
totalGross  
totalDiscount  

createdBy  
updatedBy  
createdAt  
updatedAt  

---

## 4. DOCUMENT ITEMS

Сущность: DocumentItem

id  
documentId  
sortOrder  

productId  

name  
sku  
ean  

pkwiu  
cn  
gtu  

itemType (product / service / delivery / custom / note)  

quantity  
unit  

unitNet  
unitGross  
vatRate  

discountPercent  
discountValue  

sumNet  
sumVat  
sumGross  

warehouseId  
comment  

createdAt  
updatedAt  

---

## 5. PAYMENT MODEL

DocumentPayment

id  
documentId  

status  
method  

amount  
paidAt  
reference  

createdAt  
updatedAt  

---

## 6. DOCUMENT STATUS LOGIC

QUOTE:
- draft
- active
- sent
- accepted
- rejected
- expired

ORDER:
- draft
- pending
- confirmed
- in_progress
- completed
- canceled

INVOICE / BILL / RECEIPT:
- draft
- issued
- sent
- partially_paid
- paid
- overdue
- canceled

CONTRACT:
- draft
- active
- signed
- terminated
- archived

---

## 7. DOCUMENT FLOW

QUOTE -> ORDER -> INVOICE  
QUOTE -> INVOICE  
ORDER -> INVOICE  
DRAFT -> FINAL  

Требования:
- сохраняется связь между документами
- позиции копируются
- суммы сохраняются
- фиксируется источник документа

---

## 8. UNITS SYSTEM

Базовые единицы:

szt  
kg  
g  
l  
ml  
m  
cm  
mm  
m2  
m3  
opak  
komplet  
usługa  
godz  
dzień  

Структура единицы:

code  
label  
type  
precision  
baseUnit  
conversionFactor  

Примеры:

g -> base kg -> 0.001  
ml -> base l -> 0.001  
mm -> base m -> 0.001  

Важно:
- хранить пользовательскую единицу
- не менять отображение автоматически
- формат зависит от выбранной единицы

---

## 9. CALCULATIONS

sumNet = quantity * unitNet  
sumVat = sumNet * vatRate  
sumGross = sumNet + sumVat  

Учитывать:
- скидки
- округление
- VAT
- точность

---

## 10. TOTALS

totalNet  
totalVat  
totalGross  
totalDiscount  
paidAmount  
remainingAmount  

Дополнительно:
VAT breakdown:
- 23%
- 8%
- 5%
- 0%
- zw
- np

---

## 11. NUMBERING SYSTEM

Формат:

PREFIX/YEAR/NUMBER  

Примеры:

FV/2026/0001  
OFF/2026/0023  
ORD/2026/0104  

Требования:
- отдельная последовательность для каждого типа
- авто + ручной режим
- поддержка периодов

---

## 12. VALIDATION RULES

- документ должен иметь тип
- sale документ должен иметь клиента
- документ должен иметь позиции (кроме contract)
- даты не должны конфликтовать
- суммы не могут быть отрицательными
- quantity > 0

---

## 13. AUTOFILL LOGIC

Клиент:
- подтягиваются реквизиты
- контакты
- данные для документа

Товар:
- name
- sku
- ean
- unit
- vat
- price
- pkwiu/cn/gtu

---

## 14. API CONTRACT

POST /documents  
GET /documents/:id  
PUT /documents/:id  

POST /documents/:id/convert  
POST /documents/:id/preview  
POST /documents/:id/send  
POST /documents/:id/save-draft  

---

## 15. SECURITY

- multi-tenant через companyId
- проверка доступа
- backend валидация
- не доверять фронту

---

## 16. UI/UX PRINCIPLES

- минимальное количество кликов
- inline редактирование
- быстрый ввод
- preview всегда виден
- понятная структура
- enterprise UX

---

## 17. FUTURE EXTENSIONS

- PDF generator
- email sending
- templates
- document history
- audit log
- warehouse integration
- payment integration
- automation

---

## 18. RESULT

Модуль должен стать:
- ядром CRM
- основой продаж
- основой финансов
- расширяемой системой под любой бизнес