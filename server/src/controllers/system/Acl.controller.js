const aclService = require('../../services/system/aclService');

const {UserPermission} = require('../../models');

const sendAclError = (res, e) => {
    const status = Number(e?.statusCode || e?.status || 400);
    const httpStatus = status >= 400 && status <= 599 ? status : 400;
    const message = e?.message || 'Request failed';
    const payload = { error: message, message };
    if (e?.code) payload.code = e.code;
    if (e?.assignedCount !== undefined) payload.assignedCount = e.assignedCount;
    return res.status(httpStatus).json(payload);
};

// ---- Roles ----
module.exports.listRoleTemplates = async (req, res) => {
    try {
        const list = await aclService.listRoleTemplates();
        res.json(list);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

module.exports.createRoleFromTemplate = async (req, res) => {
    try {
        const created = await aclService.createRoleFromTemplate({
            companyId: req.user.companyId,
            templateId: req.params.templateId,
        });
        res.status(201).json(created);
    } catch (e) {
        sendAclError(res, e);
    }
};

module.exports.cloneRole = async (req, res) => {
    try {
        const created = await aclService.cloneRole({
            companyId: req.user.companyId,
            roleId: req.params.roleId,
        });
        if (!created) return res.sendStatus(404);
        res.status(201).json(created);
    } catch (e) {
        sendAclError(res, e);
    }
};

module.exports.resetDefaultRole = async (req, res) => {
    try {
        const updated = await aclService.resetDefaultRole({
            companyId: req.user.companyId,
            roleId: req.params.roleId,
        });
        if (!updated) return res.sendStatus(404);
        res.status(200).json(updated);
    } catch (e) {
        sendAclError(res, e);
    }
};

module.exports.getRoleDiff = async (req, res) => {
    try {
        const diff = await aclService.getRoleDiff({
            companyId: req.user.companyId,
            roleId: req.params.roleId,
            templateId: req.query.templateId,
        });
        if (!diff) return res.sendStatus(404);
        res.status(200).json(diff);
    } catch (e) {
        sendAclError(res, e);
    }
};

module.exports.reassignAndDeleteRole = async (req, res) => {
    try {
        const result = await aclService.reassignAndDeleteRole({
            companyId: req.user.companyId,
            roleId: req.params.roleId,
            targetRoleId: req.body.targetRoleId,
        });
        res.status(200).json(result);
    } catch (e) {
        sendAclError(res, e);
    }
};

module.exports.createRole = async (req, res) => {
    try {
        const created = await aclService.createRole({
            companyId: req.user.companyId,
            name: req.body.name,
            description: req.body.description || null,
        });
        res.status(201).json(created);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Возвращает список ролей и их настроек доступа.
module.exports.listRoles = async (req, res) => {
    try {
        const list = await aclService.listRoles({ companyId: req.user.companyId, query: req.query });
        res.json(list);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Возвращает одну роль по идентификатору.
module.exports.getRole = async (req, res) => {
    try {
        const item = await aclService.getRole({ companyId: req.user.companyId, roleId: req.params.roleId });
        if (!item) {
            res.sendStatus(404);
        }
        res.status(200).send(item);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

// Обновляет параметры роли и связанные права.
module.exports.updateRole = async (req, res) => {
    try {
        const updated = await aclService.updateRole({
        companyId: req.user.companyId,
        roleId: req.params.roleId,
        data: req.body
        });
        if (!updated) return res.sendStatus(404);
        res.status(200).send(updated);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

// Удаляет роль по идентификатору.
module.exports.deleteRole = async (req, res) => {
    try {
        const n = await aclService.deleteRole({ companyId: req.user.companyId, roleId: req.params.roleId });
        if (!n) {
            res.sendStatus(404);
        }
        res.status(204).send({ deleted: n });
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// ---- Role ↔ Permission ----
module.exports.assignPermToRole = async (req, res) => {
    try {
        await aclService.assignPermToRole({ companyId: req.user.companyId, roleId: req.params.roleId, permId: req.params.permId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Удаляет право из выбранной роли.
module.exports.removePermFromRole = async (req, res) => {
    try {
        await aclService.removePermFromRole({ companyId: req.user.companyId, roleId: req.params.roleId, permId: req.params.permId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// ---- User ↔ Role ----
module.exports.assignRoleToUser = async (req, res) => {
    try {
        await aclService.assignRoleToUser({
            userId: req.params.userId,
            companyId: req.user.companyId,
            roleId: req.params.roleId,
            currentUserId: req.user.id,
        });
        res.sendStatus(204);
    } catch (e) { 
        sendAclError(res, e);
    }
};

// Снимает роль с пользователя.
module.exports.removeRoleFromUser = async (req, res) => {
    try {
        await aclService.removeRoleFromUser({
            userId: req.params.userId,
            companyId: req.user.companyId,
            roleId: req.params.roleId,
            currentUserId: req.user.id,
        });
        res.sendStatus(204);
    } catch (e) { 
        sendAclError(res, e);
    }
};

// ---- User ↔ Permission ----
module.exports.grantPermToUser = async (req, res) => {
    try {
        await aclService.grantPermToUser({ userId: req.params.userId, permId: req.params.permId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Удаляет индивидуальное переопределение права у пользователя.
module.exports.revokePermFromUser = async (req, res) => {
    try {
        await aclService.revokePermFromUser({ userId: req.params.userId, permId: req.params.permId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// ---- Permissions (global catalog) ----
module.exports.createPermission = async (req, res) => {
    try { 
        res.status(201).json(await aclService.createPermission(req.body)); 
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Возвращает список доступных permission-ключей.
module.exports.listPermissions = async (req, res) => {
    try { 
        res.send(await aclService.listPermissions({ query: req.query })); 
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Возвращает одну permission-запись по идентификатору.
module.exports.getPermission = async (req, res) => {
    try {
        const p = await aclService.getPermission(req.params.permId);
        if (!p) {
            res.sendStatus(404);
        }
        res.status(200).send(p);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

// Обновляет параметры permission-записи.
module.exports.updatePermission = async (req, res) => {
    try {
        const p = await aclService.updatePermission(req.params.permId, req.body);
        if (!p) {
            res.sendStatus(404);
        }
        res.json(p);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

// Удаляет permission-запись.
module.exports.deletePermission = async (req, res) => {
    try {
        const n = await aclService.deletePermission(req.params.permId);
        if (!n) {
            res.sendStatus(404);
        }
        res.status(204).send({ deleted: n });
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};


// Возвращает сводку эффективных прав пользователя.
module.exports.getUserPermSummary = async (req, res) => {
  try {
    const data = await aclService.getUserPermissionSummary({
      companyId: req.user.companyId,
      userId: req.params.userId,
    });
    if (!data) return res.sendStatus(404);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// Явно разрешает право пользователю через override.
module.exports.allowPermForUser = async (req, res) => {
  try {
    await aclService.allowPermForUser({
      userId: req.params.userId,
      companyId: req.user.companyId,
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// Явно запрещает право пользователю через override.
module.exports.denyPermForUser = async (req, res) => {
  try {
    await aclService.denyPermForUser({
      userId: req.params.userId,
      companyId: req.user.companyId,
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// Сбрасывает override права пользователя к наследуемому состоянию.
module.exports.clearPermOverride = async (req, res) => {
  try {
    await aclService.clearPermOverride({
      userId: req.params.userId,
      companyId: req.user.companyId,
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
