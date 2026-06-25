'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  CompanyDepartment,
  Task,
  TaskUserParticipant,
  TaskDepartmentParticipant,
  User,
  UserCompany,
} = require('../src/models');
const taskService = require('../src/services/crm/taskService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `tasks-visibility-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

function userCtx(user) {
  return { id: user.id };
}

function hasTask(rows, taskId) {
  return Array.isArray(rows) && rows.some((row) => row.id === taskId);
}

async function listFor(companyId, user, query = {}) {
  const result = await taskService.list({
    companyId,
    user: userCtx(user),
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
    const assignee = await createUser('assignee', suffix);
    const deptMember = await createUser('dept-member', suffix);
    const otherDeptMember = await createUser('other-dept-member', suffix);
    created.userIds.push(owner.id, creator.id, other.id, assignee.id, deptMember.id, otherDeptMember.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks Visibility Smoke ${suffix}`,
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
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: other.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assignee.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: deptMember.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: otherDeptMember.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptB.id },
    ]);

    const start = new Date(Date.UTC(2026, 5, 25, 9, 0, 0, 0));
    const end = new Date(Date.UTC(2026, 5, 25, 10, 0, 0, 0));
    const calendarQuery = {
      from: '2026-06-25T00:00:00.000Z',
      to: '2026-06-26T00:00:00.000Z',
    };

    const privateTask = await taskService.create({
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        title: `Private task ${suffix}`,
        visibility: 'private',
        plannedStartAt: start.toISOString(),
        plannedEndAt: end.toISOString(),
      },
    });

    const assignedPrivateTask = await taskService.create({
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        title: `Assigned private task ${suffix}`,
        visibility: 'private',
        participantMode: 'lists',
        assigneeIds: [assignee.id],
        plannedStartAt: start.toISOString(),
        plannedEndAt: end.toISOString(),
      },
    });

    const departmentTask = await taskService.create({
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        title: `Department task ${suffix}`,
        visibility: 'department',
        visibilityDepartmentId: deptA.id,
        plannedStartAt: start.toISOString(),
        plannedEndAt: end.toISOString(),
      },
    });

    const companyTask = await taskService.create({
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        title: `Company task ${suffix}`,
        visibility: 'company',
        plannedStartAt: start.toISOString(),
        plannedEndAt: end.toISOString(),
      },
    });

    const creatorRows = await listFor(company.id, creator);
    check('creator sees own private task', hasTask(creatorRows, privateTask.id));

    const otherRows = await listFor(company.id, other);
    check('another company user does not see private task', !hasTask(otherRows, privateTask.id));

    const assigneeRows = await listFor(company.id, assignee);
    check('assignee sees assigned private task', hasTask(assigneeRows, assignedPrivateTask.id));

    const deptRows = await listFor(company.id, deptMember);
    check('department member sees department task', hasTask(deptRows, departmentTask.id));

    const otherDeptRows = await listFor(company.id, otherDeptMember);
    check('non-department user does not see department task', !hasTask(otherDeptRows, departmentTask.id));

    check('company task visible to company member', hasTask(otherRows, companyTask.id));

    const privateDetailForOther = await taskService.getById({
      companyId: company.id,
      id: privateTask.id,
      user: userCtx(other),
    });
    check('getById blocks invisible private task', !privateDetailForOther);

    const departmentDetailForOtherDept = await taskService.getById({
      companyId: company.id,
      id: departmentTask.id,
      user: userCtx(otherDeptMember),
    });
    check('getById blocks invisible department task', !departmentDetailForOtherDept);

    const calendarForOther = await taskService.listCalendar({
      companyId: company.id,
      user: userCtx(other),
      query: calendarQuery,
    });
    check(
      'listCalendar respects private visibility',
      !hasTask(calendarForOther, privateTask.id) && hasTask(calendarForOther, companyTask.id)
    );

    const calendarForOtherDept = await taskService.listCalendar({
      companyId: company.id,
      user: userCtx(otherDeptMember),
      query: calendarQuery,
    });
    check('listCalendar respects department visibility', !hasTask(calendarForOtherDept, departmentTask.id));

    const ownerRows = await listFor(company.id, owner);
    check(
      'owner bypass sees private and department tasks',
      hasTask(ownerRows, privateTask.id) && hasTask(ownerRows, departmentTask.id)
    );

    const visibilityFilteredRows = await listFor(company.id, creator, { visibility: 'private' });
    check(
      'visibility filter applies inside visible task set',
      hasTask(visibilityFilteredRows, privateTask.id) &&
        hasTask(visibilityFilteredRows, assignedPrivateTask.id) &&
        !hasTask(visibilityFilteredRows, companyTask.id)
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
    console.error('smokeTasksVisibility crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        const tasks = await Task.findAll({
          where: { companyId: created.companyIds },
          attributes: ['id'],
          paranoid: false,
          raw: true,
        });
        const taskIds = tasks.map((task) => task.id);
        if (taskIds.length) {
          await TaskUserParticipant.destroy({ where: { taskId: taskIds } });
          await TaskDepartmentParticipant.destroy({ where: { taskId: taskIds } });
          await Task.destroy({ where: { id: taskIds }, force: true });
        }
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await CompanyDepartment.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeTasksVisibility cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
