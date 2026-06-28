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
const taskSchema = require('../src/schemas/taskSchema');
const taskService = require('../src/services/crm/taskService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectReject(name, fn, expectedStatus) {
  try {
    await fn();
    check(name, false, 'expected rejection');
  } catch (err) {
    check(name, !expectedStatus || err.status === expectedStatus, `status=${err.status || 'n/a'}`);
  }
}

function userCtx(user) {
  return { id: user.id };
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `tasks-my-status-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createTask({
  companyId,
  creator,
  suffix,
  title,
  visibility = 'company',
  status = 'todo',
  statusAggregate = false,
  assigneeIds = [],
  watcherIds = [],
}) {
  return taskService.create({
    companyId,
    user: userCtx(creator),
    payload: {
      title: `${title} ${suffix}`,
      visibility,
      status,
      statusAggregate,
      participantMode: assigneeIds.length ? 'lists' : 'none',
      watcherMode: watcherIds.length ? 'lists' : 'none',
      assigneeIds,
      watcherIds,
    },
  });
}

async function participant(taskId, userId) {
  return TaskUserParticipant.findOne({
    where: { taskId, userId, role: 'assignee' },
  });
}

async function reloadTask(taskId) {
  return Task.findByPk(taskId, { paranoid: false });
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
    const watcher = await createUser('watcher', suffix);
    const nonAssignee = await createUser('non-assignee', suffix);
    const outsider = await createUser('outsider', suffix);
    created.userIds.push(owner.id, creator.id, assigneeA.id, assigneeB.id, watcher.id, nonAssignee.id, outsider.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks My Status Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    const otherCompany = await Company.create({
      id: uuidv4(),
      name: `Tasks My Status Other ${suffix}`,
      ownerUserId: outsider.id,
    });
    created.companyIds.push(otherCompany.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeA.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeB.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: watcher.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: nonAssignee.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: outsider.id, companyId: otherCompany.id, role: 'owner', status: 'active' },
    ]);

    const ownTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'own status',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(ownTask.id);

    let result = await taskService.updateMyMemberStatus({
      taskId: ownTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'in_progress',
      note: 'started',
    });
    let row = await participant(ownTask.id, assigneeA.id);
    check(
      'assignee can set own status to in_progress',
      result.participant?.memberStatus === 'in_progress' &&
        row?.memberStatus === 'in_progress' &&
        !!row.startedAt &&
        row.statusNote === 'started'
    );

    result = await taskService.updateMyMemberStatus({
      taskId: ownTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'done',
    });
    row = await participant(ownTask.id, assigneeA.id);
    check(
      'assignee can set own status to done',
      result.participant?.memberStatus === 'done' && row?.memberStatus === 'done'
    );
    check(
      'done sets completedAt/completedById',
      !!row.completedAt && String(row.completedById) === String(assigneeA.id)
    );

    const visibleCompanyTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'visible non assignee',
      visibility: 'company',
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(visibleCompanyTask.id);
    await expectReject(
      'non-assignee cannot set status',
      () => taskService.updateMyMemberStatus({
        taskId: visibleCompanyTask.id,
        companyId: company.id,
        userId: nonAssignee.id,
        memberStatus: 'in_progress',
      }),
      403
    );

    const watcherTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'watcher only',
      visibility: 'company',
      assigneeIds: [assigneeA.id],
      watcherIds: [watcher.id],
    });
    created.taskIds.push(watcherTask.id);
    await expectReject(
      'watcher-only cannot set status',
      () => taskService.updateMyMemberStatus({
        taskId: watcherTask.id,
        companyId: company.id,
        userId: watcher.id,
        memberStatus: 'in_progress',
      }),
      403
    );

    const canceledValidation = taskSchema.myStatus.validate(
      { memberStatus: 'canceled' },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    check('assignee cannot set canceled via self-service schema', !!canceledValidation.error);
    await expectReject(
      'assignee cannot set canceled via service',
      () => taskService.updateMyMemberStatus({
        taskId: ownTask.id,
        companyId: company.id,
        userId: assigneeA.id,
        memberStatus: 'canceled',
      }),
      400
    );

    const beforeOther = await participant(ownTask.id, assigneeB.id);
    const stripped = taskSchema.myStatus.validate(
      { userId: assigneeB.id, memberStatus: 'blocked', note: 'attempt other' },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    await taskService.updateMyMemberStatus({
      taskId: ownTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      ...stripped.value,
    });
    const afterOther = await participant(ownTask.id, assigneeB.id);
    const afterSelf = await participant(ownTask.id, assigneeA.id);
    check(
      "assignee cannot set another user's status through self-service payload",
      !stripped.value.userId &&
        beforeOther?.memberStatus === afterOther?.memberStatus &&
        afterSelf?.memberStatus === 'blocked'
    );

    const privateTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'private invisible',
      visibility: 'private',
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(privateTask.id);
    await expectReject(
      'invisible/private task blocks non-assignee',
      () => taskService.updateMyMemberStatus({
        taskId: privateTask.id,
        companyId: company.id,
        userId: nonAssignee.id,
        memberStatus: 'in_progress',
      }),
      404
    );

    await expectReject(
      'user from another company cannot set status',
      () => taskService.updateMyMemberStatus({
        taskId: visibleCompanyTask.id,
        companyId: company.id,
        userId: outsider.id,
        memberStatus: 'in_progress',
      }),
      403
    );

    const aggregateTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'aggregate self',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(aggregateTask.id);
    await taskService.updateMyMemberStatus({
      taskId: aggregateTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'done',
    });
    await taskService.updateMyMemberStatus({
      taskId: aggregateTask.id,
      companyId: company.id,
      userId: assigneeB.id,
      memberStatus: 'done',
    });
    let task = await reloadTask(aggregateTask.id);
    check(
      'aggregate on + all assignees done through my-status sets task done',
      task.status === 'done' && !!task.completedAt && String(task.completedById) === String(assigneeB.id),
      `status=${task.status}`
    );

    await taskService.updateMyMemberStatus({
      taskId: aggregateTask.id,
      companyId: company.id,
      userId: assigneeB.id,
      memberStatus: 'in_progress',
    });
    task = await reloadTask(aggregateTask.id);
    check(
      'aggregate on + one assignee reopens through my-status moves task to in_progress',
      task.status === 'in_progress' && !task.completedAt && !task.completedById,
      `status=${task.status}`
    );

    const noUpdatePermissionTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'no task update permission',
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(noUpdatePermissionTask.id);
    await taskService.updateMyMemberStatus({
      taskId: noUpdatePermissionTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'done',
    });
    row = await participant(noUpdatePermissionTask.id, assigneeA.id);
    check('no task:update required for own assignee status', row?.memberStatus === 'done');

    const legacyTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'legacy update route',
      statusAggregate: false,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(legacyTask.id);
    await taskService.update({
      id: legacyTask.id,
      companyId: company.id,
      user: userCtx(creator),
      payload: { memberStatuses: [{ userId: assigneeB.id, memberStatus: 'done' }] },
    });
    row = await participant(legacyTask.id, assigneeB.id);
    check(
      'task:update memberStatuses behavior still works',
      row?.memberStatus === 'done' && !!row.completedAt && String(row.completedById) === String(creator.id)
    );

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
