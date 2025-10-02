// src/config/menu.js
import {
  Star,
  Home,
  Building2,
  Sprout,
  Users,
  LineChart,
  CheckSquare,
  Calendar,
  FileText,
  Package,
  ClipboardList,
  Tag,
  Ticket,
  Truck,
  ShoppingBag,
  Wrench,
  Warehouse,
  File,
  Settings,
} from "lucide-react";

export const MENU = [
  { key: "bookmarks", icon: Star, labelKey: "menu.bookmarks", type: "section" },

  // "Главная" → сразу в контрагентов
  { key: "pulpit", icon: Home, labelKey: "menu.pulpit", route: "/main/pulpit", type: "item" },

  { key: "crm", icon: Users, labelKey: "menu.crm", type: "section" },
  { key: "counterparties", icon: Building2, labelKey: "menu.counterparties", route: "/main/crm/counterparties", type: "item" },
  { key: "leads", icon: Sprout, labelKey: "menu.leads", route: "/main/crm/leads", type: "item", filterFlyout: true },
  { key: "clients", icon: Users, labelKey: "menu.clients", route: "/main/crm/clients", type: "item", filterFlyout: true },
  { key: "deals", icon: LineChart, labelKey: "menu.deals", route: "/main/crm/deals", type: "item" },
  { key: "tasks", icon: CheckSquare, labelKey: "menu.tasks", route: "/main/crm/tasks", type: "item" },
  { key: "calendar", icon: Calendar, labelKey: "menu.calendar", route: "/main/crm/calendar", type: "item" },

  { key: "oms", icon: FileText, labelKey: "menu.oms", type: "section" },
  { key: "invoices", icon: FileText, labelKey: "menu.invoices", route: "/main/oms/invoices", type: "item" },
  { key: "receipts", icon: FileText, labelKey: "menu.receipts", route: "/main/oms/receipts", type: "item" },
  { key: "orders", icon: Package, labelKey: "menu.orders", route: "/main/oms/orders", type: "item", filterFlyout: true },
  { key: "offers", icon: ClipboardList, labelKey: "menu.offers", route: "/main/oms/offers", type: "item" },
  { key: "promotions", icon: Tag, labelKey: "menu.promotions", route: "/main/oms/promotions", type: "item" },
  { key: "coupons", icon: Ticket, labelKey: "menu.coupons", route: "/main/oms/coupons", type: "item" },
  { key: "shipments", icon: Truck, labelKey: "menu.shipments", route: "/main/oms/shipments", type: "item" },

  { key: "pim", icon: ShoppingBag, labelKey: "menu.pim", type: "section" },
  { key: "products", icon: Package, labelKey: "menu.products", route: "/main/pim/products", type: "item", filterFlyout: true },
  { key: "services", icon: Wrench, labelKey: "menu.services", route: "/main/pim/services", type: "item" },

  { key: "wms", icon: Warehouse, labelKey: "menu.wms", type: "section" },
  { key: "warehouse", icon: Warehouse, labelKey: "menu.warehouse", route: "/main/wms/warehouse", type: "item" },
  { key: "docs", icon: File, labelKey: "menu.wmsDocs", route: "/main/wms/docs", type: "item" },

  { key: "settings", icon: Settings, labelKey: "menu.settings", route: "/main/settings", type: "item" },
];