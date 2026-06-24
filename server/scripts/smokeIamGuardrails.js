'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Role,
  User,
  UserCompany,
  UserRole,
} = require('../src/models');
const aclService = require('../src/services/system/aclService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectGuard(name, fn, expectedCode) {
  try {
    await fn();
    check(name, false, `expected ${expectedCode}`);
  } catch (error) {
    check(name, error?.code === expectedCode, `code=${error?.code || 'none'}`);
  }
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `iam-guardrails-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createRole(companyId, slug, name = slug) {
  return Role.create({
    id: uuidv4(),
    companyId,
    slug,
    name,
    isDefault: true,
    isSystem: slug === 'owner' || slug === 'admin',
    description: `Smoke ${name}`,
  });
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;

    const actor = await createUser('actor', suffix);
    const target = await createUser('target', suffix);
    const secondOwner = await createUser('second-owner', suffix);
    const adminTarget = await createUser('admin-target', suffix);
    const outsider = await createUser('outsider', suffix);
    created.userIds.push(actor.id, target.id, secondOwner.id, adminTarget.id, outsider.id);

    const companyA = await Company.create({
      id: uuidv4(),
      name: `IAM Guardrails Smoke A ${suffix}`,
      ownerUserId: actor.id,
    });
    const companyB = await Company.create({
      id: uuidv4(),
      name: `IAM Guardrails Smoke B ${suffix}`,
      ownerUserId: outsider.id,
    });
    created.companyIds.push(companyA.id, companyB.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: actor.id, companyId: companyA.id, role: 'admin', status: 'active' },
      { id: uuidv4(), userId: target.id, companyId: companyA.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: secondOwner.id, companyId: companyA.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: adminTarget.id, companyId: companyA.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: outsider.id, companyId: companyB.id, role: 'user', status: 'active' },
    ]);

    const ownerRoleA = await createRole(companyA.id, 'owner');
    const adminRoleA = await createRole(companyA.id, 'admin');
    const viewerRoleA = await createRole(companyA.id, 'viewer');
    const ownerRoleB = await createRole(companyB.id, 'owner');

    await UserRole.create({ userId: target.id, companyId: companyA.id, roleId: ownerRoleA.id });
    await expectGuard(
      'last owner ACL role cannot be removed',
      () => aclService.removeRoleFromUser({
        userId: target.id,
        companyId: companyA.id,
        roleId: ownerRoleA.id,
        currentUserId: actor.id,
      }),
      'LAST_OWNER_REQUIRED'
    );

    await UserRole.create({ userId: secondOwner.id, companyId: companyA.id, roleId: ownerRoleA.id });
    await aclService.removeRoleFromUser({
      userId: target.id,
      companyId: companyA.id,
      roleId: ownerRoleA.id,
      currentUserId: actor.id,
    });
    const targetOwnerAfterRemoval = await UserRole.findOne({
      where: { userId: target.id, companyId: companyA.id, roleId: ownerRoleA.id },
    });
    check('non-last owner removal works when another owner exists', !targetOwnerAfterRemoval);

    await UserRole.create({ userId: actor.id, companyId: companyA.id, roleId: ownerRoleA.id });
    await expectGuard(
      'current user cannot remove own owner role',
      () => aclService.removeRoleFromUser({
        userId: actor.id,
        companyId: companyA.id,
        roleId: ownerRoleA.id,
        currentUserId: actor.id,
      }),
      'SELF_DEMOTION_FORBIDDEN'
    );

    await UserRole.create({ userId: actor.id, companyId: companyA.id, roleId: adminRoleA.id });
    await expectGuard(
      'current user cannot remove own admin role',
      () => aclService.removeRoleFromUser({
        userId: actor.id,
        companyId: companyA.id,
        roleId: adminRoleA.id,
        currentUserId: actor.id,
      }),
      'SELF_DEMOTION_FORBIDDEN'
    );

    await UserRole.create({ userId: adminTarget.id, companyId: companyA.id, roleId: adminRoleA.id });
    await aclService.removeRoleFromUser({
      userId: adminTarget.id,
      companyId: companyA.id,
      roleId: adminRoleA.id,
      currentUserId: actor.id,
    });
    const otherAdminAfterRemoval = await UserRole.findOne({
      where: { userId: adminTarget.id, companyId: companyA.id, roleId: adminRoleA.id },
    });
    check('admin role removal from another user works', !otherAdminAfterRemoval);

    await expectGuard(
      'assign role from another company is rejected',
      () => aclService.assignRoleToUser({
        userId: target.id,
        companyId: companyA.id,
        roleId: ownerRoleB.id,
        currentUserId: actor.id,
      }),
      'ROLE_COMPANY_MISMATCH'
    );

    await expectGuard(
      'assign role to user outside company is rejected',
      () => aclService.assignRoleToUser({
        userId: outsider.id,
        companyId: companyA.id,
        roleId: viewerRoleA.id,
        currentUserId: actor.id,
      }),
      'USER_COMPANY_MISMATCH'
    );

    await expectGuard(
      'remove role from user outside company is rejected',
      () => aclService.removeRoleFromUser({
        userId: outsider.id,
        companyId: companyA.id,
        roleId: viewerRoleA.id,
        currentUserId: actor.id,
      }),
      'USER_COMPANY_MISMATCH'
    );

    const failed = results.filter((result) => !result.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((result) => result.name).join('; '));
      process.exitCode = 1;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('smokeIamGuardrails crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await UserRole.destroy({ where: { companyId: created.companyIds } });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await Role.destroy({ where: { companyId: created.companyIds } });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeIamGuardrails cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
