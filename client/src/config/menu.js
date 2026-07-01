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
  MessagesSquare,
  FileText,
  CreditCard,
  Package,
  ClipboardList,
  Tag,
  Ticket,
  ShoppingBag,
  Wrench,
  Warehouse,
} from "lucide-react";
import { WMS_DOCUMENT_NAVIGATION_GROUPS } from "../pages/wms/navigation/wmsUiNavigation";

const TASK_NAVIGATION_GROUPS = [
  {
    key: "tasks",
    labelKey: "crm.task.views.groupTasks",
    items: [
      { key: "all", labelKey: "crm.task.views.all", to: "/main/tasks" },
      { key: "my", labelKey: "crm.task.views.my", to: "/main/tasks?view=my" },
      { key: "overdue", labelKey: "crm.task.views.overdue", to: "/main/tasks?view=overdue" },
      { key: "today", labelKey: "crm.task.views.today", to: "/main/tasks?view=today" },
      { key: "in-progress", labelKey: "crm.task.views.inProgress", to: "/main/tasks?view=in-progress" },
      { key: "completed", labelKey: "crm.task.views.completed", to: "/main/tasks?view=completed" },
    ],
  },
];

const WMS_VARIANT_B_MENU = [
  {
    key: "wmsDocuments",
    icon: FileText,
    labelKey: "menu.wmsNavDocuments",
    route: "/main/wms/documents",
    type: "item",
    navigationFlyout: WMS_DOCUMENT_NAVIGATION_GROUPS,
  },
  { key: "wmsInventory", icon: Package, labelKey: "menu.wmsNavInventory", route: "/main/wms/inventory?tab=balances", type: "item" },
  { key: "wmsPicks", icon: ClipboardList, labelKey: "menu.wmsNavPicking", route: "/main/wms/picks", type: "item" },
  { key: "wmsSetup", icon: Wrench, labelKey: "menu.wmsNavSetup", route: "/main/wms/setup?tab=warehouses", type: "item" },
];

const WMS_MENU = WMS_VARIANT_B_MENU;

export const MENU = [
  { key: "bookmarks", icon: Star, labelKey: "menu.bookmarks", type: "section" },

  // "Главная" → сразу в контрагентов
  { key: "pulpit", icon: Home, labelKey: "menu.pulpit", route: "/main/pulpit", type: "item" },

  { key: "crm", icon: Users, labelKey: "menu.crm", type: "section" },
  { key: "counterparties", icon: Building2, labelKey: "menu.counterparties", route: "/main/counterparties", type: "item", requiredPermission: "counterparty:read" },
  { key: "leads", icon: Sprout, labelKey: "menu.leads", route: "/main/leads", type: "item", filterFlyout: true, requiredPermission: "counterparty:read" },
  { key: "clients", icon: Users, labelKey: "menu.clients", route: "/main/clients", type: "item", filterFlyout: true, requiredPermission: "counterparty:read" },
  { key: "deals", icon: LineChart, labelKey: "menu.deals", route: "/main/deals", type: "item", requiredPermission: "deal:read" },
  { key: "tasks", icon: CheckSquare, labelKey: "menu.tasks", route: "/main/tasks", type: "item", requiredPermission: "task:read", navigationFlyout: TASK_NAVIGATION_GROUPS },
  { key: "notes", icon: ClipboardList, labelKey: "menu.notes", route: "/main/notes", type: "item", requiredPermission: "note:read" },
  { key: "contacts", icon: Users, labelKey: "menu.contacts", route: "/main/contacts", type: "item" },
  { key: "calendar", icon: Calendar, labelKey: "menu.calendar", route: "/main/calendar", type: "item", requiredPermission: "task:read" },
  { key: "chat", icon: MessagesSquare, labelKey: "menu.chat", route: "/main/chat", type: "item", requiredPermission: "chat.read" },

  { key: "oms", icon: FileText, labelKey: "menu.oms", type: "section" },
  { key: "invoices", icon: FileText, labelKey: "menu.invoices", route: "/main/oms/invoices", type: "item" },
  { key: "payments", icon: CreditCard, labelKey: "menu.payments", route: "/main/oms/payments", type: "item" },
  { key: "orders", icon: ClipboardList, labelKey: "menu.orders", route: "/main/oms/orders", type: "item" },
  { key: "offers", icon: FileText, labelKey: "menu.offers", route: "/main/oms/offers", type: "item" },
  { key: "documents", icon: FileText, labelKey: "menu.documents", route: "/main/documents", type: "item", requiredPermission: "document:read" },
  { key: "promotions", icon: Tag, labelKey: "menu.promotions", route: "/main/oms/promotions", type: "item" },
  { key: "coupons", icon: Ticket, labelKey: "menu.coupons", route: "/main/oms/coupons", type: "item" },

  { key: "pim", icon: ShoppingBag, labelKey: "menu.pim", type: "section" },
  { key: "products", icon: Package, labelKey: "menu.products", route: "/main/products", type: "item", filterFlyout: true, requiredPermission: "product:read" },
  { key: "services", icon: Wrench, labelKey: "menu.services", route: "/main/pim/services", type: "item", requiredPermission: "product:read" },

  { key: "wms", icon: Warehouse, labelKey: "menu.wms", type: "section" },
  ...WMS_MENU,

  { key: "users", icon: Users, labelKey: "menu.users", route: "/main/company-users", type: "item", requiredAnyPermission: ["member:read", "role:read", "permission:read"] },
];
