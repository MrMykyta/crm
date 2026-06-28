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
const authorize = require('../src/middleware/authorize');
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
    const status = err.status || err.statusCode;
    check(name, !expectedStatus || status === expectedStatus, `status=${status || 'n/a'}`);
  }
}

async function authorizeTaskUpdate(userId, companyId) {
  return new Promise((resolve) => {
    const req = { user: { id: userId }, companyId };
    const res = {};
    authorize('task:update')(req, res, (err) => resolve(err || null));
  });
}

function userCtx(user) {
  return { id: user.id };
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `tasks-participant-status-${label}-${suffix}@example.test`,
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
    const manager = await createUser('manager', suffix);
    const employee = await createUser('employee', suffix);
    const creator = await createUser('creator', suffix);
    const assigneeA = await createUser('assignee-a', suffix);
    const assigneeB = await createUser('assignee-b', suffix);
    const watcher = await createUser('watcher', suffix);
    const nonParticipant = await createUser('non-participant', suffix);
    const outsider = await createUser('outsider', suffix);
    created.userIds.push(
      owner.id,
      manager.id,
      employee.id,
      creator.id,
      assigneeA.id,
      assigneeB.id,
      watcher.id,
      nonParticipant.id,
      outsider.id
    );

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks Participant Status Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    const otherCompany = await Company.create({
      id: uuidv4(),
      name: `Tasks Participant Status Other ${suffix}`,
      ownerUserId: outsider.id,
    });
    created.companyIds.push(company.id, otherCompany.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: manager.id, companyId: company.id, role: 'manager', status: 'active' },
      { id: uuidv4(), userId: employee.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeA.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeB.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: watcher.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: nonParticipant.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: outsider.id, companyId: otherCompany.id, role: 'owner', status: 'active' },
    ]);

    const managerAuthErr = await authorizeTaskUpdate(manager.id, company.id);
    check('user with task:update passes route middleware', !managerAuthErr);
    const employeeAuthErr = await authorizeTaskUpdate(employee.id, company.id);
    check('user without task:update rejected by route middleware', (employeeAuthErr?.status || employeeAuthErr?.statusCode) === 403);

    const mainTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'manager participant status',
      assigneeIds: [assigneeA.id, assigneeB.id],
      watcherIds: [watcher.id],
    });
    created.taskIds.push(mainTask.id);

    let result = await taskService.updateParticipantMemberStatus({
      taskId: mainTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'in_progress',
      note: 'manager started target',
    });
    let row = await participant(mainTask.id, assigneeA.id);
    check(
      'user with task:update can set another assignee to in_progress',
      result.participant?.memberStatus === 'in_progress' &&
        row?.memberStatus === 'in_progress' &&
        !!row.startedAt &&
        row.statusNote === 'manager started target'
    );

    result = await taskService.updateParticipantMemberStatus({
      taskId: mainTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'done',
    });
    row = await participant(mainTask.id, assigneeA.id);
    check(
      'user with task:update can set another assignee to done',
      result.participant?.memberStatus === 'done' && row?.memberStatus === 'done'
    );
    check(
      'done sets participant completedAt/completedById = actor',
      !!row.completedAt && String(row.completedById) === String(manager.id)
    );

    await taskService.updateParticipantMemberStatus({
      taskId: mainTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'blocked',
    });
    row = await participant(mainTask.id, assigneeA.id);
    check('manager can set blocked', row?.memberStatus === 'blocked' && !row.completedAt && !row.completedById);

    await taskService.updateParticipantMemberStatus({
      taskId: mainTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'canceled',
    });
    row = await participant(mainTask.id, assigneeA.id);
    check('manager can set canceled', row?.memberStatus === 'canceled' && !row.completedAt && !row.completedById);

    await expectReject(
      'target watcher-only rejected',
      () => taskService.updateParticipantMemberStatus({
        taskId: mainTask.id,
        targetUserId: watcher.id,
        companyId: company.id,
        actorUserId: manager.id,
        memberStatus: 'done',
      }),
      403
    );

    await expectReject(
      'target non-participant rejected',
      () => taskService.updateParticipantMemberStatus({
        taskId: mainTask.id,
        targetUserId: nonParticipant.id,
        companyId: company.id,
        actorUserId: manager.id,
        memberStatus: 'done',
      }),
      403
    );

    await expectReject(
      'target user from other company rejected',
      () => taskService.updateParticipantMemberStatus({
        taskId: mainTask.id,
        targetUserId: outsider.id,
        companyId: company.id,
        actorUserId: manager.id,
        memberStatus: 'done',
      }),
      400
    );

    const invalidValidation = taskSchema.participantStatus.validate(
      { memberStatus: 'invalid' },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    check('invalid participant status rejected by schema', !!invalidValidation.error);

    const privateTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'private invisible for manager',
      visibility: 'private',
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(privateTask.id);
    await expectReject(
      'invisible task rejected',
      () => taskService.updateParticipantMemberStatus({
        taskId: privateTask.id,
        targetUserId: assigneeA.id,
        companyId: company.id,
        actorUserId: manager.id,
        memberStatus: 'done',
      }),
      404
    );

    const aggregateTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'manager aggregate',
      statusAggregate: true,
      assigneeIds: [assigneeA.id, assigneeB.id],
    });
    created.taskIds.push(aggregateTask.id);
    await taskService.updateParticipantMemberStatus({
      taskId: aggregateTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'done',
    });
    await taskService.updateParticipantMemberStatus({
      taskId: aggregateTask.id,
      targetUserId: assigneeB.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'done',
    });
    let task = await reloadTask(aggregateTask.id);
    check(
      'aggregate all done through manager endpoint sets task done',
      task.status === 'done' && !!task.completedAt && String(task.completedById) === String(manager.id),
      `status=${task.status}`
    );

    await taskService.updateParticipantMemberStatus({
      taskId: aggregateTask.id,
      targetUserId: assigneeB.id,
      companyId: company.id,
      actorUserId: manager.id,
      memberStatus: 'in_progress',
    });
    task = await reloadTask(aggregateTask.id);
    check(
      'aggregate reopen through manager endpoint moves task to in_progress',
      task.status === 'in_progress' && !task.completedAt && !task.completedById,
      `status=${task.status}`
    );

    const selfCanceledValidation = taskSchema.myStatus.validate(
      { memberStatus: 'canceled' },
      { abortEarly: false, stripUnknown: true, convert: true }
    );
    check('self endpoint still rejects canceled', !!selfCanceledValidation.error);

    await taskService.updateMyMemberStatus({
      taskId: aggregateTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'in_progress',
      note: 'self still works',
    });
    row = await participant(aggregateTask.id, assigneeA.id);
    check('my-status endpoint still works', row?.memberStatus === 'in_progress' && row.statusNote === 'self still works');

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
