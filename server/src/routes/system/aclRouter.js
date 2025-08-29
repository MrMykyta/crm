const aclRouter = require('express').Router();
const { auth } = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const AclController = require('../../controllers/system/Acl.controller');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const roleSchema = require('../../schemas/roleSchema');
const permissionSchema = require('../../schemas/permissionSchema');

// ROLES (company-scoped)
aclRouter.post('/roles', auth, authorize('company:update'), validateBody(roleSchema.create), AclController.createRole);
aclRouter.get('/roles', auth, authorize('company:read'), validateQuery(roleSchema.listQuery), AclController.listRoles);
aclRouter.get('/roles/:roleId', auth, authorize('company:read'), AclController.getRole);
aclRouter.put('/roles/:roleId', auth, authorize('company:update'), validateBody(roleSchema.update), AclController.updateRole);
aclRouter.delete('/roles/:roleId', auth, authorize('company:update'), AclController.deleteRole);

// ROLE ↔ PERMISSIONS
aclRouter.post('/roles/:roleId/permissions/:permId', auth, authorize('company:update'), AclController.assignPermToRole);
aclRouter.delete('/roles/:roleId/permissions/:permId', auth, authorize('company:update'), AclController.removePermFromRole);

// USERS ↔ ROLES
aclRouter.post('/users/:userId/roles/:roleId', auth, authorize('company:update'), AclController.assignRoleToUser);
aclRouter.delete('/users/:userId/roles/:roleId', auth, authorize('company:update'), AclController.removeRoleFromUser);

// USERS ↔ PERMISSIONS (extra per-user)
aclRouter.post('/users/:userId/permissions/:permId', auth, authorize('company:update'), AclController.grantPermToUser);
aclRouter.delete('/users/:userId/permissions/:permId', auth, authorize('company:update'), AclController.revokePermFromUser);

// PERMISSIONS (global catalog, но CRUD доступен админам компании)
aclRouter.post('/permissions', auth, authorize('company:update'), validateBody(permissionSchema.create), AclController.createPermission);
aclRouter.get('/permissions', auth, authorize('company:read'), validateQuery(permissionSchema.listQuery), AclController.listPermissions);
aclRouter.get('/permissions/:permId', auth, authorize('company:read'), AclController.getPermission);
aclRouter.put('/permissions/:permId', auth, authorize('company:update'), validateBody(permissionSchema.update), AclController.updatePermission);
aclRouter.delete('/permissions/:permId', auth, authorize('company:update'), AclController.deletePermission);

module.exports = aclRouter;
