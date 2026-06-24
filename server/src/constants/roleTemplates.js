'use strict';

const ROLE_TEMPLATES = [
  {
    id: 'sales',
    slug: 'sales',
    name: 'Sales',
    description: 'Sales pipeline role for counterparties, contacts, deals, tasks, notes, offers, and order visibility.',
    permissions: [
      'counterparty:read', 'counterparty:read:own', 'counterparty:read:dept',
      'counterparty:create', 'counterparty:update', 'counterparty:update:own', 'counterparty:update:dept',
      'contact:read', 'contact:read:own', 'contact:create', 'contact:update', 'contact:update:own',
      'deal:read', 'deal:read:dept', 'deal:create', 'deal:update', 'deal:update:own', 'deal:update:dept',
      'task:read', 'task:read:dept', 'task:create', 'task:update', 'task:update:own', 'task:update:dept',
      'note:read', 'note:create', 'note:update', 'note:delete',
      'offer:read', 'offer:create', 'offer:update', 'offer:convert',
      'order:read',
    ],
  },
  {
    id: 'accountant',
    slug: 'accountant',
    name: 'Accountant',
    description: 'Finance role for invoices, payments, credit notes, discounts, orders, counterparties, and reports.',
    permissions: [
      'invoice:read', 'invoice:create', 'invoice:update', 'invoice:issue', 'invoice:cancel',
      'payment:read', 'payment:create', 'payment:update',
      'credit_note:read', 'credit_note:create', 'credit_note:update',
      'discount:read', 'discount:create', 'discount:update',
      'order:read',
      'counterparty:read',
      'audit:read',
      'wms:reports:read',
    ],
  },
  {
    id: 'warehouse',
    slug: 'warehouse',
    name: 'Warehouse',
    description: 'Warehouse operations role for inventory, warehouse documents, picking, and reservations.',
    permissions: [
      'product:read',
      'order:read',
      'wms:read',
      'wms:warehouse:manage',
      'wms:location:manage',
      'wms:document:create',
      'wms:document:update',
      'wms:document:post',
      'wms:document:correct',
      'wms:inventory:read',
      'wms:inventory:count',
      'wms:reservation:manage',
      'wms:picking:manage',
      'wms:reports:read',
    ],
  },
  {
    id: 'service',
    slug: 'service',
    name: 'Service',
    description: 'Service operations role for orders, tasks, documents, counterparties, contacts, and notes.',
    permissions: [
      'order:read', 'order:update',
      'task:read', 'task:create', 'task:update', 'task:update:own',
      'document:read', 'document:create', 'document:update',
      'document:template:read',
      'counterparty:read',
      'contact:read',
      'note:read', 'note:create', 'note:update', 'note:delete',
    ],
  },
  {
    id: 'support',
    slug: 'support',
    name: 'Support',
    description: 'Support role for contacts, tasks, notes, chat, and counterparty read access.',
    permissions: [
      'counterparty:read',
      'contact:read', 'contact:read:own', 'contact:create', 'contact:update', 'contact:update:own',
      'task:read', 'task:create', 'task:update', 'task:update:own',
      'note:read', 'note:create', 'note:update', 'note:delete',
      'chat.read', 'chat.write', 'chat:read', 'chat:write',
    ],
  },
];

const templateById = new Map();
for (const template of ROLE_TEMPLATES) {
  templateById.set(template.id, template);
  templateById.set(template.slug, template);
}

function listRoleTemplates() {
  return ROLE_TEMPLATES.map((template) => ({
    ...template,
    permissions: [...template.permissions],
  }));
}

function getRoleTemplate(idOrSlug) {
  const template = templateById.get(String(idOrSlug || '').trim().toLowerCase()) || null;
  return template ? { ...template, permissions: [...template.permissions] } : null;
}

module.exports = {
  ROLE_TEMPLATES,
  listRoleTemplates,
  getRoleTemplate,
};
