'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Task,
  TaskUserParticipant,
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

function userCtx(user) {
  return { id: user.id, companyId: user.companyId || null };
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `tasks-priority-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createPriorityTask({ companyId, creator, suffix, priority, label }) {
  const payload = {
    title: `priority ${label} ${suffix}`,
    visibility: 'company',
  };
  if (priority !== undefined) payload.priority = priority;
  return taskService.create({
    companyId,
    user: userCtx(creator),
    payload,
  });
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
    taskIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const creator = await createUser('creator', suffix);
    created.userIds.push(owner.id, creator.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks Priority Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
    ]);

    const cases = [
      ['create default -> 50', undefined, 50],
      ['create priority 10 -> 10', 10, 10],
      ['create priority 25 -> 25', 25, 25],
      ['create priority 50 -> 50', 50, 50],
      ['create priority 75 -> 75', 75, 75],
      ['create priority 100 -> 100', 100, 100],
      ['legacy 1 -> 25', 1, 25],
      ['legacy 2 -> 50', 2, 50],
      ['legacy 3 -> 75', 3, 75],
      ['legacy 4 -> 75', 4, 75],
      ['legacy 5 -> 100', 5, 100],
      ['legacy low -> 25', 'low', 25],
      ['legacy normal -> 50', 'normal', 50],
      ['legacy high -> 75', 'high', 75],
      ['legacy urgent -> 100', 'urgent', 100],
      ['arbitrary 37 -> 25', 37, 25],
      ['arbitrary 88 -> 100', 88, 100],
    ];

    const createdTasks = [];
    for (const [name, input, expected] of cases) {
      const task = await createPriorityTask({
        companyId: company.id,
        creator,
        suffix,
        priority: input,
        label: name.replace(/[^a-z0-9]+/gi, '-'),
      });
      created.taskIds.push(task.id);
      createdTasks.push(task);
      check(name, task.priority === expected, `got=${task.priority}`);
    }

    const updateTask = createdTasks.find((task) => task.priority === 50) || createdTasks[0];
    const updated = await taskService.update({
      id: updateTask.id,
      companyId: company.id,
      user: userCtx(owner),
      payload: { priority: 3 },
    });
    check('update priority normalizes', updated.priority === 75, `got=${updated.priority}`);

    const detail = await taskService.getById({
      id: updateTask.id,
      companyId: company.id,
      user: userCtx(owner),
    });
    check('get returns numeric canonical', detail.priority === 75 && typeof detail.priority === 'number');

    const listed = await taskService.list({
      companyId: company.id,
      user: userCtx(owner),
      query: { limit: 100 },
    });
    const listedTask = listed.rows.find((row) => row.id === updateTask.id);
    check('list returns numeric canonical', listedTask?.priority === 75 && typeof listedTask.priority === 'number');

    const calendar = await taskService.listCalendar({
      companyId: company.id,
      user: userCtx(owner),
      query: { from: '2026-01-01', to: '2027-01-01' },
    });
    const calendarTask = calendar.find((row) => row.id === updateTask.id);
    check('calendar returns numeric canonical', calendarTask?.priority === 75 && typeof calendarTask.priority === 'number');

    const [nonCanonicalRows] = await sequelize.query(`
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE priority IS NULL
         OR priority NOT IN (10, 25, 50, 75, 100)
    `);
    const nonCanonicalCount = Number(nonCanonicalRows?.[0]?.count || 0);
    check('database has no non-canonical task priorities', nonCanonicalCount === 0, `count=${nonCanonicalCount}`);

    const failed = results.filter((item) => !item.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((item) => item.name).join('; '));
      process.exitCode = 1;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('smokeTasksPriority crashed', err);
    process.exitCode = 1;
  } finally {
    try {
      if (created.taskIds.length) {
        await TaskUserParticipant.destroy({ where: { taskId: created.taskIds }, force: true });
        await Task.destroy({ where: { id: created.taskIds }, force: true });
      }
      if (created.companyIds.length) {
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds }, force: true });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error('smokeTasksPriority cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
