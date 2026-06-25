'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  CompanyDepartment,
  Note,
  User,
  UserCompany,
} = require('../src/models');
const noteService = require('../src/services/crm/noteService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectError(name, fn, expectedMessage) {
  try {
    await fn();
    check(name, false, `expected=${expectedMessage}`);
  } catch (error) {
    check(name, String(error?.message || '').includes(expectedMessage), `message=${error?.message || 'none'}`);
  }
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `notes-visibility-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

function hasNote(rows, noteId) {
  return Array.isArray(rows) && rows.some((row) => row.id === noteId);
}

async function listFor(companyId, user, query = {}) {
  const result = await noteService.list({
    companyId,
    userId: user.id,
    query: { limit: 100, ...query },
  });
  return result.rows || [];
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const creator = await createUser('creator', suffix);
    const other = await createUser('other', suffix);
    const deptMember = await createUser('dept-member', suffix);
    const otherDeptMember = await createUser('other-dept-member', suffix);
    created.userIds.push(owner.id, creator.id, other.id, deptMember.id, otherDeptMember.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Notes Visibility Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    const deptA = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Operations ${suffix}`,
      code: `ops-${suffix.slice(-8)}`,
      isActive: true,
    });
    const deptB = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Support ${suffix}`,
      code: `sup-${suffix.slice(-8)}`,
      isActive: true,
    });

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: other.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: deptMember.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: otherDeptMember.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptB.id },
    ]);

    const privateNote = await noteService.create({
      companyId: company.id,
      userId: creator.id,
      payload: {
        ownerType: 'user',
        ownerId: creator.id,
        content: `Private note ${suffix}`,
        visibility: 'private',
      },
    });

    const companyNote = await noteService.create({
      companyId: company.id,
      userId: creator.id,
      payload: {
        ownerType: 'company',
        ownerId: company.id,
        content: `Company note ${suffix}`,
        visibility: 'company',
      },
    });

    const departmentNote = await noteService.create({
      companyId: company.id,
      userId: creator.id,
      payload: {
        ownerType: 'company',
        ownerId: company.id,
        content: `Department note ${suffix}`,
        visibility: 'department',
        visibilityDepartmentId: deptA.id,
      },
    });

    const creatorRows = await listFor(company.id, creator);
    check('creator sees private note', hasNote(creatorRows, privateNote.id));

    const otherRows = await listFor(company.id, other);
    check('other company user does not see private note', !hasNote(otherRows, privateNote.id));
    check('company note visible to allowed company user', hasNote(otherRows, companyNote.id));

    const deptRows = await listFor(company.id, deptMember);
    check('department note visible to department member', hasNote(deptRows, departmentNote.id));

    const otherDeptRows = await listFor(company.id, otherDeptMember);
    check('department note hidden from non-department user', !hasNote(otherDeptRows, departmentNote.id));

    const privateDetailForOther = await noteService.getById({
      companyId: company.id,
      userId: other.id,
      id: privateNote.id,
    });
    check('direct getById does not leak private note', !privateDetailForOther);

    const departmentDetailForOtherDept = await noteService.getById({
      companyId: company.id,
      userId: otherDeptMember.id,
      id: departmentNote.id,
    });
    check('direct getById does not leak department note', !departmentDetailForOtherDept);

    const entityRowsForOtherDept = await listFor(company.id, otherDeptMember, {
      ownerType: 'company',
      ownerId: company.id,
    });
    check('entity notes list does not leak department note', !hasNote(entityRowsForOtherDept, departmentNote.id));

    const filteredDeptRows = await listFor(company.id, deptMember, { visibility: 'department' });
    check(
      'visibility filter stays inside visible set',
      hasNote(filteredDeptRows, departmentNote.id) &&
        !hasNote(filteredDeptRows, companyNote.id) &&
        !hasNote(filteredDeptRows, privateNote.id)
    );

    await expectError(
      'department visibility requires valid department on create',
      () => noteService.create({
        companyId: company.id,
        userId: creator.id,
        payload: {
          ownerType: 'company',
          ownerId: company.id,
          content: `Invalid department note ${suffix}`,
          visibility: 'department',
          visibilityDepartmentId: uuidv4(),
        },
      }),
      'visibilityDepartmentId is invalid'
    );

    await noteService.update({
      id: companyNote.id,
      companyId: company.id,
      user: { id: creator.id },
      payload: {
        visibility: 'department',
        visibilityDepartmentId: deptA.id,
      },
    });
    const updatedCompanyNote = await noteService.getById({
      companyId: company.id,
      userId: creator.id,
      id: companyNote.id,
    });
    check(
      'update to department visibility stores department id',
      updatedCompanyNote?.visibility === 'department' &&
        updatedCompanyNote?.visibilityDepartmentId === deptA.id
    );

    await expectError(
      'update to department validates department',
      () => noteService.update({
        id: privateNote.id,
        companyId: company.id,
        user: { id: creator.id },
        payload: {
          visibility: 'department',
          visibilityDepartmentId: uuidv4(),
        },
      }),
      'visibilityDepartmentId is invalid'
    );

    const departmentTargetNote = await noteService.create({
      companyId: company.id,
      userId: creator.id,
      payload: {
        ownerType: 'department',
        ownerId: deptA.id,
        content: `Department target note ${suffix}`,
        visibility: 'department',
        visibilityDepartmentId: deptB.id,
      },
    });
    const targetRowsForOtherDept = await listFor(company.id, otherDeptMember);
    check(
      "ownerType='department' target is not the same as visibility department",
      !hasNote(targetRowsForOtherDept, departmentTargetNote.id)
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
    console.error('smokeNotesVisibility crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await Note.destroy({ where: { companyId: created.companyIds }, force: true });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await CompanyDepartment.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeNotesVisibility cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
