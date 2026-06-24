import { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useUserPermSummaryQuery } from '../store/rtk/aclApi';

export function hasAclRequirements(acl, requirements = {}) {
  const requiredPermission = requirements.requiredPermission;
  const requiredAnyPermission = requirements.requiredAnyPermission;
  const requiredAllPermissions = requirements.requiredAllPermissions;

  if (requiredPermission && !acl.can(requiredPermission)) return false;
  if (Array.isArray(requiredAnyPermission) && requiredAnyPermission.length && !acl.hasAny(requiredAnyPermission)) return false;
  if (Array.isArray(requiredAllPermissions) && requiredAllPermissions.length && !acl.hasAll(requiredAllPermissions)) return false;
  return true;
}

export function hasAclRequirement(requirements = {}) {
  return Boolean(
    requirements.requiredPermission ||
    (Array.isArray(requirements.requiredAnyPermission) && requirements.requiredAnyPermission.length) ||
    (Array.isArray(requirements.requiredAllPermissions) && requirements.requiredAllPermissions.length)
  );
}

export default function useAclPermissions() {
  const userId = useSelector((state) => state.auth?.currentUser?.id || null);
  const { data, isLoading, isFetching, isError } = useUserPermSummaryQuery(userId, {
    skip: !userId,
  });

  const hasResolvedPermissions = Array.isArray(data?.permissions);

  const effectiveSet = useMemo(() => {
    if (!hasResolvedPermissions) return new Set();
    const list = data.permissions
      .filter((perm) => Boolean(perm?.effective) && perm?.name)
      .map((perm) => String(perm.name));
    return new Set(list);
  }, [data?.permissions, hasResolvedPermissions]);

  const can = useCallback((permission) => {
    if (!permission) return true;
    if (hasResolvedPermissions) {
      return effectiveSet.has(String(permission));
    }
    // During bootstrap keep UI responsive; if ACL request failed, lock guarded actions.
    if (isError && !isLoading && !isFetching) return false;
    return effectiveSet.has(String(permission));
  }, [effectiveSet, hasResolvedPermissions, isError, isLoading, isFetching]);

  const hasAny = useCallback((permissions = []) => {
    if (!Array.isArray(permissions) || !permissions.length) return true;
    return permissions.some((perm) => can(perm));
  }, [can]);

  const hasAll = useCallback((permissions = []) => {
    if (!Array.isArray(permissions) || !permissions.length) return true;
    return permissions.every((perm) => can(perm));
  }, [can]);

  return {
    can,
    hasAny,
    hasAll,
    isLoading: isLoading || isFetching,
    isError,
    hasResolvedPermissions,
  };
}
