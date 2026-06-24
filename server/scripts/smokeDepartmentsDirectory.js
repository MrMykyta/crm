'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  CompanyDepartment,
  User,
  UserCompany,
} = require('../src/models');
const departmentService = require('../src/services/crm/depatmentService');
const userCompanyService = require('../src/services/crm/userCompanyService');
const userService = require('../src/services/crm/userService');
const permissionResolver = require('../src/middleware/permissionResolver');
const { isDeptScopeEnabled } = require('../src/acl');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectCode(name, fn, expectedCode) {
  try {
    await fn();
    check(name, false, `expected ${expectedCode}`);
  } catch (error) {
    check(name, error?.code === expectedCode, `code=${error?.code || 'none'}`);
  }
}

function permissionSignature(ctx) {
  return JSON.stringify({
    allow: [...(ctx?.permissions?.allow || [])].sort(),
    deny: [...(ctx?.permissions?.deny || [])].sort(),
  });
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `departments-directory-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const member = await createUser('member', suffix);
    const outsider = await createUser('outsider', suffix);
    created.userIds.push(owner.id, member.id, outsider.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Departments Directory Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    const otherCompany = await Company.create({
      id: uuidv4(),
      name: `Departments Directory Smoke Other ${suffix}`,
      ownerUserId: outsider.id,
    });
    created.companyIds.push(company.id, otherCompany.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: member.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: outsider.id, companyId: otherCompany.id, role: 'owner', status: 'active' },
    ]);

    const department = await departmentService.create(company.id, owner.id, {
      name: `Support ${suffix}`,
      code: `support-${suffix.slice(-8)}`,
      description: 'Directory smoke department',
    });
    check('department created with code and active flag', department?.code && department.isActive === true);

    await expectCode(
      'department code validation rejects invalid code',
      () => departmentService.create(company.id, owner.id, { name: 'Bad Code', code: 'Bad Code!' }),
      'VALIDATION_ERROR'
    );

    await expectCode(
      'duplicate department code is rejected friendly on create',
      () => departmentService.create(company.id, owner.id, { name: `Support Duplicate ${suffix}`, code: department.code }),
      'DEPARTMENT_CODE_EXISTS'
    );

    const siblingDepartment = await departmentService.create(company.id, owner.id, {
      name: `Sales ${suffix}`,
      code: `sales-${suffix.slice(-8)}`,
    });

    const updated = await departmentService.update(company.id, owner.id, department.id, {
      name: `Customer Support ${suffix}`,
      code: `cust-${suffix.slice(-8)}`,
    });
    check('department update changes name/code', updated?.name?.startsWith('Customer Support') && updated?.code?.startsWith('cust-'));

    await expectCode(
      'duplicate department code is rejected friendly on update',
      () => departmentService.update(company.id, owner.id, siblingDepartment.id, { code: updated.code }),
      'DEPARTMENT_CODE_EXISTS'
    );

    const beforeCtx = await permissionResolver.getPermissionsAndRole({ userId: member.id, companyId: company.id });
    const beforeSignature = permissionSignature(beforeCtx);
    check('department scope feature flag is disabled by default', isDeptScopeEnabled() === false);

    await userCompanyService.updateUserMembership(owner.id, company.id, member.id, {
      departmentId: department.id,
      isLead: false,
    });
    permissionResolver.invalidate(member.id, company.id);
    const afterCtx = await permissionResolver.getPermissionsAndRole({ userId: member.id, companyId: company.id });
    check('department assignment does not change ACL permissions', permissionSignature(afterCtx) === beforeSignature);
    check('department assignment updates membership only', afterCtx?.membership?.departmentId === department.id);

    const assignedMembersList = await userCompanyService.listUsers(owner.id, company.id, { limit: 100 });
    const assignedListMember = assignedMembersList.items.find((item) => item.userId === member.id);
    check(
      'company users list returns assigned department shape',
      assignedListMember?.departmentId === department.id &&
        assignedListMember?.department?.id === department.id &&
        assignedListMember?.isLead === false
    );

    const assignedUserDetail = await userService.getById(member.id, company.id);
    check(
      'user detail returns assigned department shape',
      assignedUserDetail?.membership?.departmentId === department.id &&
        assignedUserDetail?.membership?.department?.id === department.id &&
        assignedUserDetail?.membership?.isLead === false
    );

    await userCompanyService.updateUserMembership(owner.id, company.id, member.id, { departmentId: undefined, isLead: true });
    permissionResolver.invalidate(member.id, company.id);
    const leadCtx = await permissionResolver.getPermissionsAndRole({ userId: member.id, companyId: company.id });
    const leadRow = await UserCompany.findOne({ where: { userId: member.id, companyId: company.id } });
    check('set lead keeps department assignment', leadRow?.departmentId === department.id && leadRow?.isLead === true);
    check('department lead does not change ACL permissions in directory-only phase', permissionSignature(leadCtx) === beforeSignature);

    const leadDepartmentDetail = await departmentService.getById(company.id, department.id);
    const leadDepartmentMember = leadDepartmentDetail?.members?.find((item) => item.userId === member.id);
    check(
      'department detail members contains assigned lead',
      leadDepartmentMember?.departmentId === department.id &&
        leadDepartmentMember?.isLead === true
    );
    check(
      'department lead keeps member count and updates lead count',
      leadDepartmentDetail?.memberCount === 1 &&
        leadDepartmentDetail?.members?.length === 1 &&
        leadDepartmentDetail?.leadCount === 1
    );

    await userCompanyService.updateUserMembership(owner.id, company.id, member.id, { isLead: false });
    permissionResolver.invalidate(member.id, company.id);
    const clearedLeadCtx = await permissionResolver.getPermissionsAndRole({ userId: member.id, companyId: company.id });
    const clearedLeadRow = await UserCompany.findOne({ where: { userId: member.id, companyId: company.id } });
    check('clear lead works through existing member:update', clearedLeadRow?.isLead === false);
    check('clear lead keeps ACL permissions unchanged', permissionSignature(clearedLeadCtx) === beforeSignature);

    await userCompanyService.updateUserMembership(owner.id, company.id, member.id, {
      departmentId: null,
      isLead: true,
    });
    permissionResolver.invalidate(member.id, company.id);
    const removedCtx = await permissionResolver.getPermissionsAndRole({ userId: member.id, companyId: company.id });
    const removedRow = await UserCompany.findOne({ where: { userId: member.id, companyId: company.id } });
    check('remove member from department clears department and lead', !removedRow?.departmentId && removedRow?.isLead === false);
    check('remove member from department keeps ACL permissions unchanged', permissionSignature(removedCtx) === beforeSignature);

    const removedMembersList = await userCompanyService.listUsers(owner.id, company.id, { limit: 100 });
    const removedListMember = removedMembersList.items.find((item) => item.userId === member.id);
    const removedDepartmentDetail = await departmentService.getById(company.id, department.id);
    check(
      'remove member clears response shapes and department members list',
      !removedListMember?.departmentId &&
        !removedListMember?.department &&
        !removedListMember?.isLead &&
        !removedDepartmentDetail?.members?.some((item) => item.userId === member.id)
    );

    await expectCode(
      'setting lead without department membership is rejected',
      () => userCompanyService.updateUserMembership(owner.id, company.id, member.id, { isLead: true }),
      'DEPARTMENT_LEAD_REQUIRES_MEMBERSHIP'
    );

    await userCompanyService.updateUserMembership(owner.id, company.id, member.id, {
      departmentId: department.id,
      isLead: false,
    });

    const otherDepartment = await departmentService.create(otherCompany.id, outsider.id, {
      name: `Other Support ${suffix}`,
      code: `other-${suffix.slice(-8)}`,
    });
    await expectCode(
      'assigning department from another company is rejected',
      () => userCompanyService.updateUserMembership(owner.id, company.id, member.id, { departmentId: otherDepartment.id }),
      'DEPARTMENT_INVALID'
    );

    await departmentService.archive(company.id, department.id);
    const archivedDefaultList = await departmentService.list(company.id);
    const archivedFullList = await departmentService.list(company.id, { includeArchived: 'true' });
    const archivedRow = archivedFullList.find((item) => item.id === department.id);
    check('archive hides department from default list', !archivedDefaultList.some((item) => item.id === department.id));
    check('archive keeps department recoverable', archivedRow?.isActive === false && archivedRow?.deletedAt);

    const restored = await departmentService.restore(company.id, department.id);
    const restoredList = await departmentService.list(company.id);
    check('restore returns department to active list', restored?.isActive === true && restoredList.some((item) => item.id === department.id));

    const detail = await departmentService.getById(company.id, department.id);
    check('department detail includes members', detail?.members?.some((item) => item.userId === member.id));

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
    console.error('smokeDepartmentsDirectory crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await CompanyDepartment.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeDepartmentsDirectory cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
