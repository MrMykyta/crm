export interface DataContextCompany {
  name?: string
  legalName?: string
  displayName?: string
  nip?: string
  regon?: string
  krs?: string
  bdo?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  postalCode?: string
  country?: string
  phone?: string
  email?: string
  website?: string
  bankAccount?: string
  bankName?: string
  swift?: string
  logoUrl?: string
  stampUrl?: string
  vatPayer?: boolean
  vatExemptReason?: string
}

export interface DataContextCounterpartyAddress {
  line1?: string
  line2?: string
  city?: string
  postalCode?: string
  country?: string
}

export interface DataContextCounterparty {
  name?: string
  legalName?: string
  displayName?: string
  nip?: string
  regon?: string
  type?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  postalCode?: string
  country?: string
  address?: {
    billing?: DataContextCounterpartyAddress
    delivery?: DataContextCounterpartyAddress
  }
  phone?: string
  email?: string
  contractNumber?: string
  salesRepName?: string
}

export interface DataContextDocumentType {
  key?: string
  displayName?: string
}

export interface DataContextDocument {
  number?: string
  type?: string
  typeLabel?: string
  issueDate?: string
  saleDate?: string
  servicePeriodFrom?: string
  servicePeriodTo?: string
  dueDate?: string
  currency?: string
  exchangeRate?: number
  exchangeRateDate?: string
  referenceNumber?: string
  poNumber?: string
  notes?: string
  privateNotes?: string
  status?: string
  ksefNumber?: string
  ksefDate?: string
  paymentTerms?: string
}

export interface DataContextPayment {
  method?: string
  methodLabel?: string
  dueDate?: string
  daysNet?: number
  bankAccount?: string
  bankName?: string
  paid?: number
  outstanding?: number
  qrPayload?: string
  ksefPaymentRef?: string
}

export interface DataContextVatRateLine {
  rate?: number
  net?: number
  vat?: number
  gross?: number
}

export interface DataContextTotals {
  net?: number
  vat?: number
  gross?: number
  grossInWords?: string
  byVatRate?: DataContextVatRateLine[]
  discountTotal?: number
  priceBeforeDiscount?: number
}

export interface DataContextItem {
  lp?: number
  name?: string
  description?: string
  sku?: string
  ean?: string
  quantity?: number
  unit?: string
  unitNetPrice?: number
  unitGrossPrice?: number
  discountPct?: number
  discountAmount?: number
  vatRate?: number
  vatRateLabel?: string
  netAmount?: number
  vatAmount?: number
  grossAmount?: number
  warehouseCode?: string
  batchNumber?: string
  expiryDate?: string
}

export interface DataContextWarehouseNode {
  name?: string
  code?: string
  address?: string
}

export interface DataContextWarehouse {
  source?: DataContextWarehouseNode
  destination?: DataContextWarehouseNode
  moveType?: string
  moveReason?: string
  operator?: {
    name?: string
    position?: string
  }
}

export interface DataContextShipment {
  carrier?: string
  vehiclePlate?: string
  driverName?: string
  deliveryDate?: string
  deliveryMethod?: string
  trackingNumber?: string
}

export interface DataContextSignatures {
  issuer?: {
    name?: string
    position?: string
    signatureUrl?: string
  }
  receiver?: {
    name?: string
    position?: string
    signatureUrl?: string
  }
  signedAt?: string
}

export interface DataContextUser {
  name?: string
  email?: string
  position?: string
  department?: string
}

export interface DataContextComputed {
  totals?: DataContextTotals
  document?: {
    age?: number
  }
  payment?: {
    isOverdue?: boolean
    daysOverdue?: number
  }
}

export interface DataContext {
  company: DataContextCompany
  counterparty: DataContextCounterparty
  documentType?: DataContextDocumentType
  document: DataContextDocument
  payment: DataContextPayment
  totals: DataContextTotals
  items: DataContextItem[]
  warehouse: DataContextWarehouse
  shipment: DataContextShipment
  signatures: DataContextSignatures
  user: DataContextUser
  computed: DataContextComputed
}
