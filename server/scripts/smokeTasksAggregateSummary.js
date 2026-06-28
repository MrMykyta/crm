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
    email: `tasks-aggregate-summary-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createTask({
  companyId,
  creator,
  suffix,
  title,
  assigneeIds = [],
  watcherIds = [],
  statusAggregate = true,
}) {
  return taskService.create({
    companyId,
    user: userCtx(creator),
    payload: {
      title: `${title} ${suffix}`,
      visibility: 'company',
      statusAggregate,
      participantMode: assigneeIds.length ? 'lists' : 'none',
      watcherMode: watcherIds.length ? 'lists' : 'none',
      assigneeIds,
      watcherIds,
    },
  });
}

function hasId(items, userId) {
  return Array.isArray(items) && items.some((item) => String(item.id) === String(userId));
}

function noId(items, userId) {
  return Array.isArray(items) && !items.some((item) => String(item.id) === String(userId));
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
    const assigneeC = await createUser('assignee-c', suffix);
    const watcher = await createUser('watcher', suffix);
    created.userIds.push(owner.id, creator.id, assigneeA.id, assigneeB.id, assigneeC.id, watcher.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Tasks Aggregate Summary Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeA.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeB.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: assigneeC.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: watcher.id, companyId: company.id, role: 'user', status: 'active' },
    ]);

    const noAssignees = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'no assignees',
    });
    created.taskIds.push(noAssignees.id);
    let summary = noAssignees.aggregateSummary;
    check(
      'no assignees -> total 0, progress 0, arrays empty',
      summary?.assigneesTotal === 0 &&
        summary.progressPercent === 0 &&
        summary.pendingAssignees.length === 0 &&
        summary.completedAssignees.length === 0 &&
        summary.blockedAssignees.length === 0
    );

    const todoTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'one todo',
      assigneeIds: [assigneeA.id],
    });
    created.taskIds.push(todoTask.id);
    summary = todoTask.aggregateSummary;
    check(
      'one todo assignee -> total 1, pending 1, progress 0',
      summary?.assigneesTotal === 1 &&
        summary.assigneesPending === 1 &&
        summary.assigneesDone === 0 &&
        summary.progressPercent === 0 &&
        hasId(summary.pendingAssignees, assigneeA.id)
    );

    const myStatusResult = await taskService.updateMyMemberStatus({
      taskId: todoTask.id,
      companyId: company.id,
      userId: assigneeA.id,
      memberStatus: 'done',
      note: 'self done summary',
    });
    summary = myStatusResult.task.aggregateSummary;
    check(
      'one done assignee -> total 1, done 1, progress 100',
      summary?.assigneesTotal === 1 &&
        summary.assigneesDone === 1 &&
        summary.assigneesPending === 0 &&
        summary.progressPercent === 100 &&
        hasId(summary.completedAssignees, assigneeA.id)
    );
    check(
      'my-status response returns updated aggregateSummary',
      summary?.completedAssignees?.[0]?.statusNote === 'self done summary'
    );

    const mixedTask = await createTask({
      companyId: company.id,
      creator,
      suffix,
      title: 'mixed assignees',
      assigneeIds: [assigneeA.id, assigneeB.id, assigneeC.id],
      watcherIds: [watcher.id],
    });
    created.taskIds.push(mixedTask.id);

    await taskService.updateParticipantMemberStatus({
      taskId: mixedTask.id,
      targetUserId: assigneeA.id,
      companyId: company.id,
      actorUserId: owner.id,
      memberStatus: 'done',
      note: 'manager done',
    });
    await taskService.updateParticipantMemberStatus({
      taskId: mixedTask.id,
      targetUserId: assigneeB.id,
      companyId: company.id,
      actorUserId: owner.id,
      memberStatus: 'blocked',
      note: 'blocked note',
    });
    const participantStatusResult = await taskService.updateParticipantMemberStatus({
      taskId: mixedTask.id,
      targetUserId: assigneeC.id,
      companyId: company.id,
      actorUserId: owner.id,
      memberStatus: 'in_progress',
      note: 'pending note',
    });
    summary = participantStatusResult.task.aggregateSummary;
    check(
      'mixed assignees -> correct counts and arrays',
      summary?.assigneesTotal === 3 &&
        summary.assigneesDone === 1 &&
        summary.assigneesPending === 1 &&
        summary.assigneesBlocked === 1 &&
        summary.progressPercent === 33 &&
        hasId(summary.completedAssignees, assigneeA.id) &&
        hasId(summary.blockedAssignees, assigneeB.id) &&
        hasId(summary.pendingAssignees, assigneeC.id)
    );
    check(
      'blocked assignee -> blockedAssignees populated, progress ignores blocked as done',
      summary.assigneesBlocked === 1 &&
        summary.progressPercent === 33 &&
        summary.blockedAssignees[0]?.statusNote === 'blocked note'
    );
    check(
      'watchers excluded',
      noId(summary.pendingAssignees, watcher.id) &&
        noId(summary.completedAssignees, watcher.id) &&
        noId(summary.blockedAssignees, watcher.id)
    );
    check(
      'participant-status response returns updated aggregateSummary',
      participantStatusResult.task.aggregateSummary?.pendingAssignees?.[0]?.statusNote === 'pending note'
    );

    const detail = await taskService.getById({
      id: mixedTask.id,
      companyId: company.id,
      user: userCtx(owner),
    });
    check(
      'getById returns aggregateSummary',
      detail.aggregateSummary?.assigneesTotal === 3 &&
        detail.aggregateSummary.progressPercent === 33
    );

    const listed = await taskService.list({
      query: { limit: 50 },
      companyId: company.id,
      user: userCtx(owner),
    });
    const listedTask = listed.rows.find((row) => String(row.id) === String(mixedTask.id));
    check(
      'list returns aggregateSummary for each task',
      listedTask?.aggregateSummary?.assigneesTotal === 3 &&
        listedTask.aggregateSummary.assigneesBlocked === 1
    );

    const calendar = await taskService.listCalendar({
      query: { from: '2026-01-01', to: '2027-01-01' },
      companyId: company.id,
      user: userCtx(owner),
    });
    const calendarTask = calendar.find((row) => String(row.id) === String(mixedTask.id));
    check(
      'listCalendar returns aggregateSummary',
      calendarTask?.aggregateSummary?.assigneesTotal === 3 &&
        calendarTask.aggregateSummary.progressPercent === 33
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
