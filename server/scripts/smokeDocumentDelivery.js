'use strict';

process.env.MAILER_DRY_RUN = 'true';

const {
  sequelize,
  CreditNote,
  Invoice,
  Offer,
  SystemEvent,
  User,
  UserCompany,
} = require('../src/models');
const documentDeliveryService = require('../src/services/documents/documentDelivery.service');
const { closeBrowser } = require('../src/services/documents/render/pdf.service');

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) throw new Error(`Document delivery smoke failed: ${name}`);
}

async function findQaUser(companyId) {
  const membership = await UserCompany.findOne({
    where: { companyId, status: 'active' },
    order: [['createdAt', 'ASC']],
  });
  if (!membership) throw new Error(`No active user membership for company ${companyId}`);

  const user = await User.findByPk(membership.userId);
  if (!user) throw new Error(`User ${membership.userId} not found`);

  return {
    ...user.get({ plain: true }),
    companyId,
    role: membership.role || 'owner',
    isOwner: true,
    permissions: ['offer:update', 'order:update', 'file:read'],
  };
}

async function findEntity(Model, label) {
  const row = await Model.findOne({ order: [['createdAt', 'DESC']] });
  if (!row) throw new Error(`No ${label} row available for document delivery smoke.`);
  return row.get({ plain: true });
}

async function assertDelivery({ entityType, entityId, user }) {
  const result = await documentDeliveryService.sendEmail({
    entityType,
    entityId,
    user,
    payload: {
      recipientEmail: `delivery-${entityType}@example.test`,
      locale: 'pl',
    },
  });

  check(`${entityType} delivery ok`, result?.ok === true);
  check(`${entityType} dry-run mail`, result?.dryRun === true);
  check(`${entityType} recipient`, result?.recipient?.email === `delivery-${entityType}@example.test`);
  check(`${entityType} document id`, Boolean(result?.document?.id));
  check(`${entityType} file id`, Boolean(result?.file?.id));
  check(`${entityType} message id`, Boolean(result?.messageId));

  const event = await SystemEvent.findOne({
    where: {
      companyId: user.companyId,
      type: 'document.delivery.sent',
      entityType,
      entityId,
    },
    order: [['createdAt', 'DESC']],
  });
  check(`${entityType} delivery event`, Boolean(event));
  check(`${entityType} event document id`, String(event.payload?.documentId) === String(result.document.id));
  check(`${entityType} event file id`, String(event.payload?.fileId) === String(result.file.id));
  check(`${entityType} event recipient`, event.payload?.recipient?.email === `delivery-${entityType}@example.test`);
}

async function main() {
  try {
    await sequelize.authenticate();

    const offer = await findEntity(Offer, 'offer');
    const invoice = await findEntity(Invoice, 'invoice');
    const creditNote = await findEntity(CreditNote, 'credit note');

    await assertDelivery({
      entityType: 'offer',
      entityId: offer.id,
      user: await findQaUser(offer.companyId),
    });
    await assertDelivery({
      entityType: 'invoice',
      entityId: invoice.id,
      user: await findQaUser(invoice.companyId),
    });
    await assertDelivery({
      entityType: 'credit_note',
      entityId: creditNote.id,
      user: await findQaUser(creditNote.companyId),
    });

    // eslint-disable-next-line no-console
    console.log('Document delivery smoke passed');
  } finally {
    await closeBrowser().catch(() => {});
    await sequelize.close().catch(() => {});
  }
}

main().catch(async (error) => {
  await closeBrowser().catch(() => {});
  await sequelize.close().catch(() => {});
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
