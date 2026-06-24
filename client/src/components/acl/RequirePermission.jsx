import useAclPermissions, { hasAclRequirements, hasAclRequirement } from "../../hooks/useAclPermissions";
import ForbiddenPage from "../../pages/system/ForbiddenPage";

export default function RequirePermission({
  requiredPermission,
  requiredAnyPermission,
  requiredAllPermissions,
  children,
}) {
  const acl = useAclPermissions();
  const requirements = {
    requiredPermission,
    requiredAnyPermission,
    requiredAllPermissions,
  };

  if (!hasAclRequirement(requirements)) return children;

  if (acl.isLoading && !acl.hasResolvedPermissions) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!hasAclRequirements(acl, requirements)) {
    return <ForbiddenPage requiredPermission={requiredPermission} />;
  }

  return children;
}
