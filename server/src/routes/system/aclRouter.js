const aclRouter = require('express').Router();
const { auth } = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const AclController = require('../../controllers/system/Acl.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const roleSchema = require('../../schemas/roleSchema');
const permissionSchema = require('../../schemas/permissionSchema');

const requirePermissionRead = authorize('permission:read');
const requireRoleCreate = authorize('role:create');
const requireRoleAssign = authorize('role:assign');
const requireRoleUpdate = authorize('role:update');
const requireRoleDelete = authorize('role:delete');
const requirePermissionAssign = authorize('permission:assign');

const canReadUserPermissionSummary = (req, res, next) => {
  const currentUserId = req.user?.id ? String(req.user.id) : null;
  const targetUserId = req.params?.userId ? String(req.params.userId) : null;

  if (currentUserId && targetUserId && currentUserId === targetUserId) {
    return next();
  }

  return requirePermissionRead(req, res, next);
};

// ROLES (company-scoped)
aclRouter.get('/role-templates', auth, authorize('role:read'), AclController.listRoleTemplates);
aclRouter.post('/role-templates/:templateId/roles', auth, requireRoleCreate, requirePermissionAssign, AclController.createRoleFromTemplate);
aclRouter.post('/roles', auth, authorize('role:create'), validateBody(roleSchema.create), AclController.createRole);
aclRouter.get('/roles', auth, authorize('role:read'), validateQuery(roleSchema.listQuery), AclController.listRoles);
aclRouter.get('/roles/:roleId/diff', auth, authorize('role:read'), AclController.getRoleDiff);
aclRouter.post('/roles/:roleId/clone', auth, requireRoleCreate, requirePermissionAssign, AclController.cloneRole);
aclRouter.post('/roles/:roleId/reset-default', auth, requireRoleUpdate, requirePermissionAssign, AclController.resetDefaultRole);
aclRouter.post('/roles/:roleId/reassign-delete', auth, requireRoleAssign, requireRoleDelete, AclController.reassignAndDeleteRole);
aclRouter.get('/roles/:roleId', auth, authorize('role:read'), AclController.getRole);
aclRouter.put('/roles/:roleId', auth, authorize('role:update'), validateBody(roleSchema.update), AclController.updateRole);
aclRouter.delete('/roles/:roleId', auth, authorize('role:delete'), AclController.deleteRole);

// ROLE ↔ PERMISSIONS
aclRouter.post('/roles/:roleId/permissions/:permId', auth, authorize('permission:assign'), AclController.assignPermToRole);
aclRouter.delete('/roles/:roleId/permissions/:permId', auth, authorize('permission:assign'), AclController.removePermFromRole);

// USERS ↔ ROLES
aclRouter.post('/users/:userId/roles/:roleId', auth, authorize('role:assign'), AclController.assignRoleToUser);
aclRouter.delete('/users/:userId/roles/:roleId', auth, authorize('role:assign'), AclController.removeRoleFromUser);

// USERS ↔ PERMISSIONS (extra per-user)
aclRouter.post('/users/:userId/permissions/:permId', auth, authorize('permission:assign'), AclController.grantPermToUser);
aclRouter.delete('/users/:userId/permissions/:permId', auth, authorize('permission:assign'), AclController.revokePermFromUser);
aclRouter.get('/users/:userId/permissions/summary', auth, canReadUserPermissionSummary, AclController.getUserPermSummary);

// PERMISSIONS (global catalog, но CRUD доступен админам компании)
aclRouter.post('/permissions', auth, authorize('permission:manage'), validateBody(permissionSchema.create), AclController.createPermission);
aclRouter.get('/permissions', auth, authorize('permission:read'), validateQuery(permissionSchema.listQuery), AclController.listPermissions);
aclRouter.get('/permissions/:permId', auth, authorize('permission:read'), AclController.getPermission);
aclRouter.put('/permissions/:permId', auth, authorize('permission:manage'), validateBody(permissionSchema.update), AclController.updatePermission);
aclRouter.delete('/permissions/:permId', auth, authorize('permission:manage'), AclController.deletePermission);


// routes/system/aclRouter.js
aclRouter.post   ('/users/:userId/permissions/:permId/allow', auth, authorize('permission:assign'), AclController.allowPermForUser);
aclRouter.post   ('/users/:userId/permissions/:permId/deny',  auth, authorize('permission:assign'), AclController.denyPermForUser);
aclRouter.delete ('/users/:userId/permissions/:permId',       auth, authorize('permission:assign'), AclController.clearPermOverride);


module.exports = aclRouter;
