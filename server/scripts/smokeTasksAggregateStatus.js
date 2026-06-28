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
  return { id: user.id };
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `tasks-aggregate-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function reloadTask(id) {
  return Task.findByPk(id, { paranoid: false });
}

async function participant(taskId, userId) {
  return TaskUserParticipant.findOne({
    where: { taskId, userId, role: 'assignee' },
  });
}

async function createTask({ companyId, creator, suffix, title, status = 'todo', statusAggregate = true, assigneeIds = [] }) {
  return taskService.create({
    companyId,
    user: userCtx(creator),
    payload: {
      title: `${title} ${suffix}`,
      status,
      statusAggregate,
      participantMode: assigneeIds.length ? 'lists' : 'none',
      assigneeIds,
    },
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
    const assigneeA = await createUser('assignee-a', suffix);
    const assigneeB = await createUser('assignee-b', suffix);
    created.userIds.push(owner.id, creator.id, assigneeA.id, assigneeB.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks Aggregate Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeA.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeB.id, companyId: company.id, role: 'user', status: 'active' },
    ]);

    const aggregateOff = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'aggregate off',
      status: 'todo',
      statusAggregate: false,
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(aggregateOff.id);
    await taskService.update({
      id: aggregateOff.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: { memberStatuses: [{ userId: assigneeA.id, memberStatus: 'done' }] },
    });
    let task = await reloadTask(aggregateOff.id);
    check('aggregate off does not change task.status', task.status === 'todo', `status=${task.status}`);

    const noAssignees = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'aggregate on no assignees',
      status: 'todo',
      statusAggregate: true,
      assigneeIds: [],
    });
    created.taskIds.push(noAssignees.id);
    await taskService.update({
      id: noAssignees.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: { title: `${noAssignees.title} updated` },
    });
    task = await reloadTask(noAssignees.id);
    check('aggregate on with no assignees does not change task.status', task.status === 'todo', `status=${task.status}`);

    const allDone = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'all done',
      status: 'todo',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(allDone.id);
    await taskService.update({
      id: allDone.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        memberStatuses: [
          { userId: assigneeA.id, memberStatus: 'done' },
          { userId: assigneeB.id, memberStatus: 'done' },
        ],
      },
    });
    task = await reloadTask(allDone.id);
    check(
      'aggregate on + all assignees done sets task done and completedAt',
      task.status === 'done' && !!task.completedAt && String(task.completedById) === String(creator.id),
      `status=${task.status}`
    );

    const manualTodo = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'manual todo',
      status: 'todo',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(manualTodo.id);
    await taskService.update({
      id: manualTodo.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: { memberStatuses: [{ userId: assigneeA.id, memberStatus: 'in_progress' }] },
    });
    task = await reloadTask(manualTodo.id);
    check('aggregate on + not all done does not overwrite manual todo', task.status === 'todo', `status=${task.status}`);

    const blocked = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'blocked aggregate',
      status: 'blocked',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(blocked.id);
    await taskService.update({
      id: blocked.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        memberStatuses: [
          { userId: assigneeA.id, memberStatus: 'done' },
          { userId: assigneeB.id, memberStatus: 'done' },
        ],
      },
    });
    task = await reloadTask(blocked.id);
    check('aggregate on + blocked task is not overwritten', task.status === 'blocked', `status=${task.status}`);

    const canceled = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'canceled aggregate',
      status: 'canceled',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(canceled.id);
    await taskService.update({
      id: canceled.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        memberStatuses: [
          { userId: assigneeA.id, memberStatus: 'done' },
          { userId: assigneeB.id, memberStatus: 'done' },
        ],
      },
    });
    task = await reloadTask(canceled.id);
    check('aggregate on + canceled task is not overwritten', task.status === 'canceled', `status=${task.status}`);

    const reopen = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'reopen aggregate',
      status: 'todo',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(reopen.id);
    await taskService.update({
      id: reopen.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: {
        memberStatuses: [
          { userId: assigneeA.id, memberStatus: 'done' },
          { userId: assigneeB.id, memberStatus: 'done' },
        ],
      },
    });
    await taskService.update({
      id: reopen.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: { memberStatuses: [{ userId: assigneeB.id, memberStatus: 'in_progress' }] },
    });
    task = await reloadTask(reopen.id);
    check(
      'done task + assignee reopens moves task to in_progress and clears completion',
      task.status === 'in_progress' && !task.completedAt && !task.completedById,
      `status=${task.status}`
    );

    let row = await participant(allDone.id, assigneeA.id);
    check(
      'participant done sets completedAt/completedById',
      row?.memberStatus === 'done' && !!row.completedAt && String(row.completedById) === String(creator.id)
    );

    row = await participant(manualTodo.id, assigneeA.id);
    check(
      'participant in_progress sets startedAt',
      row?.memberStatus === 'in_progress' && !!row.startedAt
    );

    check(
      'memberStatus enum unchanged',
      JSON.stringify(TaskUserParticipant.rawAttributes.memberStatus.values) ===
        JSON.stringify(['todo', 'in_progress', 'done', 'blocked', 'canceled'])
    );

    const failed = results.filter((result) => !result.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((result) => result.name).join('; '));
      process.exitCode = 1;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
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
      console.error('cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close();
  }
})();
