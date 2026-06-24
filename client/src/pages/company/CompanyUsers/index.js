import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  Clock,
  ListChecks,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";

import DataTable from "../../../components/data/DataTable";
import ConfirmDialog from "../../../components/dialogs/ConfirmDialog";
import InviteUserModal from "../../../components/dialogs/InviteUserModal";
import Modal from "../../../components/Modal";
import EmptyState from "../../../components/shared/EmptyState";
import PageHeader from "../../../components/shared/PageHeader";
import StatusBadge from "../../../components/shared/StatusBadge";
import Tabs from "../../../components/shared/Tabs";
import { WmsEmptyState, WmsLoadingState, WmsStatusChip, WmsSurface } from "../../../components/wms/ui";
import { CheckboxField, SearchField, SelectField, TextareaField, TextField } from "../../../components/ui/fields";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";
import useAclPermissions from "../../../hooks/useAclPermissions";
import {
  useInviteUserMutation,
  useListCompanyUsersQuery,
  useListInvitationsQuery,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
  useUpdateUserRoleMutation,
} from "../../../store/rtk/companyUsersApi";
import {
  useCreateRoleFromTemplateMutation,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useAssignPermToRoleMutation,
  useCloneRoleMutation,
  useGetRoleDiffQuery,
  useListRoleTemplatesQuery,
  useListPermissionsQuery,
  useReassignAndDeleteRoleMutation,
  useRemovePermFromRoleMutation,
  useResetDefaultRoleMutation,
  useListRolesQuery,
  useUpdateRoleMutation,
} from "../../../store/rtk/aclApi";
import {
  useArchiveDepartmentMutation,
  useCreateDepartmentMutation,
  useGetCounterpartyScopeReadinessQuery,
  useGetDepartmentQuery,
  useListDepartmentsQuery,
  useRestoreDepartmentMutation,
  useUpdateDepartmentMutation,
} from "../../../store/rtk/departmentsApi";
import s from "./OrganizationPage.module.css";

const VALID_TABS = new Set(["people", "invitations", "roles", "departments"]);

const ROLE_KEYS = {
  owner: "organization.owner",
  admin: "organization.admin",
  manager: "organization.manager",
  employee: "organization.employee",
  user: "organization.employee",
  viewer: "organization.viewer",
  sales: "organization.sales",
  operations: "organization.operations",
  accountant: "organization.accountant",
};

const PRIMARY_ROLE_PRIORITY = ["owner", "admin", "manager", "employee", "user", "viewer"];

const STATUS_KEYS = {
  active: "organization.active",
  invited: "organization.invited",
  pending: "organization.pending",
  accepted: "organization.accepted",
  suspended: "organization.suspended",
  revoked: "organization.revoked",
  expired: "organization.expired",
};

const ROLE_CAPABILITY_MODULES = [
  { key: "crm", labelKey: "organization.roles.modules.crm", matchers: ["counterparty:", "deal:", "task:", "contact:", "note:"] },
  { key: "pim", labelKey: "organization.roles.modules.pim", matchers: ["product:", "category:", "brand:", "attribute:", "product_type:", "variant:", "collection:", "tag:", "channel:", "uom:", "tax_category:", "shipping_class:"] },
  { key: "documents", labelKey: "organization.roles.modules.documents", matchers: ["document:"] },
  { key: "priceLists", labelKey: "organization.roles.modules.priceLists", matchers: ["price_list:"] },
  { key: "chat", labelKey: "organization.roles.modules.chat", matchers: ["chat.read", "chat.write", "chat:"] },
  { key: "users", labelKey: "organization.roles.modules.users", matchers: ["member:", "invitation:"] },
  { key: "accessControl", labelKey: "organization.roles.modules.accessControl", matchers: ["role:", "permission:"] },
  { key: "settings", labelKey: "organization.roles.modules.settings", matchers: ["settings:", "company:settings:", "company:update", "company:delete"] },
  { key: "wms", labelKey: "organization.roles.modules.wms", matchers: ["wms:"] },
  { key: "oms", labelKey: "organization.roles.modules.oms", matchers: ["oms:", "order:", "shipment:", "payment:", "promotion:", "coupon:"] },
];

const PEOPLE_ACCESS_MODULES = ROLE_CAPABILITY_MODULES.filter((group) => (
  ["crm", "pim", "documents", "wms"].includes(group.key)
));

const ROLE_SUMMARY_MODULE_KEYS = ["crm", "pim", "documents", "users"];

const RAW_PERMISSION_GROUPS = [
  { key: "core", labelKey: "organization.roles.rawGroups.core", matchers: ["company:", "settings:", "member:", "role:", "permission:"] },
  { key: "crm", labelKey: "organization.roles.rawGroups.crm", matchers: ["counterparty:", "deal:", "task:", "contact:", "note:", "document:", "price_list:"] },
  { key: "pim", labelKey: "organization.roles.rawGroups.pim", matchers: ["product:", "category:", "brand:", "attribute:", "product_type:", "variant:", "collection:", "tag:", "channel:", "uom:", "tax_category:", "shipping_class:"] },
  { key: "oms", labelKey: "organization.roles.rawGroups.oms", matchers: ["oms:", "order:", "shipment:", "payment:", "promotion:", "coupon:"] },
  { key: "wms", labelKey: "organization.roles.rawGroups.wms", matchers: ["wms:"] },
  { key: "system", labelKey: "organization.roles.rawGroups.system", matchers: ["file:", "attachment:", "chat.", "chat:", "notification:", "workspace_view:", "invitation:"] },
];

const ROLE_PERMISSION_EDITOR_GROUPS = [
  { key: "crm", labelKey: "organization.roles.modules.crm", matchers: ["counterparty:", "deal:", "task:", "contact:", "note:"] },
  { key: "pim", labelKey: "organization.roles.modules.pim", matchers: ["product:", "category:", "brand:", "attribute:", "product_type:", "variant:", "collection:", "tag:", "channel:", "uom:", "tax_category:", "shipping_class:"] },
  { key: "documents", labelKey: "organization.roles.modules.documents", matchers: ["document:"] },
  { key: "oms", labelKey: "organization.roles.modules.oms", matchers: ["oms:", "order:", "shipment:", "payment:", "promotion:", "coupon:"] },
  { key: "wms", labelKey: "organization.roles.modules.wms", matchers: ["wms:"] },
  { key: "system", labelKey: "organization.roles.rawGroups.system", matchers: ["file:", "attachment:", "chat.", "chat:", "notification:", "workspace_view:", "invitation:"] },
  { key: "accessControl", labelKey: "organization.roles.modules.accessControl", matchers: ["role:", "permission:", "member:", "company:", "settings:"] },
];

const DANGER_PERMISSION_NAMES = new Set([
  "company:delete",
  "company:settings:update",
  "member:delete",
  "file:delete",
]);

function getPersonName(row = {}) {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function roleLabel(t, role) {
  const key = ROLE_KEYS[String(role || "").toLowerCase()];
  return key ? t(key) : role || "—";
}

function statusLabel(t, status) {
  const key = STATUS_KEYS[String(status || "").toLowerCase()];
  return key ? t(key) : status || "—";
}

function roleDisplayName(role, t) {
  const raw = role?.name || role?.slug || role?.key || role;
  const normalized = String(raw || "").toLowerCase();
  const translated = roleLabel(t, normalized);
  return translated === normalized ? raw || "—" : translated;
}

function normalizeRoleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isLegacyUserAclRole(role) {
  return normalizeRoleKey(role?.slug || role?.name || role?.key) === "user";
}

function getRolePermissionNames(role) {
  const rows = Array.isArray(role?.permissions)
    ? role.permissions
    : Array.isArray(role?.Permissions)
      ? role.Permissions
      : [];
  return rows
    .map((permission) => permission?.name || permission?.code || permission?.slug || permission)
    .filter(Boolean)
    .map((name) => String(name));
}

function matchesPermission(name, matchers) {
  return matchers.some((matcher) => name === matcher || name.startsWith(matcher));
}

function summarizeRoleCapability(names, matchers) {
  const scoped = names.filter((name) => matchesPermission(name, matchers));
  if (!scoped.length) return "none";

  const hasFull = scoped.some((name) => (
    /(^|:)(delete|manage|assign|admin|publish|post|correct|cancel|archive|duplicate|restore)\b/.test(name) ||
    /\.write$/.test(name)
  ));
  if (hasFull) return "full";

  const hasWrite = scoped.some((name) => /(^|:)(create|update|upload|convert|write|invite|send|revoke)\b/.test(name));
  if (hasWrite) return "partial";

  return "read";
}

function groupPermissions(names) {
  const sorted = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  const grouped = RAW_PERMISSION_GROUPS.map((group) => ({
    ...group,
    items: sorted.filter((name) => matchesPermission(name, group.matchers)),
  }));
  const matched = new Set(grouped.flatMap((group) => group.items));
  const other = sorted.filter((name) => !matched.has(name));
  return other.length
    ? [...grouped, { key: "other", labelKey: "organization.roles.rawGroups.other", items: other }]
    : grouped;
}

function getPermissionName(permission) {
  return permission?.name || permission?.code || permission?.slug || permission || "";
}

function getPermissionId(permission) {
  return permission?.id || permission?.permissionId || null;
}

function permissionDisplayLabel(permission) {
  const name = String(getPermissionName(permission));
  return name
    .replace(/[.:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Permission";
}

function isDangerPermission(permission) {
  const name = String(getPermissionName(permission));
  return DANGER_PERMISSION_NAMES.has(name) ||
    name.startsWith("role:") ||
    name.startsWith("permission:");
}

function groupPermissionCatalog(permissions = []) {
  const sorted = [...permissions]
    .filter((permission) => getPermissionId(permission) && getPermissionName(permission))
    .sort((a, b) => String(getPermissionName(a)).localeCompare(String(getPermissionName(b))));
  const used = new Set();
  const groups = ROLE_PERMISSION_EDITOR_GROUPS.map((group) => {
    const items = sorted.filter((permission) => {
      const name = String(getPermissionName(permission));
      const matched = group.matchers.some((matcher) => name === matcher || name.startsWith(matcher));
      if (matched) used.add(String(getPermissionId(permission)));
      return matched;
    });
    return { ...group, items };
  });
  const other = sorted.filter((permission) => !used.has(String(getPermissionId(permission))));
  return other.length
    ? [...groups, { key: "other", labelKey: "organization.roles.rawGroups.other", items: other }]
    : groups;
}

function getRoleBadge(role, t) {
  if (role?.isSystem) {
    return { tone: "info", label: t("organization.roles.system") };
  }
  if (role?.isDefault) {
    return { tone: "success", label: t("organization.roles.default") };
  }
  return { tone: "neutral", label: t("organization.roles.custom") };
}

function buildRoleIndexes(roles) {
  return roles.reduce((acc, role) => {
    [role?.id, role?.slug, role?.name, role?.key].forEach((value) => {
      const key = normalizeRoleKey(value);
      if (key) acc.set(key, role);
    });
    return acc;
  }, new Map());
}

function resolveRoleReference(role, index) {
  const candidates = [role?.id, role?.slug, role?.name, role?.key, role].map(normalizeRoleKey).filter(Boolean);
  return candidates.map((candidate) => index.get(candidate)).find(Boolean) || role;
}

function roleIdentityValues(role) {
  const primitive = role && typeof role !== "object" ? role : null;
  return [role?.id, role?.slug, role?.name, role?.key, primitive]
    .map(normalizeRoleKey)
    .filter(Boolean);
}

function primaryRoleRank(role) {
  const keys = roleIdentityValues(role);
  const direct = keys
    .map((key) => PRIMARY_ROLE_PRIORITY.indexOf(key))
    .filter((index) => index >= 0);
  if (direct.length) return Math.min(...direct);
  if (role?.isSystem) return PRIMARY_ROLE_PRIORITY.length + 1;
  if (role?.isDefault) return PRIMARY_ROLE_PRIORITY.length + 2;
  return PRIMARY_ROLE_PRIORITY.length + 3;
}

function sortRolesForAssignment(roles, t) {
  return [...roles].sort((a, b) => {
    const rankDiff = primaryRoleRank(a) - primaryRoleRank(b);
    if (rankDiff) return rankDiff;
    return roleDisplayName(a, t).localeCompare(roleDisplayName(b, t));
  });
}

function getPrimaryAssignedRole(assignedRoles) {
  return sortRolesForAssignment(assignedRoles, (value) => value)[0] || null;
}

function getMemberRoleReferences(member, rolesIndex) {
  const rawRoles = Array.isArray(member?.roles) && member.roles.length
    ? member.roles
    : Array.isArray(member?.Roles) && member.Roles.length
      ? member.Roles
      : [member?.role].filter(Boolean);
  return rawRoles.map((role) => resolveRoleReference(role, rolesIndex)).filter(Boolean);
}

function getPrimaryMemberRole(member, rolesIndex) {
  const roles = getMemberRoleReferences(member, rolesIndex);
  return getPrimaryAssignedRole(roles) || resolveRoleReference(member?.role, rolesIndex);
}

function memberMatchesRole(member, roleFilter, rolesIndex) {
  if (!roleFilter || roleFilter === "all") return true;
  const roleKeys = getMemberRoleReferences(member, rolesIndex)
    .flatMap((role) => roleIdentityValues(role));
  return roleKeys.includes(normalizeRoleKey(roleFilter));
}

function getStatusTone(status) {
  const normalized = normalizeRoleKey(status);
  if (["active", "accepted"].includes(normalized)) return "success";
  if (["pending", "invited"].includes(normalized)) return "info";
  if (["suspended", "expired"].includes(normalized)) return "warning";
  if (["revoked", "deleted", "blocked"].includes(normalized)) return "danger";
  return "neutral";
}

function getRoleTypeTone(role) {
  if (role?.isSystem) return "info";
  if (role?.isDefault) return "success";
  return "neutral";
}

function isCustomRole(role) {
  return Boolean(role && !role.isSystem && !role.isDefault);
}

function isResettableDefaultRole(role) {
  const key = normalizeRoleKey(role?.slug || role?.name || role?.key);
  return Boolean(role?.isDefault && !role?.isSystem && ["manager", "employee", "viewer"].includes(key));
}

function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || "Request failed";
}

function codeFromName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function accessSafetyMessage(error, t) {
  const raw = errorMessage(error);
  const normalized = raw.toLowerCase();
  if (
    (normalized.includes("last") && normalized.includes("owner")) ||
    (normalized.includes("послед") && normalized.includes("владель")) ||
    (normalized.includes("единствен") && normalized.includes("владель"))
  ) return t("organization.roles.lastOwnerProtected");
  if (normalized.includes("owner") || normalized.includes("admin") || normalized.includes("self")) {
    return t("organization.roles.adminOwnerProtected");
  }
  return raw;
}

function roleMatchesMember(role, member) {
  const roleKeys = new Set([role?.id, role?.slug, role?.name, role?.key].map(normalizeRoleKey).filter(Boolean));
  const rawRoles = [
    member?.role,
    ...(Array.isArray(member?.roles) ? member.roles : []),
    ...(Array.isArray(member?.Roles) ? member.Roles : []),
  ].filter(Boolean);
  return rawRoles.some((memberRole) => roleIdentityValues(memberRole).some((key) => roleKeys.has(key)));
}

function Avatar({ name = "", email = "", url = "", size = "md" }) {
  const initials =
    (name || email || "U")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "U";
  const { url: safeUrl, onError } = useSignedFileUrl(url);

  return (
    <span className={`${s.avatarWrap} ${s[`avatar_${size}`] || ""}`.trim()}>
      {safeUrl ? (
        <img
          className={s.avatarImg}
          src={safeUrl}
          alt=""
          onError={(event) => {
            onError();
            event.currentTarget.style.display = "none";
            event.currentTarget.nextSibling.style.display = "grid";
          }}
        />
      ) : null}
      <span className={s.avatar} style={{ display: safeUrl ? "none" : "grid" }}>
        {initials}
      </span>
    </span>
  );
}

function RoleChip({ role, t, variant = "default" }) {
  const normalized = String(role || "").toLowerCase();
  return (
    <span className={`${s.roleChip} ${s[`role_${normalized}`] || ""} ${s[`roleVariant_${variant}`] || ""}`.trim()}>
      {roleLabel(t, normalized)}
    </span>
  );
}

function DepartmentChip({ department, muted = false }) {
  const { t } = useTranslation();
  if (!department?.name) {
    return muted ? <span className={s.departmentMuted}>{t("organization.departmentDirectory.unassigned")}</span> : null;
  }
  return (
    <span className={s.departmentChip}>
      <Building2 size={12} />
      {department.name}
    </span>
  );
}

function getMemberDepartmentId(member) {
  return member?.departmentId || member?.department_id || member?.department?.id || null;
}

function getMemberDepartment(member, departments = []) {
  if (member?.department?.id || member?.department?.name) return member.department;
  const departmentId = getMemberDepartmentId(member);
  if (!departmentId) return null;
  return departments.find((department) => String(department.id) === String(departmentId)) || { id: departmentId, name: null };
}

function RoleTypeBadge({ role }) {
  const { t } = useTranslation();
  const badge = getRoleBadge(role, t);
  return (
    <StatusBadge tone={badge.tone} size="sm">
      {badge.label}
    </StatusBadge>
  );
}

function RoleSummaryStrip({ permissionNames }) {
  const { t } = useTranslation();
  const groups = ROLE_CAPABILITY_MODULES.filter((group) => ROLE_SUMMARY_MODULE_KEYS.includes(group.key));

  return (
    <div className={s.roleSummaryGrid}>
      {groups.map((group) => {
        const level = summarizeRoleCapability(permissionNames, group.matchers);
        return (
          <div key={group.key} className={s.roleSummaryItem}>
            <span>{t(group.labelKey)}</span>
            <strong className={s[`roleCapability_${level}`]}>{t(`organization.roles.levels.${level}`)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function templatePermissionRows(template) {
  return (Array.isArray(template?.permissions) ? template.permissions : [])
    .filter(Boolean)
    .map((name) => ({ name: String(name) }));
}

function templateLabel(t, template, field) {
  return t(`organization.roles.templates.${template?.slug || template?.id}.${field}`, {
    defaultValue: template?.[field] || "",
  });
}

function RoleTemplateCard({ template, disabled, busy, onCreate }) {
  const { t } = useTranslation();
  const permissionNames = Array.isArray(template?.permissions) ? template.permissions : [];
  const fakeRole = { permissions: templatePermissionRows(template) };

  return (
    <article className={s.roleTemplateCard}>
      <div className={s.roleTemplateMain}>
        <div>
          <h3>{templateLabel(t, template, "name")}</h3>
          <p>{templateLabel(t, template, "description")}</p>
        </div>
        <StatusBadge tone="info" size="sm">{t("organization.roles.templateBadge")}</StatusBadge>
      </div>
      <div className={s.roleTemplateMeta}>
        <span>{t("organization.roles.permissionCount", { count: permissionNames.length })}</span>
        <AccessIndicator role={fakeRole} />
      </div>
      <button className={s.secondaryButton} type="button" onClick={() => onCreate(template)} disabled={disabled || busy}>
        <Plus size={16} />
        {busy ? t("common.loading") : t("organization.roles.createFromTemplate")}
      </button>
    </article>
  );
}

function RoleTemplatesPanel({ templates, loading, canCreateFromTemplate, busyTemplateId, onCreate }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <section className={s.roleTemplates}>
        <div className={s.roleTemplatesHeader}>
          <h2>{t("organization.roles.templatesTitle")}</h2>
        </div>
        <p className={s.drawerMuted}>{t("common.loading")}</p>
      </section>
    );
  }
  if (!templates.length) return null;

  return (
    <section className={s.roleTemplates}>
      <div className={s.roleTemplatesHeader}>
        <div>
          <h2>{t("organization.roles.templatesTitle")}</h2>
          <p>{t("organization.roles.templatesHint")}</p>
        </div>
      </div>
      <div className={s.roleTemplateGrid}>
        {templates.map((template) => (
          <RoleTemplateCard
            key={template.id || template.slug}
            template={template}
            disabled={!canCreateFromTemplate}
            busy={busyTemplateId === String(template.id || template.slug)}
            onCreate={onCreate}
          />
        ))}
      </div>
      {!canCreateFromTemplate ? (
        <p className={s.drawerMuted}>{t("organization.roles.createTemplateRequiresPermissions")}</p>
      ) : null}
    </section>
  );
}

function PeopleKpiButton({ active, label, value, onClick }) {
  return (
    <WmsSurface
      as="button"
      variant="soft"
      padding="none"
      type="button"
      className={`${s.peopleKpi} ${active ? s.peopleKpiActive : ""}`.trim()}
      onClick={onClick}
    >
      <span className={s.peopleKpiValue}>{value}</span>
      <span className={s.peopleKpiLabel}>{label}</span>
    </WmsSurface>
  );
}

function getAccessSummaryTone(level) {
  if (level === "full") return "success";
  if (level === "partial") return "warning";
  if (level === "read") return "info";
  return "muted";
}

function AccessIndicator({ role }) {
  const { t } = useTranslation();
  const permissionNames = useMemo(() => getRolePermissionNames(role), [role]);
  const modules = useMemo(() => PEOPLE_ACCESS_MODULES.map((group) => ({
    ...group,
    level: summarizeRoleCapability(permissionNames, group.matchers),
  })), [permissionNames]);
  const activeModules = modules.filter((group) => group.level !== "none");
  const [primaryModule] = activeModules;
  const label = primaryModule
    ? `${t(primaryModule.labelKey)}${activeModules.length > 1 ? ` +${activeModules.length - 1}` : ""}`
    : t("organization.roles.levels.none");
  const tone = getAccessSummaryTone(primaryModule?.level || "none");
  const title = modules
    .map((group) => `${t(group.labelKey)}: ${t(`organization.roles.levels.${group.level}`)}`)
    .join(" · ");

  return (
    <span className={s.accessIndicatorWrap} title={title}>
      <WmsStatusChip tone={tone} marker="solid" size="sm" className={s.accessIndicator}>
        {label}
      </WmsStatusChip>
    </span>
  );
}

function PeopleRoleCell({ member, rolesIndex }) {
  const { t } = useTranslation();
  const roleRefs = getMemberRoleReferences(member, rolesIndex);
  const primaryRole = getPrimaryAssignedRole(roleRefs) || getPrimaryMemberRole(member, rolesIndex);
  const hasMultipleRoles = roleRefs.length > 1;

  return (
    <div className={s.peopleRoleCell}>
      <div className={s.peopleRoleLine}>
        <RoleChip role={primaryRole?.slug || primaryRole?.key || primaryRole?.name || member.role} t={t} />
        {primaryRole && typeof primaryRole === "object" ? (
          <span className={`${s.roleTypeBadge} ${s[`roleType_${getRoleTypeTone(primaryRole)}`] || ""}`.trim()}>
            {getRoleBadge(primaryRole, t).label}
          </span>
        ) : null}
        {hasMultipleRoles ? (
          <span className={s.multiRoleIndicator} title={t("organization.people.multipleRoles")} aria-label={t("organization.people.multipleRoles")}>
            +{roleRefs.length - 1}
          </span>
        ) : null}
      </div>
      <AccessIndicator role={primaryRole} />
    </div>
  );
}

function PeopleRow({ member, rolesIndex, departments, onOpen }) {
  const { t } = useTranslation();
  const name = getPersonName(member) || member.email || "—";
  const department = getMemberDepartment(member, departments);
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(member);
    }
  };

  return (
    <div
      className={s.peopleRow}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(member)}
      onKeyDown={handleKeyDown}
    >
      <span className={s.peopleIdentity}>
        <Avatar name={name} email={member.email} url={member.avatarUrl} />
        <span className={s.personText}>
          <strong>{name}</strong>
          <span>{member.email || "—"}</span>
          <span className={s.personMetaLine}>
            <DepartmentChip department={department} />
            {member.isLead ? (
              <span className={s.leadChip}>
                <UserCheck size={12} />
                {t("organization.lead")}
              </span>
            ) : null}
          </span>
        </span>
      </span>
      <span className={s.peopleStatus}>
        <WmsStatusChip tone={getStatusTone(member.status)} marker="solid" size="sm">
          {statusLabel(t, member.status)}
        </WmsStatusChip>
      </span>
      <PeopleRoleCell member={member} rolesIndex={rolesIndex} />
      <span className={s.peopleLastActive}>
        <Clock size={14} />
        {formatDateTime(member.lastLoginAt)}
      </span>
      <span className={s.peopleActions} onClick={(event) => event.stopPropagation()}>
        <button className={s.textButton} type="button" onClick={() => onOpen(member)}>
          <UserRound size={15} />
          {t("organization.people.open")}
        </button>
      </span>
    </div>
  );
}

function PeopleListPanel({ members, loading, rolesIndex, departments, onOpen }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <WmsSurface variant="panel" padding="md" className={s.peoplePanel}>
        <WmsLoadingState title={t("common.loading")} rows={6} />
      </WmsSurface>
    );
  }

  if (!members.length) {
    return (
      <WmsSurface variant="panel" padding="md" className={s.peoplePanel}>
        <WmsEmptyState title={t("organization.noPeople")} />
      </WmsSurface>
    );
  }

  return (
    <WmsSurface variant="panel" padding="none" className={s.peoplePanel}>
      <div className={s.peopleHeaderRow} aria-hidden="true">
        <span>{t("organization.user")}</span>
        <span>{t("organization.status")}</span>
        <span>{t("organization.role")}</span>
        <span>{t("organization.lastActivity")}</span>
        <span>{t("organization.actions")}</span>
      </div>
      <div className={s.peopleRows}>
        {members.map((member) => (
          <PeopleRow
            key={member.userId || member.id || member.email}
            member={member}
            rolesIndex={rolesIndex}
            departments={departments}
            onOpen={onOpen}
          />
        ))}
      </div>
    </WmsSurface>
  );
}

function PermissionGroups({ permissionNames }) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupPermissions(permissionNames), [permissionNames]);
  const hasAny = groups.some((group) => group.items.length);

  if (!hasAny) {
    return <p className={s.drawerMuted}>{t("organization.roles.noPermissions")}</p>;
  }

  return (
    <div className={s.permissionGroups}>
      {groups.map((group) => (
        <details key={group.key} className={s.permissionGroup} open={group.items.length > 0 && group.key === "core"}>
          <summary>
            <span>{t(group.labelKey)}</span>
            <span>{group.items.length}</span>
          </summary>
          <div className={s.permissionList}>
            {group.items.map((name) => (
              <span key={name} className={s.permissionPill}>{name}</span>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function RolePermissionEditor({
  role,
  permissions,
  loading,
  canReadPermissions,
  canAssignPermissions,
  onToast,
}) {
  const { t } = useTranslation();
  const [busyKey, setBusyKey] = useState("");
  const [assignPermToRole] = useAssignPermToRoleMutation();
  const [removePermFromRole] = useRemovePermFromRoleMutation();
  const editable = isCustomRole(role);
  const canToggle = editable && canReadPermissions && canAssignPermissions;
  const assignedNames = useMemo(() => new Set(getRolePermissionNames(role)), [role]);
  const groups = useMemo(() => groupPermissionCatalog(permissions), [permissions]);
  const hasPermissions = groups.some((group) => group.items.length);

  const togglePermission = async (permission, checked) => {
    const permId = getPermissionId(permission);
    const permName = getPermissionName(permission);
    if (!role?.id || !permId || !canToggle || busyKey) return;
    setBusyKey(String(permId));
    try {
      if (checked) {
        await assignPermToRole({ roleId: role.id, permId }).unwrap();
        onToast?.({ type: "success", text: t("organization.roles.permissionAdded", { permission: permName }) });
      } else {
        await removePermFromRole({ roleId: role.id, permId }).unwrap();
        onToast?.({ type: "success", text: t("organization.roles.permissionRemoved", { permission: permName }) });
      }
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    } finally {
      setBusyKey("");
    }
  };

  if (!editable) {
    return (
      <div className={s.permissionEditorNotice}>
        <ShieldCheck size={16} />
        <span>{t("organization.roles.systemRolePermissionsReadOnly")}</span>
      </div>
    );
  }

  return (
    <div className={s.permissionEditor}>
      <div className={s.permissionEditorIntro}>
        <div>
          <h4>{t("organization.roles.permissionEditorTitle")}</h4>
          <p>{t("organization.roles.permissionEditorHint")}</p>
        </div>
        {!canAssignPermissions ? (
          <StatusBadge tone="warning" size="sm">{t("organization.roles.permissionAssignRequired")}</StatusBadge>
        ) : null}
      </div>
      {!canReadPermissions ? (
        <div className={s.permissionEditorNotice}>
          <AlertTriangle size={16} />
          <span>{t("organization.roles.permissionReadRequired")}</span>
        </div>
      ) : null}
      {loading ? <p className={s.drawerMuted}>{t("common.loading")}</p> : null}
      {!loading && canReadPermissions && !hasPermissions ? (
        <p className={s.drawerMuted}>{t("organization.roles.noPermissions")}</p>
      ) : null}
      {!loading && canReadPermissions && hasPermissions ? (
        <div className={s.permissionEditorGroups}>
          {groups.filter((group) => group.items.length).map((group) => (
            <details key={group.key} className={s.permissionEditorGroup} open={group.items.some((permission) => assignedNames.has(String(getPermissionName(permission))))}>
              <summary>
                <span>{t(group.labelKey)}</span>
                <span>{group.items.length}</span>
              </summary>
              <div className={s.permissionEditorList}>
                {group.items.map((permission) => {
                  const permId = getPermissionId(permission);
                  const permName = String(getPermissionName(permission));
                  const checked = assignedNames.has(permName);
                  const danger = isDangerPermission(permission);
                  const disabled = !canToggle || busyKey === String(permId);
                  return (
                    <div key={permId} className={`${s.permissionEditorRow} ${checked ? s.permissionEditorRowActive : ""}`.trim()}>
                      <CheckboxField
                        name={`role-permission-${permId}`}
                        label={permissionDisplayLabel(permission)}
                        checked={checked}
                        disabled={disabled}
                        size="sm"
                        onValueChange={(nextChecked) => togglePermission(permission, nextChecked)}
                      />
                      <div className={s.permissionEditorMeta}>
                        <code>{permName}</code>
                        {danger ? <span className={s.dangerPermissionBadge}>{t("organization.roles.dangerPermission")}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RoleCard({ role, selected, memberCount, canReadMembers, onSelect }) {
  const { t } = useTranslation();
  const permissionNames = useMemo(() => getRolePermissionNames(role), [role]);
  const normalized = normalizeRoleKey(role?.slug || role?.name || role?.key);
  const elevated = ["owner", "admin"].includes(normalized);

  return (
    <button
      className={`${s.roleCard} ${selected ? s.roleCardActive : ""} ${elevated ? s.roleCardElevated : ""}`.trim()}
      type="button"
      onClick={onSelect}
    >
      <span className={s.roleCardHead}>
        <span>
          <strong>{roleDisplayName(role, t)}</strong>
          <small>{role?.description || role?.slug || role?.key || "—"}</small>
        </span>
        <RoleTypeBadge role={role} />
      </span>
      <span className={s.roleCardMeta}>
        <span>{t("organization.roles.permissionsCount", { count: permissionNames.length })}</span>
        <span>{canReadMembers ? t("organization.roles.memberCount", { count: memberCount }) : t("organization.roles.memberCountUnavailable")}</span>
      </span>
    </button>
  );
}

function RoleUsersList({ users, canReadMembers }) {
  const { t } = useTranslation();

  if (!canReadMembers) {
    return <p className={s.drawerMuted}>{t("organization.roles.memberReadRequired")}</p>;
  }
  if (!users.length) {
    return <p className={s.drawerMuted}>{t("organization.roles.usersPlaceholder")}</p>;
  }

  return (
    <div className={s.roleUsersList}>
      {users.slice(0, 8).map((user) => {
        const name = getPersonName(user) || user.email || "—";
        return (
          <div key={user.userId || user.email} className={s.roleUserRow}>
            <Avatar name={name} email={user.email} url={user.avatarUrl} size="sm" />
            <span>{name}</span>
          </div>
        );
      })}
      {users.length > 8 ? <span className={s.drawerMuted}>{t("organization.roles.moreUsers", { count: users.length - 8 })}</span> : null}
    </div>
  );
}

function RoleDiffPanel({ role, templates }) {
  const { t } = useTranslation();
  const templateOptions = useMemo(() => (
    templates.map((template) => ({
      value: template.id || template.slug,
      label: templateLabel(t, template, "name"),
    }))
  ), [templates, t]);
  const [templateId, setTemplateId] = useState(templateOptions[0]?.value || "");
  const useTemplate = isCustomRole(role) && templateOptions.length > 0;
  const activeTemplateId = templateId || templateOptions[0]?.value || "";
  const queryArg = role?.id
    ? { roleId: role.id, templateId: useTemplate ? activeTemplateId : undefined }
    : null;
  const { data, isFetching } = useGetRoleDiffQuery(queryArg, { skip: !queryArg || (useTemplate && !activeTemplateId) });
  const added = Array.isArray(data?.added) ? data.added : [];
  const removed = Array.isArray(data?.removed) ? data.removed : [];

  if (!role?.id || (!role?.isDefault && !useTemplate)) return null;

  return (
    <section className={s.detailsSection}>
      <div className={s.sectionHeaderLine}>
        <h3>{useTemplate ? t("organization.roles.compareWithTemplate") : t("organization.roles.compareWithDefault")}</h3>
        {useTemplate ? (
          <SelectField
            name="roleDiffTemplate"
            label={t("organization.roles.template")}
            value={activeTemplateId}
            options={templateOptions}
            onValueChange={setTemplateId}
            size="sm"
          />
        ) : null}
      </div>
      {isFetching ? <p className={s.drawerMuted}>{t("common.loading")}</p> : null}
      {!isFetching ? (
        <div className={s.roleDiffGrid}>
          <div>
            <strong>{t("organization.roles.permissionsAdded")}</strong>
            {added.length ? (
              <div className={s.permissionList}>
                {added.map((name) => <span key={name} className={s.permissionPill}>{name}</span>)}
              </div>
            ) : <span className={s.drawerMuted}>{t("organization.roles.noPermissionChanges")}</span>}
          </div>
          <div>
            <strong>{t("organization.roles.permissionsRemoved")}</strong>
            {removed.length ? (
              <div className={s.permissionList}>
                {removed.map((name) => <span key={name} className={s.permissionPill}>{name}</span>)}
              </div>
            ) : <span className={s.drawerMuted}>{t("organization.roles.noPermissionChanges")}</span>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReassignRoleModal({ open, role, usersCount, roles, targetRoleId, busy, onTargetChange, onCancel, onConfirm }) {
  const { t } = useTranslation();
  const options = roles
    .filter((item) => item?.id && String(item.id) !== String(role?.id))
    .map((item) => ({ value: item.id, label: roleDisplayName(item, t) }));
  const footer = (
    <>
      <Modal.Button onClick={onCancel} disabled={busy}>{t("common.cancel")}</Modal.Button>
      <Modal.Button variant="primary" onClick={onConfirm} disabled={busy || !targetRoleId}>
        {busy ? t("common.loading") : t("organization.roles.reassignAndDelete")}
      </Modal.Button>
    </>
  );

  return (
    <Modal
      open={open}
      title={t("organization.roles.reassignUsers")}
      size="md"
      onClose={busy ? undefined : onCancel}
      footer={footer}
    >
      <div className={s.reassignRoleBody}>
        <p>{t("organization.roles.roleAssignedUsers", { count: usersCount })}</p>
        <SelectField
          name="roleReassignTarget"
          label={t("organization.roles.targetRole")}
          value={targetRoleId}
          options={options}
          onValueChange={onTargetChange}
          searchable
        />
      </div>
    </Modal>
  );
}

function RoleFormPanel({ mode, initialRole, saving, error, onCancel, onSubmit }) {
  const { t } = useTranslation();
  const initialName = initialRole?.name || "";
  const initialDescription = initialRole?.description || "";
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const trimmedName = name.trim();
  const isEdit = mode === "edit";
  const hasChanges = isEdit
    ? trimmedName !== initialName.trim() || description.trim() !== initialDescription.trim()
    : Boolean(trimmedName || description.trim());

  const submit = (event) => {
    event.preventDefault();
    if (!trimmedName || saving || !hasChanges) return;
    onSubmit({
      name: trimmedName,
      description: description.trim() || null,
    });
  };

  return (
    <form className={s.roleForm} onSubmit={submit}>
      <div className={s.roleFormHeader}>
        <div>
          <h3>{isEdit ? t("organization.roles.editCustomRole") : t("organization.roles.createCustomRole")}</h3>
          <p>{t("organization.roles.customRoleHint")}</p>
        </div>
      </div>
      {error ? <div className={s.formError}>{error}</div> : null}
      <div className={s.roleFormFields}>
        <TextField
          name="roleName"
          label={t("organization.roles.name")}
          value={name}
          onValueChange={setName}
          maxLength={64}
          required
        />
        <TextareaField
          name="roleDescription"
          label={t("organization.roles.description")}
          value={description}
          onValueChange={setDescription}
          rows={3}
          maxLength={256}
        />
      </div>
      <div className={s.roleFormActions}>
        <button className={s.secondaryButton} type="button" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        {hasChanges ? (
          <button className={s.primaryButton} type="submit" disabled={saving || !trimmedName}>
            {saving ? t("common.loading") : (isEdit ? t("organization.roles.saveChanges") : t("common.save"))}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function RoleIdentityEditor({ role, onToast }) {
  const { t } = useTranslation();
  const initialName = role?.name || "";
  const initialDescription = role?.description || "";
  const [savedName, setSavedName] = useState(initialName);
  const [savedDescription, setSavedDescription] = useState(initialDescription);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState("");
  const [updateRole, { isLoading }] = useUpdateRoleMutation();
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const hasChanges = trimmedName !== savedName.trim() || trimmedDescription !== savedDescription.trim();

  const reset = () => {
    setName(savedName);
    setDescription(savedDescription);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!role?.id || !trimmedName || !hasChanges || isLoading) return;
    setError("");
    try {
      await updateRole({
        roleId: role.id,
        body: {
          name: trimmedName,
          description: trimmedDescription || null,
        },
      }).unwrap();
      setSavedName(trimmedName);
      setSavedDescription(trimmedDescription);
      onToast?.({ type: "success", text: t("organization.roles.roleUpdated") });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <form className={s.roleIdentityForm} onSubmit={submit}>
      <div className={s.roleIdentityFields}>
        <TextField
          name="roleIdentityName"
          label={t("organization.roles.name")}
          value={name}
          onValueChange={setName}
          maxLength={64}
          required
          size="sm"
        />
        <TextareaField
          name="roleIdentityDescription"
          label={t("organization.roles.description")}
          value={description}
          onValueChange={setDescription}
          rows={2}
          maxLength={256}
          size="sm"
        />
      </div>
      {error ? <div className={s.formError}>{error}</div> : null}
      {hasChanges ? (
        <div className={s.roleSaveBar}>
          <span>{t("organization.roles.unsavedChanges")}</span>
          <div>
            <button className={s.secondaryButton} type="button" onClick={reset} disabled={isLoading}>
              {t("common.cancel")}
            </button>
            <button className={s.primaryButton} type="submit" disabled={isLoading || !trimmedName}>
              {isLoading ? t("common.loading") : t("organization.roles.saveChanges")}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function RoleDetails({
  role,
  templates,
  members,
  permissions,
  permissionsLoading,
  canReadMembers,
  canReadPermissions,
  canAssignPermissions,
  canManagePermissions,
  canCreateRole,
  canUpdateRole,
  canDeleteRole,
  canAssignRole,
  cloningRoleId,
  resettingRoleId,
  onClone,
  onReset,
  onDelete,
  onReassign,
  onToast,
}) {
  const { t } = useTranslation();
  const [showPermissions, setShowPermissions] = useState(false);
  const permissionNames = useMemo(() => getRolePermissionNames(role), [role]);
  const roleUsers = useMemo(() => members.filter((member) => roleMatchesMember(role, member)), [members, role]);
  const canEditSelectedRole = canUpdateRole && isCustomRole(role);
  const canCloneSelectedRole = canCreateRole && canAssignPermissions && role?.id && !role?.isSystem && (role?.isDefault || isCustomRole(role));
  const canResetSelectedRole = canUpdateRole && canAssignPermissions && isResettableDefaultRole(role);
  const canDeleteSelectedRole = canDeleteRole && isCustomRole(role) && roleUsers.length === 0;
  const canReassignSelectedRole = canDeleteRole && canAssignRole && isCustomRole(role) && roleUsers.length > 0;
  const canOpenPermissionEditor = isCustomRole(role) && canManagePermissions;

  if (!role) {
    return (
      <section className={s.roleDetails}>
        <EmptyState size="sm" icon={ShieldCheck} title={t("organization.roles.noRoleSelected")} />
      </section>
    );
  }

  return (
    <section className={s.roleDetails}>
      <div className={s.roleHero}>
        <div className={s.roleHeroMain}>
          <div className={s.roleHeroTitle}>
            <h2>{roleDisplayName(role, t)}</h2>
            <p>{role?.description || t("organization.roles.noDescription")}</p>
          </div>
          <div className={s.roleHeroBadges}>
            <RoleTypeBadge role={role} />
            {permissionNames.length === 0 ? (
              <span className={s.roleEmptyWarning}>
                <AlertTriangle size={14} />
                {t("organization.roles.emptyRoleWarning")}
              </span>
            ) : null}
          </div>
        </div>
        <div className={s.roleHeroStats}>
          <div>
            <span>{t("organization.roles.users")}</span>
            <strong>{canReadMembers ? roleUsers.length : "—"}</strong>
          </div>
          <div>
            <span>{t("organization.roles.permissions")}</span>
            <strong>{permissionNames.length}</strong>
          </div>
        </div>
      </div>

      <section className={s.detailsSection}>
        <div className={s.sectionHeaderLine}>
          <h3>{t("organization.roles.roleSummary")}</h3>
          <div className={s.roleDetailsActions}>
            {canCloneSelectedRole ? (
              <button className={s.secondaryButton} type="button" onClick={() => onClone(role)} disabled={cloningRoleId === String(role.id)}>
                <Plus size={16} />
                {cloningRoleId === String(role.id) ? t("common.loading") : t("organization.roles.cloneRole")}
              </button>
            ) : null}
            {canResetSelectedRole ? (
              <button className={s.secondaryButton} type="button" onClick={() => onReset(role)} disabled={resettingRoleId === String(role.id)}>
                <RotateCcw size={16} />
                {resettingRoleId === String(role.id) ? t("common.loading") : t("organization.roles.resetToDefault")}
              </button>
            ) : null}
            {canReassignSelectedRole ? (
              <button className={s.secondaryButton} type="button" onClick={() => onReassign(role, roleUsers)}>
                <UserCheck size={16} />
                {t("organization.roles.reassignUsers")}
              </button>
            ) : null}
            {canDeleteSelectedRole ? (
              <button className={s.dangerButton} type="button" onClick={() => onDelete(role, roleUsers)}>
                <Trash2 size={16} />
                {t("common.delete", "Delete")}
              </button>
            ) : null}
          </div>
        </div>
        {isCustomRole(role) && roleUsers.length > 0 ? (
          <div className={s.roleLifecycleNotice}>
            <AlertTriangle size={16} />
            <span>{t("organization.roles.roleAssignedUsers", { count: roleUsers.length })}</span>
          </div>
        ) : null}
        <RoleSummaryStrip permissionNames={permissionNames} />
      </section>

      <RoleDiffPanel role={role} templates={templates} />

      {canEditSelectedRole ? (
        <section className={s.detailsSection}>
          <h3>{t("organization.roles.roleInformation")}</h3>
          <RoleIdentityEditor key={role.id || role.name} role={role} onToast={onToast} />
        </section>
      ) : null}

      <section className={s.detailsSection}>
        <h3>{t("organization.roles.users")}</h3>
        <RoleUsersList users={roleUsers} canReadMembers={canReadMembers} />
      </section>

      <section className={s.detailsSection}>
        <div className={s.sectionHeaderLine}>
          <h3>{t("organization.roles.permissions")}</h3>
          <div className={s.sectionHeaderActions}>
            <button className={s.secondaryButton} type="button" onClick={() => setShowPermissions((value) => !value)}>
              <ListChecks size={16} />
              {showPermissions ? t("organization.roles.hidePermissions") : t("organization.roles.showPermissions")}
            </button>
          </div>
        </div>
        {canOpenPermissionEditor ? (
          <RolePermissionEditor
            role={role}
            permissions={permissions}
            loading={permissionsLoading}
            canReadPermissions={canReadPermissions}
            canAssignPermissions={canAssignPermissions}
            onToast={onToast}
          />
        ) : <RolePermissionEditor role={role} />}
        {showPermissions ? <PermissionGroups permissionNames={permissionNames} /> : null}
      </section>
    </section>
  );
}

function RolesPanel({
  roles,
  loading,
  members,
  canReadMembers,
  canReadPermissions,
  canAssignPermissions,
  canManagePermissions,
  canCreateRole,
  canUpdateRole,
  canDeleteRole,
  canAssignRole,
  search,
  onToast,
}) {
  const { t } = useTranslation();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [formMode, setFormMode] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignTargetRoleId, setReassignTargetRoleId] = useState("");
  const [cloningRoleId, setCloningRoleId] = useState("");
  const [resettingRoleId, setResettingRoleId] = useState("");
  const [createRole, { isLoading: creatingRole }] = useCreateRoleMutation();
  const [createRoleFromTemplate] = useCreateRoleFromTemplateMutation();
  const [cloneRole] = useCloneRoleMutation();
  const [resetDefaultRole] = useResetDefaultRoleMutation();
  const [updateRole, { isLoading: updatingRole }] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: deletingRole }] = useDeleteRoleMutation();
  const [reassignAndDeleteRole, { isLoading: reassigningRole }] = useReassignAndDeleteRoleMutation();
  const {
    data: roleTemplatesData = [],
    isLoading: roleTemplatesLoading,
  } = useListRoleTemplatesQuery();
  const {
    data: permissionsData = [],
    isLoading: permissionsLoading,
  } = useListPermissionsQuery(undefined, { skip: !canReadPermissions });
  const formSaving = creatingRole || updatingRole;
  const customRoles = useMemo(() => roles.filter(isCustomRole), [roles]);
  const roleTemplates = useMemo(() => (
    Array.isArray(roleTemplatesData) ? roleTemplatesData : []
  ), [roleTemplatesData]);
  const [busyTemplateId, setBusyTemplateId] = useState("");
  const canCreateFromTemplate = Boolean(canCreateRole && canAssignPermissions);

  const filteredRoles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...roles].sort((a, b) => roleDisplayName(a, t).localeCompare(roleDisplayName(b, t)));
    if (!needle) return sorted;
    return sorted.filter((role) => {
      const permissionNames = getRolePermissionNames(role);
      return [
        role?.name,
        role?.slug,
        role?.key,
        role?.description,
        ...permissionNames,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [roles, search, t]);

  const selectedRole = useMemo(() => (
    filteredRoles.find((role) => String(role.id || role.slug || role.name) === selectedRoleId) || filteredRoles[0] || null
  ), [filteredRoles, selectedRoleId]);

  const closeForm = () => {
    setFormMode(null);
    setEditingRole(null);
    setFormError("");
  };

  const openCreateForm = () => {
    setFormMode("create");
    setEditingRole(null);
    setFormError("");
  };

  const submitRoleForm = async (payload) => {
    setFormError("");
    try {
      if (formMode === "edit" && editingRole?.id) {
        const updated = await updateRole({ roleId: editingRole.id, body: payload }).unwrap();
        setSelectedRoleId(String(updated?.id || editingRole.id));
      } else {
        const created = await createRole(payload).unwrap();
        setSelectedRoleId(String(created?.id || created?.slug || created?.name || ""));
      }
      closeForm();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const handleCreateFromTemplate = async (template) => {
    const templateId = template?.id || template?.slug;
    if (!templateId || !canCreateFromTemplate || busyTemplateId) return;
    setBusyTemplateId(String(templateId));
    try {
      const created = await createRoleFromTemplate(templateId).unwrap();
      setSelectedRoleId(String(created?.id || created?.slug || created?.name || ""));
      closeForm();
      onToast?.({
        type: "success",
        text: t("organization.roles.templateRoleCreated", {
          role: created?.name || templateLabel(t, template, "name"),
        }),
      });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    } finally {
      setBusyTemplateId("");
    }
  };

  const handleCloneRole = async (role) => {
    if (!role?.id || cloningRoleId) return;
    setCloningRoleId(String(role.id));
    try {
      const cloned = await cloneRole(role.id).unwrap();
      setSelectedRoleId(String(cloned?.id || ""));
      onToast?.({ type: "success", text: t("organization.roles.roleCloned", { role: cloned?.name || roleDisplayName(role, t) }) });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    } finally {
      setCloningRoleId("");
    }
  };

  const handleResetRole = async (role) => {
    if (!role?.id || resettingRoleId) return;
    setResettingRoleId(String(role.id));
    try {
      const updated = await resetDefaultRole(role.id).unwrap();
      setSelectedRoleId(String(updated?.id || role.id));
      onToast?.({ type: "success", text: t("organization.roles.roleReset") });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    } finally {
      setResettingRoleId("");
    }
  };

  const openReassignDelete = (role, users = []) => {
    const fallbackTarget = roles.find((item) => String(item.id) !== String(role?.id) && normalizeRoleKey(item?.slug || item?.name) === "employee")
      || roles.find((item) => String(item.id) !== String(role?.id) && !item?.isSystem)
      || roles.find((item) => String(item.id) !== String(role?.id));
    setReassignTarget({ role, users });
    setReassignTargetRoleId(fallbackTarget?.id || "");
  };

  const confirmDeleteRole = async () => {
    const role = deleteTarget?.role || deleteTarget;
    if (!isCustomRole(role) || !role?.id || deletingRole) return;
    try {
      await deleteRole(role.id).unwrap();
      if (selectedRoleId === String(role.id)) {
        setSelectedRoleId("");
      }
      setDeleteTarget(null);
      onToast?.({ type: "success", text: t("organization.roles.roleDeleted") });
    } catch (error) {
      onToast?.({ type: "error", text: accessSafetyMessage(error, t) });
    }
  };

  const confirmReassignAndDelete = async () => {
    const role = reassignTarget?.role;
    if (!role?.id || !reassignTargetRoleId || reassigningRole) return;
    try {
      await reassignAndDeleteRole({ roleId: role.id, targetRoleId: reassignTargetRoleId }).unwrap();
      if (selectedRoleId === String(role.id)) {
        setSelectedRoleId(String(reassignTargetRoleId));
      }
      setReassignTarget(null);
      setReassignTargetRoleId("");
      onToast?.({ type: "success", text: t("organization.roles.roleReassignedAndDeleted") });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  return (
    <div className={s.rolesWorkspace}>
      {formMode ? (
        <RoleFormPanel
          key={`${formMode}:${editingRole?.id || "new"}`}
          mode={formMode}
          initialRole={editingRole}
          saving={formSaving}
          error={formError}
          onCancel={closeForm}
          onSubmit={submitRoleForm}
        />
      ) : null}
      <RoleTemplatesPanel
        templates={roleTemplates}
        loading={roleTemplatesLoading}
        canCreateFromTemplate={canCreateFromTemplate}
        busyTemplateId={busyTemplateId}
        onCreate={handleCreateFromTemplate}
      />
      <section className={s.rolesLayout}>
        <aside className={s.rolesList} aria-label={t("organization.roles.roleList")}>
          <div className={s.rolesListHeader}>
            <div>
              <h2>{t("organization.roles.title")}</h2>
              <span>{loading ? t("common.loading") : t("organization.roles.count", { count: filteredRoles.length })}</span>
            </div>
            {canCreateRole ? (
              <button className={s.secondaryButton} type="button" onClick={openCreateForm}>
                <Plus size={16} />
                {t("organization.roles.createCustomRole")}
              </button>
            ) : null}
          </div>
          <div className={s.roleCards}>
            {loading ? <p className={s.drawerMuted}>{t("common.loading")}</p> : null}
            {!loading && !customRoles.length ? (
              <div className={s.inlineEmpty}>
                <strong>{t("organization.roles.noCustomRoles")}</strong>
                <span>{t("organization.roles.createFirstRole")}</span>
              </div>
            ) : null}
            {!loading && !filteredRoles.length ? (
              <EmptyState size="sm" icon={ShieldCheck} title={t("organization.roles.noRoles")} description={t("organization.roles.noRolesBody")} />
            ) : null}
            {filteredRoles.map((role) => {
              const key = String(role.id || role.slug || role.name);
              const roleMembers = members.filter((member) => roleMatchesMember(role, member));
              return (
                <RoleCard
                  key={key}
                  role={role}
                  selected={selectedRole === role}
                  memberCount={roleMembers.length}
                  canReadMembers={canReadMembers}
                  onSelect={() => setSelectedRoleId(key)}
                />
              );
            })}
          </div>
        </aside>
        <RoleDetails
          role={selectedRole}
          templates={roleTemplates}
          members={members}
          permissions={Array.isArray(permissionsData) ? permissionsData : []}
          permissionsLoading={permissionsLoading}
          canReadMembers={canReadMembers}
          canReadPermissions={canReadPermissions}
          canAssignPermissions={canAssignPermissions}
          canManagePermissions={canManagePermissions}
          canCreateRole={canCreateRole}
          canUpdateRole={canUpdateRole}
          canDeleteRole={canDeleteRole}
          canAssignRole={canAssignRole}
          cloningRoleId={cloningRoleId}
          resettingRoleId={resettingRoleId}
          onClone={handleCloneRole}
          onReset={handleResetRole}
          onDelete={(role, users) => setDeleteTarget({ role, users })}
          onReassign={openReassignDelete}
          onToast={onToast}
        />
      </section>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("organization.roles.deleteRoleTitle")}
        text={t("organization.roles.deleteRoleText")}
        danger
        loading={deletingRole}
        okText={t("common.delete", "Delete")}
        cancelText={t("common.cancel")}
        onOk={confirmDeleteRole}
        onCancel={() => setDeleteTarget(null)}
      />
      <ReassignRoleModal
        open={Boolean(reassignTarget)}
        role={reassignTarget?.role}
        usersCount={reassignTarget?.users?.length || 0}
        roles={roles}
        targetRoleId={reassignTargetRoleId}
        busy={reassigningRole}
        onTargetChange={setReassignTargetRoleId}
        onCancel={() => {
          setReassignTarget(null);
          setReassignTargetRoleId("");
        }}
        onConfirm={confirmReassignAndDelete}
      />
    </div>
  );
}

function DepartmentFormPanel({ mode, initialDepartment, saving, error, onCancel, onSubmit }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialDepartment?.name || "");
  const [code, setCode] = useState(initialDepartment?.code || "");
  const [description, setDescription] = useState(initialDepartment?.description || "");
  const isEdit = mode === "edit";

  const submit = (event) => {
    event.preventDefault();
    const nextName = name.trim();
    const nextCode = (code || codeFromName(name)).trim().toLowerCase();
    if (!nextName || !nextCode || saving) return;
    onSubmit({
      name: nextName,
      code: nextCode,
      description: description.trim() || null,
    });
  };

  return (
    <form className={s.roleForm} onSubmit={submit}>
      <div className={s.roleFormHeader}>
        <div>
          <h3>{isEdit ? t("organization.departmentDirectory.editDepartment") : t("organization.departmentDirectory.createDepartment")}</h3>
          <p>{t("organization.departmentDirectory.directoryHint")}</p>
        </div>
      </div>
      {error ? <div className={s.formError}>{error}</div> : null}
      <div className={s.roleFormFields}>
        <TextField
          name="departmentName"
          label={t("organization.departmentDirectory.name")}
          value={name}
          onValueChange={(next) => {
            setName(next);
            if (!isEdit && !code) setCode(codeFromName(next));
          }}
          maxLength={100}
          required
        />
        <TextField
          name="departmentCode"
          label={t("organization.departmentDirectory.code")}
          value={code}
          onValueChange={(next) => setCode(String(next || "").toLowerCase().replace(/\s+/g, "-"))}
          maxLength={32}
          required
        />
        <TextareaField
          name="departmentDescription"
          label={t("organization.departmentDirectory.description")}
          value={description}
          onValueChange={setDescription}
          rows={3}
        />
      </div>
      <div className={s.roleFormActions}>
        <button className={s.secondaryButton} type="button" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button className={s.primaryButton} type="submit" disabled={saving || !name.trim() || !String(code || codeFromName(name)).trim()}>
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

function DepartmentCard({ department, selected, onSelect }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`${s.departmentCard} ${selected ? s.departmentCardActive : ""}`.trim()}
      onClick={onSelect}
    >
      <span className={s.departmentCardMain}>
        <span className={s.departmentCardTitle}>{department.name}</span>
        <span className={s.departmentCardCode}>{department.code}</span>
      </span>
      <span className={s.departmentCardMeta}>
        <WmsStatusChip tone={department.isActive ? "success" : "muted"} marker="solid" size="sm">
          {department.isActive ? t("organization.active") : t("organization.departmentDirectory.archived")}
        </WmsStatusChip>
        <span>{t("organization.departmentDirectory.memberCount", { count: department.memberCount || 0 })}</span>
      </span>
    </button>
  );
}

function DepartmentOverview({ department }) {
  const { t } = useTranslation();
  if (!department) return null;
  return (
    <section className={s.detailsSection}>
      <h3>{t("organization.departmentDirectory.overview")}</h3>
      <p className={s.departmentExplainer}>{t("organization.departmentDirectory.detailsExplainer")}</p>
      <div className={s.infoGrid}>
        <div>
          <span>{t("organization.departmentDirectory.name")}</span>
          <strong>{department.name || "—"}</strong>
        </div>
        <div>
          <span>{t("organization.departmentDirectory.code")}</span>
          <strong>{department.code || "—"}</strong>
        </div>
        <div>
          <span>{t("organization.status")}</span>
          <strong>{department.isActive ? t("organization.active") : t("organization.departmentDirectory.archived")}</strong>
        </div>
        <div>
          <span>{t("organization.departmentDirectory.members")}</span>
          <strong>{department.memberCount || 0}</strong>
        </div>
        <div>
          <span>{t("organization.departmentDirectory.leads")}</span>
          <strong>{department.leadCount || 0}</strong>
        </div>
        <div>
          <span>{t("organization.departmentDirectory.updated")}</span>
          <strong>{formatDateTime(department.updatedAt)}</strong>
        </div>
      </div>
      {department.description ? <p className={s.departmentDescription}>{department.description}</p> : null}
    </section>
  );
}

function DepartmentMembers({ department, members, canReadMembers, canUpdateMember, onAssignMember, onClearMember, onSetLead }) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState("");
  const departmentMembersFromDetail = Array.isArray(department?.members) ? department.members : [];
  const departmentMembers = departmentMembersFromDetail.length
    ? departmentMembersFromDetail
    : members
        .filter((member) => department?.id && String(getMemberDepartmentId(member) || "") === String(department.id))
        .map((member) => ({
          userId: member.userId || member.id,
          email: member.email || null,
          firstName: member.firstName || "",
          lastName: member.lastName || "",
          avatarUrl: member.avatarUrl || null,
          role: member.role,
          status: member.status,
          departmentId: getMemberDepartmentId(member),
          isLead: !!member.isLead,
        }));
  const assignedIds = new Set(departmentMembers.map((member) => String(member.userId)));
  const memberOptions = [
    { value: "", label: t("organization.departmentDirectory.selectMember") },
    ...members
      .filter((member) => !assignedIds.has(String(member.userId || member.id)))
      .map((member) => ({
        value: member.userId || member.id,
        label: getPersonName(member) || member.email || member.userId || member.id,
      })),
  ];

  if (!canReadMembers) {
    return <EmptyState size="sm" icon={Users} title={t("organization.departmentDirectory.memberReadRequired")} />;
  }

  return (
    <section className={s.detailsSection}>
      <div className={s.sectionHeaderLine}>
        <h3>{t("organization.departmentDirectory.members")}</h3>
        {canUpdateMember && department?.isActive ? (
          <div className={s.memberAssignRow}>
            <SelectField
              value={selectedUserId}
              options={memberOptions}
              onValueChange={setSelectedUserId}
              label={t("organization.departmentDirectory.assignMember")}
              size="sm"
              searchable
            />
            <button
              className={s.secondaryButton}
              type="button"
              disabled={!selectedUserId}
              onClick={async () => {
                await onAssignMember(selectedUserId);
                setSelectedUserId("");
              }}
            >
              <Plus size={16} />
              {t("organization.departmentDirectory.assign")}
            </button>
          </div>
        ) : null}
      </div>
      {!departmentMembers.length ? (
        <WmsEmptyState title={t("organization.departmentDirectory.noMembers")} />
      ) : (
        <div className={s.departmentMembersList}>
          {departmentMembers.map((member) => {
            const name = getPersonName(member) || member.email || "—";
            return (
              <div className={s.departmentMemberRow} key={member.userId}>
                <span className={s.peopleIdentity}>
                  <Avatar name={name} email={member.email} url={member.avatarUrl} size="sm" />
                  <span className={s.personText}>
                    <strong>{name}</strong>
                    <span>{member.email || "—"}</span>
                  </span>
                </span>
                <RoleChip role={member.role} t={t} variant="subtle" />
                {member.isLead ? (
                  <span className={s.leadChip}>
                    <UserCheck size={12} />
                    {t("organization.lead")}
                  </span>
                ) : <span className={s.departmentMuted}>{t("organization.departmentDirectory.member")}</span>}
                {canUpdateMember && department?.isActive ? (
                  <span className={s.departmentMemberActions}>
                    <button className={s.textButton} type="button" onClick={() => onSetLead(member.userId, !member.isLead)}>
                      {member.isLead ? t("organization.departmentDirectory.clearLead") : t("organization.departmentDirectory.setLead")}
                    </button>
                    <button className={s.textDangerButton} type="button" onClick={() => onClearMember(member.userId)}>
                      {t("organization.departmentDirectory.removeFromDepartment")}
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function readinessTone(status) {
  if (status === "ready") return "success";
  if (status === "warning") return "warning";
  return "danger";
}

function shadowTone(status) {
  return status === "PASS" ? "success" : "danger";
}

function readinessLabel(t, status) {
  if (status === "ready") return t("organization.departmentDirectory.readiness.ready");
  if (status === "warning") return t("organization.departmentDirectory.readiness.warning");
  return t("organization.departmentDirectory.readiness.notReady");
}

function ReadinessMetric({ label, value, hint }) {
  return (
    <div className={s.readinessMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function ReadinessStep({ done, disabled, children }) {
  const Icon = done ? CheckCircle2 : AlertTriangle;
  return (
    <li className={`${s.readinessStep} ${done ? s.readinessStepDone : ""} ${disabled ? s.readinessStepDisabled : ""}`.trim()}>
      <Icon size={15} />
      <span>{children}</span>
    </li>
  );
}

function DepartmentReadinessPanel({ readiness, loading, canCreateDepartment, onCreateDepartment, onAssignUsers, onRefresh }) {
  const { t } = useTranslation();
  const status = readiness?.readiness?.status || "not_ready";
  const shadowTrue = readiness?.shadow?.nullVisibleTrue || {};
  const shadowFalse = readiness?.shadow?.nullVisibleFalse || {};
  const hasDepartments = Number(readiness?.activeDepartments || 0) > 0;
  const hasUsersAssigned = Number(readiness?.usersWithDepartment || 0) > 0;
  const hasCounterpartySignals = Number(readiness?.taggedCounterparties || 0) > 0 ||
    Number(readiness?.counterpartiesWithResponsible || 0) > 0 ||
    Number(readiness?.counterpartiesWithCreator || 0) > 0 ||
    Number(readiness?.totalCounterparties || 0) === 0;

  return (
    <WmsSurface className={s.readinessPanel} padding="md">
      <div className={s.readinessHeader}>
        <div>
          <span className={s.departmentHeroEyebrow}>{t("organization.departmentDirectory.readiness.eyebrow")}</span>
          <h2>{t("organization.departmentDirectory.readiness.title")}</h2>
          <p>{t("organization.departmentDirectory.readiness.explainer")}</p>
        </div>
        <div className={s.readinessStatus}>
          <WmsStatusChip tone={readinessTone(status)} marker="solid" size="sm">
            {loading ? t("common.loading") : readinessLabel(t, status)}
          </WmsStatusChip>
          <button className={s.secondaryButton} type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} />
            {t("organization.departmentDirectory.readiness.runCheck")}
          </button>
        </div>
      </div>

      <div className={s.readinessMetrics}>
        <ReadinessMetric
          label={t("organization.departmentDirectory.readiness.departmentsCreated")}
          value={hasDepartments ? t("common.yes", "Yes") : t("common.no", "No")}
          hint={`${readiness?.activeDepartments ?? 0}/${readiness?.totalDepartments ?? 0}`}
        />
        <ReadinessMetric
          label={t("organization.departmentDirectory.readiness.usersAssigned")}
          value={`${readiness?.usersWithDepartment ?? 0}/${readiness?.usersTotal ?? 0}`}
          hint={t("organization.departmentDirectory.readiness.usersWithout", { count: readiness?.usersWithoutDepartment ?? 0 })}
        />
        <ReadinessMetric
          label={t("organization.departmentDirectory.readiness.counterpartiesTagged")}
          value={`${readiness?.taggedCounterparties ?? 0}/${readiness?.totalCounterparties ?? 0}`}
          hint={t("organization.departmentDirectory.readiness.coverage", { percent: readiness?.coveragePercent ?? 0 })}
        />
        <div className={s.readinessShadow}>
          <span>{t("organization.departmentDirectory.readiness.shadowStatus")}</span>
          <div>
            <WmsStatusChip tone={shadowTone(shadowTrue.status)} marker="solid" size="sm">
              {t("organization.departmentDirectory.readiness.nullVisibleTrue")}: {shadowTrue.status || "—"}
            </WmsStatusChip>
            <WmsStatusChip tone={shadowTone(shadowFalse.status)} marker="solid" size="sm">
              {t("organization.departmentDirectory.readiness.nullVisibleFalse")}: {shadowFalse.status || "—"}
            </WmsStatusChip>
          </div>
        </div>
      </div>

      <div className={s.readinessBody}>
        <ol className={s.readinessChecklist}>
          <ReadinessStep done={hasDepartments}>{t("organization.departmentDirectory.readiness.createDepartments")}</ReadinessStep>
          <ReadinessStep done={hasUsersAssigned}>{t("organization.departmentDirectory.readiness.assignUsers")}</ReadinessStep>
          <ReadinessStep done={hasCounterpartySignals}>{t("organization.departmentDirectory.readiness.tagCounterparties")}</ReadinessStep>
          <ReadinessStep done={shadowTrue.status === "PASS"}>{t("organization.departmentDirectory.readiness.runReadinessCheck")}</ReadinessStep>
          <ReadinessStep disabled>{t("organization.departmentDirectory.readiness.enableLater")}</ReadinessStep>
        </ol>
        <div className={s.readinessActions}>
          {!hasDepartments && canCreateDepartment ? (
            <button className={s.primaryButton} type="button" onClick={onCreateDepartment}>
              <Plus size={16} />
              {t("organization.departmentDirectory.createDepartment")}
            </button>
          ) : null}
          {Number(readiness?.usersWithoutDepartment || 0) > 0 ? (
            <button className={s.secondaryButton} type="button" onClick={onAssignUsers} disabled={!hasDepartments}>
              <Users size={16} />
              {t("organization.departmentDirectory.readiness.assignUsersCta")}
            </button>
          ) : null}
          {Number(readiness?.untaggedCounterparties || 0) > 0 ? (
            <p>{t("organization.departmentDirectory.readiness.tagCounterpartiesCta")}</p>
          ) : null}
        </div>
      </div>
    </WmsSurface>
  );
}

function DepartmentsPanel({
  departments,
  loading,
  readiness,
  readinessLoading,
  selectedDepartmentId,
  selectedDepartment,
  selectedLoading,
  members,
  canReadMembers,
  canCreateDepartment,
  canUpdateDepartment,
  canArchiveDepartment,
  canUpdateMember,
  search,
  onSelectDepartment,
  onToast,
  onRefreshReadiness,
}) {
  const { t } = useTranslation();
  const [detailTab, setDetailTab] = useState("overview");
  const [formMode, setFormMode] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formError, setFormError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState(null);
  const [createDepartment, { isLoading: creatingDepartment }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: updatingDepartment }] = useUpdateDepartmentMutation();
  const [archiveDepartment, { isLoading: archivingDepartment }] = useArchiveDepartmentMutation();
  const [restoreDepartment, { isLoading: restoringDepartment }] = useRestoreDepartmentMutation();
  const [updateMember, { isLoading: updatingMember }] = useUpdateUserRoleMutation();
  const formSaving = creatingDepartment || updatingDepartment;

  const filteredDepartments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const sorted = [...departments].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
    if (!needle) return sorted;
    return sorted.filter((department) => (
      [department.name, department.code, department.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    ));
  }, [departments, search]);

  const selected = selectedDepartment || filteredDepartments.find((department) => department.id === selectedDepartmentId) || filteredDepartments[0] || null;

  const closeForm = () => {
    setFormMode(null);
    setEditingDepartment(null);
    setFormError("");
  };

  const submitDepartmentForm = async (payload) => {
    setFormError("");
    try {
      if (formMode === "edit" && editingDepartment?.id) {
        const updated = await updateDepartment({ departmentId: editingDepartment.id, body: payload }).unwrap();
        onSelectDepartment(updated?.id || editingDepartment.id);
        onToast?.({ type: "success", text: t("organization.departmentDirectory.departmentUpdated") });
      } else {
        const created = await createDepartment(payload).unwrap();
        onSelectDepartment(created?.id);
        onToast?.({ type: "success", text: t("organization.departmentDirectory.departmentCreated") });
      }
      closeForm();
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const assignMember = async (userId) => {
    if (!selected?.id || updatingMember) return;
    try {
      await updateMember({ userId, departmentId: selected.id }).unwrap();
      onToast?.({ type: "success", text: t("organization.departmentDirectory.memberAssigned") });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  const clearMember = async (userId) => {
    if (updatingMember) return;
    try {
      await updateMember({ userId, departmentId: null, isLead: false }).unwrap();
      setConfirmRemoveMember(null);
      onToast?.({ type: "success", text: t("organization.departmentDirectory.memberRemoved") });
    } catch (error) {
      setConfirmRemoveMember(null);
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  const setLead = async (userId, isLead) => {
    if (updatingMember || !selected?.id) return;
    try {
      await updateMember({ userId, departmentId: selected.id, isLead }).unwrap();
      onToast?.({ type: "success", text: isLead ? t("organization.departmentDirectory.leadSet") : t("organization.departmentDirectory.leadCleared") });
    } catch (error) {
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  const confirmArchiveDepartment = async () => {
    if (!confirmArchive?.id || archivingDepartment) return;
    try {
      await archiveDepartment(confirmArchive.id).unwrap();
      setConfirmArchive(null);
      onToast?.({ type: "success", text: t("organization.departmentDirectory.departmentArchived") });
    } catch (error) {
      setConfirmArchive(null);
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  const restoreSelectedDepartment = async () => {
    const target = confirmRestore || selected;
    if (!target?.id || restoringDepartment) return;
    try {
      await restoreDepartment(target.id).unwrap();
      setConfirmRestore(null);
      onToast?.({ type: "success", text: t("organization.departmentDirectory.departmentRestored") });
    } catch (error) {
      setConfirmRestore(null);
      onToast?.({ type: "error", text: errorMessage(error) });
    }
  };

  return (
    <div className={s.rolesWorkspace}>
      {formMode ? (
        <DepartmentFormPanel
          key={`${formMode}:${editingDepartment?.id || "new"}`}
          mode={formMode}
          initialDepartment={editingDepartment}
          saving={formSaving}
          error={formError}
          onCancel={closeForm}
          onSubmit={submitDepartmentForm}
        />
      ) : null}
      <DepartmentReadinessPanel
        readiness={readiness}
        loading={readinessLoading}
        canCreateDepartment={canCreateDepartment}
        onCreateDepartment={() => { setFormMode("create"); setEditingDepartment(null); }}
        onAssignUsers={() => setDetailTab("members")}
        onRefresh={onRefreshReadiness}
      />
      <section className={s.departmentsLayout}>
        <aside className={s.departmentsList} aria-label={t("organization.departmentDirectory.departmentList")}>
          <div className={s.rolesListHeader}>
            <div>
              <h2>{t("organization.departmentDirectory.title")}</h2>
              <span>{loading ? t("common.loading") : t("organization.departmentDirectory.count", { count: filteredDepartments.length })}</span>
            </div>
            {canCreateDepartment ? (
              <button className={s.secondaryButton} type="button" onClick={() => { setFormMode("create"); setEditingDepartment(null); }}>
                <Plus size={16} />
                {t("organization.departmentDirectory.createDepartment")}
              </button>
            ) : null}
          </div>
          <p className={s.departmentExplainer}>{t("organization.departmentDirectory.listExplainer")}</p>
          <div className={s.departmentCards}>
            {loading ? <p className={s.drawerMuted}>{t("common.loading")}</p> : null}
            {!loading && !filteredDepartments.length ? (
              <EmptyState size="sm" icon={Building2} title={t("organization.departmentDirectory.noDepartments")} description={t("organization.departmentDirectory.noDepartmentsBody")} />
            ) : null}
            {filteredDepartments.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                selected={selected?.id === department.id}
                onSelect={() => onSelectDepartment(department.id)}
              />
            ))}
          </div>
        </aside>

        <section className={s.departmentDetails}>
          {selectedLoading ? <WmsLoadingState title={t("common.loading")} rows={5} /> : null}
          {!selectedLoading && !selected ? (
            <EmptyState size="sm" icon={Building2} title={t("organization.departmentDirectory.noDepartmentSelected")} />
          ) : null}
          {!selectedLoading && selected ? (
            <>
              <div className={s.departmentHero}>
                <div className={s.departmentHeroMain}>
                  <div>
                    <span className={s.departmentHeroEyebrow}>{t("organization.departmentDirectory.title")}</span>
                    <h2>{selected.name}</h2>
                    <p>{selected.description || t("organization.departmentDirectory.noDescription")}</p>
                  </div>
                  <div className={s.departmentHeroStats}>
                    <span>
                      <strong>{selected.code || "—"}</strong>
                      <small>{t("organization.departmentDirectory.code")}</small>
                    </span>
                    <span>
                      <strong>{selected.memberCount || 0}</strong>
                      <small>{t("organization.departmentDirectory.members")}</small>
                    </span>
                    <span>
                      <strong>{selected.leadCount || 0}</strong>
                      <small>{t("organization.departmentDirectory.leads")}</small>
                    </span>
                  </div>
                </div>
                <div className={s.roleDetailsActions}>
                  <WmsStatusChip tone={selected.isActive ? "success" : "muted"} marker="solid" size="sm">
                    {selected.isActive ? t("organization.active") : t("organization.departmentDirectory.archived")}
                  </WmsStatusChip>
                  {canUpdateDepartment ? (
                    <button className={s.secondaryButton} type="button" onClick={() => { setFormMode("edit"); setEditingDepartment(selected); }}>
                      <Pencil size={16} />
                      {t("common.edit")}
                    </button>
                  ) : null}
                  {canArchiveDepartment && selected.isActive ? (
                    <button className={s.dangerButton} type="button" onClick={() => setConfirmArchive(selected)}>
                      <Archive size={16} />
                      {t("organization.departmentDirectory.archive")}
                    </button>
                  ) : null}
                  {canUpdateDepartment && !selected.isActive ? (
                    <button className={s.secondaryButton} type="button" onClick={() => setConfirmRestore(selected)} disabled={restoringDepartment}>
                      <RotateCcw size={16} />
                      {t("organization.departmentDirectory.restore")}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className={s.departmentExplainer}>{t("organization.departmentDirectory.detailsExplainer")}</p>
              <Tabs
                items={[
                  { key: "overview", label: t("organization.departmentDirectory.overview") },
                  { key: "members", label: t("organization.departmentDirectory.members"), count: selected.memberCount || 0 },
                ]}
                activeKey={detailTab}
                onChange={setDetailTab}
                variant="pill"
                size="sm"
                className={s.detailTabs}
              />
              {detailTab === "members" ? (
                <DepartmentMembers
                  department={selected}
                  members={members}
                  canReadMembers={canReadMembers}
                  canUpdateMember={canUpdateMember}
                  onAssignMember={assignMember}
                  onClearMember={(userId) => setConfirmRemoveMember({ userId })}
                  onSetLead={setLead}
                />
              ) : (
                <DepartmentOverview department={selected} />
              )}
            </>
          ) : null}
        </section>
      </section>
      <ConfirmDialog
        open={Boolean(confirmArchive)}
        title={t("organization.departmentDirectory.archiveDepartment")}
        text={t("organization.departmentDirectory.archiveDepartmentText", { name: confirmArchive?.name })}
        danger
        loading={archivingDepartment}
        okText={t("organization.departmentDirectory.archive")}
        cancelText={t("common.cancel")}
        onOk={confirmArchiveDepartment}
        onCancel={() => setConfirmArchive(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmRestore)}
        title={t("organization.departmentDirectory.restoreDepartment")}
        text={t("organization.departmentDirectory.restoreDepartmentText", { name: confirmRestore?.name })}
        loading={restoringDepartment}
        okText={t("organization.departmentDirectory.restore")}
        cancelText={t("common.cancel")}
        onOk={restoreSelectedDepartment}
        onCancel={() => setConfirmRestore(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmRemoveMember)}
        title={t("organization.departmentDirectory.removeMemberTitle")}
        text={t("organization.departmentDirectory.removeMemberText")}
        danger
        loading={updatingMember}
        okText={t("organization.departmentDirectory.removeFromDepartment")}
        cancelText={t("common.cancel")}
        onOk={() => clearMember(confirmRemoveMember?.userId)}
        onCancel={() => setConfirmRemoveMember(null)}
      />
    </div>
  );
}

export default function CompanyUsers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const orgIndex = pathParts.indexOf("company-users");
  const pathTab = orgIndex >= 0 ? pathParts[orgIndex + 1] : pathParts[pathParts.length - 1];
  const activeTab = VALID_TABS.has(pathTab) ? pathTab : "people";
  const selectedDepartmentId = activeTab === "departments" && orgIndex >= 0 ? pathParts[orgIndex + 2] || "" : "";
  const { can, hasAny } = useAclPermissions();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const canReadMembers = can("member:read");
  const canInviteMember = can("member:invite");
  const canSeeInvitations = hasAny(["member:read", "member:invite"]);
  const canReadRoles = hasAny(["role:read", "permission:read"]);
  const canReadPermissions = can("permission:read");
  const canAssignPermissions = can("permission:assign");
  const canManageRolePermissions = hasAny(["permission:assign", "role:update"]);
  const canCreateRole = can("role:create");
  const canUpdateRole = can("role:update");
  const canDeleteRole = can("role:delete");
  const canAssignRole = can("role:assign");
  const canReadDepartments = can("department:read");
  const canCreateDepartment = can("department:create");
  const canUpdateDepartment = can("department:update");
  const canArchiveDepartment = can("department:delete");
  const canUpdateMember = hasAny(["member:update", "member:update:dept"]);

  const showToast = (nextToast) => {
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current === nextToast ? null : current));
    }, 4200);
  };

  const memberQuery = useMemo(() => ({
    sort: "createdAt",
    dir: "DESC",
    limit: 100,
    search: search || undefined,
  }), [search]);

  const inviteQuery = useMemo(() => ({
    sort: "createdAt",
    dir: "DESC",
    limit: 100,
    search: search || undefined,
  }), [search]);

  const {
    data: membersData,
    isLoading: membersLoading,
  } = useListCompanyUsersQuery(memberQuery, { skip: !canReadMembers });

  const {
    data: invitesData,
    isLoading: invitesLoading,
    refetch: refetchInvites,
  } = useListInvitationsQuery(inviteQuery, { skip: !canReadMembers });

  const {
    data: rolesData,
    isLoading: rolesLoading,
  } = useListRolesQuery(undefined, { skip: !canReadRoles });

  const {
    data: departmentsData,
    isLoading: departmentsLoading,
  } = useListDepartmentsQuery({ includeArchived: true }, { skip: !canReadDepartments });

  const {
    data: departmentReadiness,
    isLoading: departmentReadinessLoading,
    isFetching: departmentReadinessFetching,
    refetch: refetchDepartmentReadiness,
  } = useGetCounterpartyScopeReadinessQuery(undefined, { skip: !canReadDepartments });

  const {
    data: selectedDepartmentData,
    isLoading: selectedDepartmentLoading,
  } = useGetDepartmentQuery(selectedDepartmentId, { skip: !canReadDepartments || !selectedDepartmentId });

  const [inviteUser] = useInviteUserMutation();
  const [resendInvitation] = useResendInvitationMutation();
  const [revokeInvitation] = useRevokeInvitationMutation();

  const members = useMemo(() => (
    Array.isArray(membersData?.items) ? membersData.items : []
  ), [membersData?.items]);
  const invitations = useMemo(() => (
    Array.isArray(invitesData?.items) ? invitesData.items : []
  ), [invitesData?.items]);
  const roles = useMemo(() => (
    Array.isArray(rolesData) ? rolesData.filter((role) => !isLegacyUserAclRole(role)) : []
  ), [rolesData]);
  const departments = useMemo(() => (
    Array.isArray(departmentsData) ? departmentsData : []
  ), [departmentsData]);
  const rolesIndex = useMemo(() => buildRoleIndexes(roles), [roles]);
  const filteredMembers = useMemo(() => {
    const query = normalizeRoleKey(search);
    return members.filter((member) => {
      const name = getPersonName(member);
      const searchable = normalizeRoleKey(`${name} ${member.email || ""}`);
      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = statusFilter === "all" || normalizeRoleKey(member.status) === statusFilter;
      const matchesRole = memberMatchesRole(member, roleFilter, rolesIndex);
      const matchesDepartment = departmentFilter === "all" || String(getMemberDepartmentId(member) || "") === String(departmentFilter);
      return matchesSearch && matchesStatus && matchesRole && matchesDepartment;
    });
  }, [departmentFilter, members, roleFilter, rolesIndex, search, statusFilter]);

  const counts = useMemo(() => {
    const active = members.filter((member) => member.status === "active").length;
    const suspended = members.filter((member) => member.status === "suspended").length;
    const invited = invitations.filter((invite) => ["pending", "invited"].includes(invite.status)).length;
    return {
      total: Number(membersData?.total ?? members.length),
      active,
      invited,
      suspended,
    };
  }, [invitations, members, membersData?.total]);

  const tabs = [
    { key: "people", label: t("organization.people"), icon: Users, count: counts.total },
    { key: "invitations", label: t("organization.invitations"), icon: Mail, count: counts.invited },
    { key: "roles", label: t("organization.rolesLabel"), icon: ShieldCheck },
    { key: "departments", label: t("organization.departments"), icon: Building2 },
  ];

  const roleOptions = [
    { value: "owner", label: t("organization.owner") },
    { value: "admin", label: t("organization.admin") },
    { value: "manager", label: t("organization.manager") },
    { value: "user", label: t("organization.employee") },
  ];
  const roleFilterOptions = [
    { value: "all", label: t("organization.people.roleFilter") },
    ...roles.map((role) => ({
      value: role?.slug || role?.key || role?.name || role?.id,
      label: roleDisplayName(role, t),
    })),
  ].filter((option) => option.value);
  const statusFilterOptions = [
    { value: "all", label: t("organization.people.statusFilter") },
    { value: "active", label: t("organization.active") },
    { value: "suspended", label: t("organization.suspended") },
  ];
  const departmentFilterOptions = [
    { value: "all", label: t("organization.departmentDirectory.allDepartments") },
    ...departments
      .filter((department) => department.isActive)
      .map((department) => ({ value: department.id, label: department.name })),
  ];

  const invitationColumns = [
    {
      key: "email",
      title: t("organization.email"),
      width: 260,
      render: (row) => (
        <div className={s.inviteEmail}>
          <Mail size={16} />
          <span>{row.email || "—"}</span>
        </div>
      ),
    },
    {
      key: "role",
      title: t("organization.role"),
      width: 160,
      render: (row) => <RoleChip role={row.role} t={t} />,
    },
    {
      key: "status",
      title: t("organization.status"),
      width: 140,
      render: (row) => (
        <StatusBadge status={row.status} size="sm" dot>
          {statusLabel(t, row.status)}
        </StatusBadge>
      ),
    },
    {
      key: "expiresAt",
      title: t("organization.expiration"),
      width: 180,
      render: (row) => <span className={s.tableMuted}>{formatDate(row.expiresAt)}</span>,
    },
    {
      key: "actions",
      title: t("organization.actions"),
      width: 240,
      render: (row) => {
        if (row.status !== "pending" || !canInviteMember) return <span className={s.tableMuted}>—</span>;
        return (
          <div className={s.rowActions} onClick={(event) => event.stopPropagation()}>
            <button
              className={s.textButton}
              type="button"
              onClick={async () => {
                try {
                  await resendInvitation(row.id).unwrap();
                  showToast({ type: "success", text: t("organization.invitationResent") });
                  refetchInvites();
                } catch (error) {
                  showToast({ type: "error", text: errorMessage(error) });
                }
              }}
            >
              <RefreshCw size={15} />
              {t("organization.resend")}
            </button>
            <button
              className={s.textDangerButton}
              type="button"
              onClick={() => setConfirm({
                title: t("organization.revokeInvitation"),
                text: t("organization.revokeInvitationText", { email: row.email }),
                danger: true,
                onYes: async () => {
                  try {
                    await revokeInvitation(row.id).unwrap();
                    setConfirm(null);
                    showToast({ type: "success", text: t("organization.invitationRevoked") });
                    refetchInvites();
                  } catch (error) {
                    setConfirm(null);
                    showToast({ type: "error", text: errorMessage(error) });
                  }
                },
              })}
            >
              {t("organization.revoke")}
            </button>
          </div>
        );
      },
    },
  ];

  const openTab = (key) => navigate(`/main/company-users/${key}`);
  const openDepartment = (departmentId) => navigate(`/main/company-users/departments/${encodeURIComponent(departmentId || "")}`);

  const openInvite = () => setInviteOpen(true);
  const openUserDetails = (user) => {
    const userId = user?.userId || user?.id;
    if (!userId) return;
    navigate(`/main/company-users/people/${encodeURIComponent(userId)}`);
  };

  const renderContent = () => {
    if (activeTab === "roles") {
      if (!canReadRoles) {
        return <EmptyState icon={KeyRound} title={t("common.accessDenied")} description={t("organization.roles.noAccess")} />;
      }
      return (
        <RolesPanel
          roles={roles}
          loading={rolesLoading}
          members={members}
          canReadMembers={canReadMembers}
          canReadPermissions={canReadPermissions}
          canAssignPermissions={canAssignPermissions}
          canManagePermissions={canManageRolePermissions}
          canCreateRole={canCreateRole}
          canUpdateRole={canUpdateRole}
          canDeleteRole={canDeleteRole}
          canAssignRole={canAssignRole}
          onToast={showToast}
          search={search}
        />
      );
    }
    if (activeTab === "departments") {
      if (!canReadDepartments) {
        return <EmptyState icon={KeyRound} title={t("common.accessDenied")} description={t("organization.departmentDirectory.noAccess")} />;
      }
      return (
        <DepartmentsPanel
          departments={departments}
          loading={departmentsLoading}
          readiness={departmentReadiness}
          readinessLoading={departmentReadinessLoading || departmentReadinessFetching}
          selectedDepartmentId={selectedDepartmentId}
          selectedDepartment={selectedDepartmentData}
          selectedLoading={selectedDepartmentLoading}
          members={members}
          canReadMembers={canReadMembers}
          canCreateDepartment={canCreateDepartment}
          canUpdateDepartment={canUpdateDepartment}
          canArchiveDepartment={canArchiveDepartment}
          canUpdateMember={canUpdateMember}
          search={search}
          onSelectDepartment={openDepartment}
          onToast={showToast}
          onRefreshReadiness={refetchDepartmentReadiness}
        />
      );
    }

    if (activeTab === "invitations") {
      if (!canSeeInvitations) {
        return <EmptyState icon={KeyRound} title={t("common.accessDenied")} description={t("organization.noInvitationsAccess")} />;
      }
      if (!canReadMembers) {
        return <EmptyState icon={Send} title={t("organization.inviteOnlyTitle")} description={t("organization.inviteOnlyBody")} action={canInviteMember ? <button className={s.primaryButton} type="button" onClick={openInvite}>{t("organization.inviteUser")}</button> : null} />;
      }
      return (
        <section className={s.tablePanel}>
          <DataTable
            columns={invitationColumns}
            data={invitations}
            loading={invitesLoading}
            rowKey="id"
            emptyStateContent={<EmptyState size="sm" icon={Mail} title={t("organization.noPendingInvitations")} />}
          />
        </section>
      );
    }

    if (!canReadMembers) {
      return <EmptyState icon={KeyRound} title={t("common.accessDenied")} description={t("organization.noPeopleAccess")} />;
    }

    return (
      <PeopleListPanel
        members={filteredMembers}
        loading={membersLoading}
        rolesIndex={rolesIndex}
        departments={departments}
        onOpen={openUserDetails}
      />
    );
  };

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow={t("organization.eyebrow")}
        title={activeTab === "people" ? t("organization.people.title") : t("organization.title")}
        subtitle={activeTab === "people" ? t("organization.people.subtitle") : t("organization.subtitle")}
        actions={canInviteMember ? (
          <button className={s.primaryButton} type="button" onClick={openInvite}>
            <Send size={16} />
            {t("organization.inviteUser")}
          </button>
        ) : null}
      />

      <section className={s.metrics} aria-label={t("organization.metrics")}>
        <PeopleKpiButton
          active={activeTab === "people" && statusFilter === "all"}
          label={t("organization.people.total")}
          value={counts.total}
          onClick={() => {
            setStatusFilter("all");
            navigate("/main/company-users/people");
          }}
        />
        <PeopleKpiButton
          active={activeTab === "people" && statusFilter === "active"}
          label={t("organization.people.active")}
          value={counts.active}
          onClick={() => {
            setStatusFilter("active");
            navigate("/main/company-users/people");
          }}
        />
        <PeopleKpiButton
          active={activeTab === "invitations"}
          label={t("organization.people.invited")}
          value={counts.invited}
          onClick={() => navigate("/main/company-users/invitations")}
        />
        <PeopleKpiButton
          active={activeTab === "people" && statusFilter === "suspended"}
          label={t("organization.people.suspended")}
          value={counts.suspended}
          onClick={() => {
            setStatusFilter("suspended");
            navigate("/main/company-users/people");
          }}
        />
      </section>

      <div className={s.toolbar}>
        <Tabs
          items={tabs}
          activeKey={activeTab}
          onChange={openTab}
          variant="pill"
          ariaLabel={t("organization.tabs")}
          className={s.tabs}
        />
        <SearchField
          className={s.searchField}
          value={search}
          onValueChange={setSearch}
          clearable
          searchIcon={<Search size={16} />}
          label={<span aria-hidden="true">&nbsp;</span>}
          size="sm"
          placeholder={t("organization.people.searchPlaceholder")}
        />
        {activeTab === "people" ? (
          <div className={s.peopleFilters}>
            <SelectField
              value={roleFilter}
              options={roleFilterOptions}
              onValueChange={setRoleFilter}
              label={t("organization.people.roleFilter")}
              size="sm"
            />
            <SelectField
              value={statusFilter}
              options={statusFilterOptions}
              onValueChange={setStatusFilter}
              label={t("organization.people.statusFilter")}
              size="sm"
            />
            <SelectField
              value={departmentFilter}
              options={departmentFilterOptions}
              onValueChange={setDepartmentFilter}
              label={t("organization.departments")}
              size="sm"
            />
          </div>
        ) : null}
      </div>

      {renderContent()}

      {toast ? (
        <div className={`${s.toast} ${s[`toast_${toast.type}`] || ""}`} role="status">
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t("common.close", "Close")}>×</button>
        </div>
      ) : null}

      {inviteOpen ? (
        <InviteUserModal
          roles={roleOptions}
          onSubmit={async (payload) => {
            await inviteUser(payload).unwrap();
            setInviteOpen(false);
            navigate("/main/company-users/invitations");
            refetchInvites();
          }}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        text={confirm?.text}
        danger={confirm?.danger}
        onOk={confirm?.onYes}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
