const aclService = require('../../services/system/aclService');

const {UserPermission} = require('../../models');


// ---- Roles ----
module.exports.createRole = async (req, res) => {
    try {
        const created = await aclService.createRole({
            companyId: req.companyId,
            name: req.body.name,
            description: req.body.description || null,
        });
        res.status(201).json(created);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

module.exports.listRoles = async (req, res) => {
    try {
        const list = await aclService.listRoles({ companyId: req.companyId, query: req.query });
        res.json(list);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

module.exports.getRole = async (req, res) => {
    try {
        const item = await aclService.getRole({ companyId: req.companyId, roleId: req.params.roleId });
        if (!item) {
            res.sendStatus(404);
        }
        res.status(200).send(item);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

module.exports.updateRole = async (req, res) => {
    try {
        const updated = await aclService.updateRole({
        companyId: req.companyId,
        roleId: req.params.roleId,
        data: req.body
        });
        if (!updated) return res.sendStatus(404);
        res.status(200).send(updated);
    } catch (e) { 
        res.status(400).send({ error: e.message }); 
    }
};

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
        await aclService.assignRoleToUser({ userId: req.params.userId, companyId: req.user.companyId, roleId: req.params.roleId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

module.exports.removeRoleFromUser = async (req, res) => {
    try {
        await aclService.removeRoleFromUser({ userId: req.params.userId, companyId: req.user.companyId, roleId: req.params.roleId });
        res.sendStatus(204);
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
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

module.exports.listPermissions = async (req, res) => {
    try { 
        res.send(await aclService.listPermissions({ query: req.query })); 
    } catch (e) { 
        res.status(400).json({ error: e.message }); 
    }
};

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


module.exports.getUserPermSummary = async (req, res) => {
  try {
    const data = await aclService.getUserPermissionSummary({
      companyId: req.companyId || req.user?.companyId,
      userId: req.params.userId,
    });
    if (!data) return res.sendStatus(404);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports.allowPermForUser = async (req, res) => {
  try {
    await aclService.allowPermForUser({
      userId: req.params.userId,
      companyId: req.companyId,        // ← из токена/мидлвари
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

module.exports.denyPermForUser = async (req, res) => {
  try {
    await aclService.denyPermForUser({
      userId: req.params.userId,
      companyId: req.companyId,
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

module.exports.clearPermOverride = async (req, res) => {
  try {
    await aclService.clearPermOverride({
      userId: req.params.userId,
      companyId: req.companyId,
      permId: req.params.permId,
    });
    res.sendStatus(204);
  } catch (e) { res.status(400).json({ error: e.message }); }
};