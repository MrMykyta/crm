
# KSEF_INTEGRATION_PLAN

## 1. Goal

Integration of Sunset CRM/ERP with the Polish KSeF (Krajowy System e-Faktur).

Goals:
- automatic invoice submission to KSeF
- obtaining official KSeF numbers
- status tracking
- submission history
- multi-company support
- compliance with Polish regulations

## 2. Architecture Principles

KSeF must not directly affect:
- CRM
- PIM
- WMS
- OMS

KSeF operates on top of the Invoice module.

Flow:
Invoice
→ XML Generator
→ KSeF Submission Queue
→ KSeF API
→ Status Poller
→ Invoice Status Update

## 3. Invoice Lifecycle

Current:
Draft → Issued

Future:
Draft
→ Issued
→ QueuedForKsef
→ SentToKsef
→ AcceptedByKsef

or

Draft
→ Issued
→ QueuedForKsef
→ SentToKsef
→ RejectedByKsef

## 4. Invoice Statuses

Invoice.status:
- draft
- issued
- cancelled

Invoice.ksefStatus:
- disabled
- queued
- sending
- sent
- accepted
- rejected

## 5. Database Changes

### invoices

Add:
- ksef_status
- ksef_reference_number
- ksef_invoice_number
- ksef_sent_at
- ksef_accepted_at
- ksef_rejected_at
- ksef_last_error

### ksef_submissions

Fields:
- id
- company_id
- invoice_id
- status
  - queued
  - sent
  - accepted
  - rejected
- request_xml
- response_payload
- ksef_reference_number
- ksef_invoice_number
- sent_at
- accepted_at
- retry_count
- created_at
- updated_at

### ksef_events

Fields:
- id
- company_id
- invoice_id
- submission_id
- event_type
  - queued
  - sent
  - accepted
  - rejected
  - retry
- payload
- created_at

## 6. XML Generator

New module:
services/ksef/xmlGenerator.js

Input:
- Invoice
- InvoiceItems
- Company
- Counterparty

Output:
- KSeF FA XML

Support versioned schemas:
- FA(3)
- FA(4)
- future versions

## 7. Sandbox Integration

Environments:
- sandbox
- production

Features:
- authenticate
- send invoice
- check status
- download UPO

## 8. Production Integration

Company Settings → KSeF

Settings:
- enabled
- environment (sandbox / production)
- token
- certificate
- autoSendInvoices

## 9. Security

Requirements:
- encrypted token storage
- encrypted certificate storage
- secrets outside source code
- audit logging

Do not store sensitive credentials in plain text.

## 10. Retry Strategy

If KSeF is unavailable:

Invoice → queued

Retries:
- 1 minute
- 5 minutes
- 15 minutes
- 1 hour

After max retries:
- ksefStatus = rejected
- manual intervention required

## 11. Multi Company Support

Every company has its own:
- token
- certificate
- environment
- queue
- submission history

Isolation by companyId is mandatory.

## 12. OMS Integration

Invoice Issue:
Issued
→ create InvoiceItems snapshot
→ queue KSeF submission

KSeF must use Invoice + InvoiceItems only.

Never read OrderItems directly.

## 13. WMS Integration

No direct integration.

WMS affects Orders.
Orders affect Invoices.
KSeF works only with invoices.

## 14. Monitoring

KSeF Dashboard:
- queued invoices
- accepted invoices
- rejected invoices
- last synchronization
- sandbox/production status

## 15. Phased Implementation

### KSEF-1 Foundation
- DB schema
- invoice fields
- ksef_submissions
- ksef_events

### KSEF-2 XML Generator
Invoice → XML generation

### KSEF-3 Sandbox
- authentication
- send
- status
- UPO

### KSEF-4 Production
Production integration

### KSEF-5 Automation
Invoice
→ Issue
→ Queue
→ Send
→ Accepted

## 16. Dependencies

Required before KSeF:
- OMS Line Item Refactor (A1-A5)
- InvoiceItems
- Snapshot Architecture
- Invoice Lifecycle Stabilization

## 17. Future Extensions

- Credit Notes
- Corrective Invoices
- KSeF Inbox
- Supplier Invoice Import
- Purchase Documents
- Automatic Reconciliation
- OCR + KSeF Hybrid Flow

## 18. KSeF Inbox (Future High Priority)

Inbound supplier invoices from KSeF.

Flow:
KSeF Inbox
→ Supplier Invoice Import
→ Purchase Invoice
→ Receipt/PZ suggestion
→ Accounting reconciliation

Potential future automation:
- supplier matching
- counterparty auto-creation
- purchase order matching
- inventory receipt proposals
- accounting export