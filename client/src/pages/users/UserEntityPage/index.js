import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Building2,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import PageHeader from '../../../components/shared/PageHeader';
import TabBar from '../../../components/layout/TabBar';
import UserAccessPanel from '../../../components/user/UserAccessPanel';
import { CheckboxField, SearchField, SelectField } from '../../../components/ui/fields';
import {
  WmsEmptyState,
  WmsErrorState,
  WmsLoadingState,
  WmsStatusChip,
  WmsSurface,
} from '../../../components/wms/ui';
import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  useAssignRoleToUserMutation,
  useListRolesQuery,
  useRemoveRoleFromUserMutation,
  useUserPermSummaryQuery,
} from '../../../store/rtk/aclApi';
import {
  useGetCompanyUserQuery,
  useUpdateUserRoleMutation,
} from '../../../store/rtk/companyUsersApi';
import {
  useListDepartmentsQuery,
} from '../../../store/rtk/departmentsApi';
import s from './UserEntityPage.module.css';

const PRIMARY_ROLE_PRIORITY = ['owner', 'admin', 'manager', 'employee', 'user', 'viewer'];
const VALID_TABS = new Set(['overview', 'access', 'permissions']);
const ROLE_LEVEL_RANK = { none: 0, read: 1, partial: 2, full: 3 };

const SUMMARY_GROUPS = [
  { key: 'crm', labelKey: 'organization.access.crm', prefixes: ['counterparty:', 'deal:', 'task:', 'contact:', 'note:'] },
  { key: 'pim', labelKey: 'organization.access.pim', prefixes: ['product:', 'category:', 'brand:', 'attribute:', 'product_type:', 'variant:', 'collection:', 'tag:', 'channel:', 'price_list:', 'uom:', 'tax_category:', 'shipping_class:'] },
  { key: 'documents', labelKey: 'organization.access.documents', prefixes: ['document:'] },
  { key: 'wms', labelKey: 'organization.access.wms', prefixes: ['wms:'] },
  { key: 'settings', labelKey: 'organization.access.settings', prefixes: ['settings:', 'company:settings:', 'company:update', 'company:delete'] },
  { key: 'access', labelKey: 'organization.access.access', prefixes: ['role:', 'permission:', 'member:'] },
];

const ROLE_CAPABILITY_MODULES = [
  { key: 'crm', labelKey: 'organization.roles.modules.crm', matchers: ['counterparty:', 'deal:', 'task:', 'contact:', 'note:'] },
  { key: 'pim', labelKey: 'organization.roles.modules.pim', matchers: ['product:', 'category:', 'brand:', 'attribute:', 'product_type:', 'variant:', 'collection:', 'tag:', 'channel:', 'uom:', 'tax_category:', 'shipping_class:'] },
  { key: 'documents', labelKey: 'organization.roles.modules.documents', matchers: ['document:'] },
  { key: 'priceLists', labelKey: 'organization.roles.modules.priceLists', matchers: ['price_list:'] },
  { key: 'wms', labelKey: 'organization.roles.modules.wms', matchers: ['wms:'] },
];

function normalizeRoleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function roleIdentityValues(role) {
  const primitive = role && typeof role !== 'object' ? role : null;
  return [role?.id, role?.slug, role?.name, role?.key, primitive].map(normalizeRoleKey).filter(Boolean);
}

function roleIsAssigned(role, assignedRoles) {
  const roleKeys = roleIdentityValues(role);
  return assignedRoles.some((assignedRole) => {
    const assignedKeys = roleIdentityValues(assignedRole);
    return roleKeys.some((key) => assignedKeys.includes(key));
  });
}

// owner/admin имеют максимальный доступ на бэкенде (owner короткозамыкается в check()),
// поэтому role.permissions/summary могут не содержать всех прав. Это display-fallback:
// для elevated-ролей показываем полный доступ, а не "Нет доступа".
const ELEVATED_ROLE_KEYS = new Set(['owner', 'admin']);

function roleIsElevated(role) {
  return roleIdentityValues(role).some((key) => ELEVATED_ROLE_KEYS.has(key));
}

function primaryRoleRank(role) {
  const keys = roleIdentityValues(role);
  const direct = keys.map((key) => PRIMARY_ROLE_PRIORITY.indexOf(key)).filter((index) => index >= 0);
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

function summarizeCapability(names, prefixes, elevated = false) {
  if (elevated) return 'admin';
  const scoped = names.filter((name) => prefixes.some((prefix) => name === prefix || name.startsWith(prefix)));
  if (!scoped.length) return 'none';
  const joined = scoped.join(' ');
  if (/(^|:)(manage|assign|delete|post|correct|publish|archive|duplicate|cancel|issue)\b/.test(joined)) return 'admin';
  if (/(^|:)(create|update|upload|convert)\b/.test(joined)) return 'write';
  return 'read';
}

function summarizeRoleCapability(names, matchers, role = null) {
  if (roleIsElevated(role)) return 'full';
  const scoped = names.filter((name) => matchesPermission(name, matchers));
  if (!scoped.length) return 'none';
  if (scoped.some((name) => /(^|:)(delete|manage|assign|admin|publish|post|correct|cancel|archive|duplicate|restore)\b/.test(name) || /\.write$/.test(name))) return 'full';
  if (scoped.some((name) => /(^|:)(create|update|upload|convert|write|invite|send|revoke)\b/.test(name))) return 'partial';
  return 'read';
}

function getEffectivePermissionNames(summary) {
  return (Array.isArray(summary?.permissions) ? summary.permissions : [])
    .filter((permission) => permission?.effective && permission?.name)
    .map((permission) => String(permission.name));
}

function getOverrideCount(summary) {
  return (Array.isArray(summary?.permissions) ? summary.permissions : [])
    .filter((permission) => permission?.viaUserAllow || permission?.viaUserDeny)
    .length;
}

function getAccessLevels(summary, elevated = false) {
  const names = getEffectivePermissionNames(summary);
  return SUMMARY_GROUPS.map((group) => ({
    ...group,
    level: summarizeCapability(names, group.prefixes, elevated),
  }));
}

function getAccessLevelLabel(summary, elevated, t) {
  if (elevated) return t('userDetail.fullAccess');
  const levels = getAccessLevels(summary, false).map((group) => group.level);
  if (levels.some((level) => level === 'admin' || level === 'write')) return t('userDetail.standardAccess');
  if (levels.some((level) => level === 'read')) return t('userDetail.readOnlyAccess');
  return t('organization.access.levels.none');
}

function getAccessLevelTone(summary, elevated = false) {
  if (elevated) return 'success';
  const levels = getAccessLevels(summary, false).map((group) => group.level);
  if (levels.some((level) => level === 'admin' || level === 'write')) return 'info';
  if (levels.some((level) => level === 'read')) return 'muted';
  return 'muted';
}

function getRoleMeaning(role, elevated, t) {
  if (role?.description) return role.description;
  if (elevated) return t('userDetail.fullAccess');
  return t('userDetail.standardAccess');
}

function normalizeTab(value) {
  if (value === 'roles') return 'access';
  return VALID_TABS.has(value) ? value : 'overview';
}

function getRoleFamily(role) {
  return roleIdentityValues(role).find((key) => PRIMARY_ROLE_PRIORITY.includes(key)) || 'custom';
}

function getRoleAccessLabel(role, t) {
  const family = getRoleFamily(role);
  if (family === 'owner' || family === 'admin') return t('organization.access.levels.admin');
  if (family === 'manager') return t('userDetail.fullOperationalAccess');
  if (family === 'employee' || family === 'user') return t('userDetail.operationalAccess');
  if (family === 'viewer') return t('userDetail.readOnlyAccess');
  return t('userDetail.customAccess');
}

function getRoleExplanation(role, t) {
  if (role?.description) return role.description;
  const family = getRoleFamily(role);
  if (family === 'owner') return t('userDetail.roleExplanationOwner');
  if (family === 'admin') return t('userDetail.roleExplanationAdmin');
  if (family === 'manager') return t('userDetail.roleExplanationManager');
  if (family === 'employee' || family === 'user') return t('userDetail.roleExplanationEmployee');
  if (family === 'viewer') return t('userDetail.roleExplanationViewer');
  return t('userDetail.roleExplanationCustom');
}

function getRoleCapabilities(role, t) {
  const permissionNames = getRolePermissionNames(role);
  return ROLE_CAPABILITY_MODULES
    .map((group) => ({
      ...group,
      level: summarizeRoleCapability(permissionNames, group.matchers, role),
      label: t(group.labelKey),
    }))
    .filter((group) => group.level !== 'none');
}

function buildAccessChangePreview(currentRole, nextRole, t) {
  const currentNames = getRolePermissionNames(currentRole);
  const nextNames = getRolePermissionNames(nextRole);
  const willLose = [];
  const willKeep = [];

  ROLE_CAPABILITY_MODULES.forEach((group) => {
    const currentLevel = summarizeRoleCapability(currentNames, group.matchers, currentRole);
    const nextLevel = summarizeRoleCapability(nextNames, group.matchers, nextRole);
    const label = t(group.labelKey);
    const nextText = t(`organization.roles.levels.${nextLevel}`);

    if (ROLE_LEVEL_RANK[nextLevel] < ROLE_LEVEL_RANK[currentLevel] && currentLevel !== 'none') {
      willLose.push(`${label}: ${t(`organization.roles.levels.${currentLevel}`)} → ${nextText}`);
      return;
    }
    if (nextLevel !== 'none') {
      willKeep.push(`${label}: ${nextText}`);
    }
  });

  return { willLose, willKeep };
}

function getRiskItems(user, summary, primaryRole, elevated, t) {
  const assignedRoles = Array.isArray(summary?.roles) ? summary.roles : [];
  const overrideCount = getOverrideCount(summary);
  const status = normalizeRoleKey(user?.status || 'active');
  const items = [];

  if (elevated || roleIsElevated(primaryRole)) {
    items.push({ key: 'elevated', tone: 'warning', label: t('userDetail.elevatedAccess') });
  }
  if (status === 'suspended') {
    items.push({ key: 'suspended', tone: 'danger', label: t('organization.suspended') });
  }
  if (overrideCount > 0) {
    items.push({ key: 'overrides', tone: 'warning', label: t('userDetail.hasOverrides', { count: overrideCount }) });
  }
  if (assignedRoles.length > 1) {
    items.push({ key: 'multipleRoles', tone: 'warning', label: t('userDetail.multipleRoles') });
  }
  if (!user?.lastLoginAt) {
    items.push({ key: 'neverLoggedIn', tone: 'muted', label: t('userDetail.neverLoggedIn') });
  }

  return items;
}

function roleDisplayName(role, t) {
  const raw = role?.name || role?.slug || role?.key || role;
  const normalized = String(raw || '').toLowerCase();
  const translated = t(`organization.${normalized}`, { defaultValue: normalized });
  return translated === normalized ? raw || '—' : translated;
}

function getRoleBadge(role, t) {
  if (role?.isSystem) return { tone: 'info', label: t('organization.roles.system') };
  if (role?.isDefault) return { tone: 'success', label: t('organization.roles.default') };
  return { tone: 'neutral', label: t('organization.roles.custom') };
}

function getRoleTypeTone(role) {
  if (role?.isSystem) return 'info';
  if (role?.isDefault) return 'success';
  return 'muted';
}

function errorMessage(error) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || 'Request failed';
}

function accessSafetyMessage(error, t) {
  const raw = errorMessage(error);
  const normalized = raw.toLowerCase();
  if (
    (normalized.includes('last') && normalized.includes('owner')) ||
    (normalized.includes('послед') && normalized.includes('владель')) ||
    (normalized.includes('единствен') && normalized.includes('владель'))
  ) return t('userDetail.lastOwnerProtected');
  if (normalized.includes('owner') || normalized.includes('admin') || normalized.includes('self')) {
    return t('userDetail.adminOwnerProtected');
  }
  return raw;
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.email || '—';
}

function normalizeUser(data) {
  if (!data?.user) return data || {};
  const membership = data.membership || {};
  return {
    ...data,
    ...data.user,
    role: membership.role ?? data.role,
    status: membership.status ?? data.status,
    isLead: membership.isLead ?? data.isLead,
    departmentId: membership.departmentId || membership.department?.id || data.departmentId || null,
    department: membership.department || data.department || null,
    membership,
  };
}

function initialsFor(user) {
  const name = fullName(user);
  const source = name === '—' ? user?.email : name;
  return String(source || '?')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';
}

function roleFallback(user) {
  return user?.role ? { name: user.role, slug: user.role, isDefault: true, permissions: [] } : null;
}

function RoleChip({ role }) {
  const { t } = useTranslation();
  if (!role) {
    return <WmsStatusChip tone="muted" marker="solid" size="sm">—</WmsStatusChip>;
  }
  return (
    <WmsStatusChip tone="info" marker="solid" size="sm">
      {roleDisplayName(role, t)}
    </WmsStatusChip>
  );
}

function RoleTypeBadge({ role }) {
  const { t } = useTranslation();
  if (!role || typeof role !== 'object') return null;
  const badge = getRoleBadge(role, t);
  return (
    <WmsStatusChip tone={getRoleTypeTone(role)} marker="solid" size="sm">
      {badge.label}
    </WmsStatusChip>
  );
}

function QuickAccessSummary({ summary, compact = false, elevated = false }) {
  const { t } = useTranslation();
  const names = useMemo(() => getEffectivePermissionNames(summary), [summary]);
  return (
    <div className={compact ? s.summaryGridCompact : s.summaryGrid}>
      {SUMMARY_GROUPS.map((group) => {
        const level = summarizeCapability(names, group.prefixes, elevated);
        return (
          <div key={group.key} className={s.summaryRow}>
            <span>{t(group.labelKey)}</span>
            <strong className={s[`access_${level}`]}>{t(`organization.access.levels.${level}`)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function DetailAvatar({ user }) {
  const name = fullName(user);
  if (user?.avatarUrl) {
    return <img className={s.avatarImage} src={user.avatarUrl} alt={name} />;
  }
  return <span className={s.avatarFallback}>{initialsFor(user)}</span>;
}

function DetailHero({ user, summary, primaryRole, elevated = false, canChangeRole = false, onBack, onRoles }) {
  const { t } = useTranslation();
  const assignedRoles = Array.isArray(summary?.roles) ? summary.roles : [];
  const hasMultipleRoles = assignedRoles.length > 1;
  const status = user.status || 'active';
  const riskItems = getRiskItems(user, summary, primaryRole, elevated, t);

  return (
    <WmsSurface variant="panel" padding="lg" className={s.hero}>
      <div className={s.heroIdentity}>
        <div className={s.avatar}>
          <DetailAvatar user={user} />
        </div>
        <div className={s.heroCopy}>
          <div className={s.heroEyebrow}>{t('organization.eyebrow')} / {t('organization.people')}</div>
          <h2>{fullName(user)}</h2>
          <div className={s.heroEmail}>
            <Mail size={15} />
            <span>{user.email || '—'}</span>
          </div>
          <div className={s.heroRoleLine}>
            <RoleChip role={primaryRole} />
            <span className={s.heroRoleMeaning}>{getRoleMeaning(primaryRole, elevated, t)}</span>
          </div>
          <div className={s.heroChips}>
            <WmsStatusChip status={status} size="sm">
              {t(`organization.${status}`, { defaultValue: status })}
            </WmsStatusChip>
            <WmsStatusChip tone={getAccessLevelTone(summary, elevated)} marker="solid" size="sm">
              {t('userDetail.accessLevel')}: {getAccessLevelLabel(summary, elevated, t)}
            </WmsStatusChip>
            <WmsStatusChip tone={user.department?.name ? 'info' : 'muted'} marker="solid" size="sm">
              <Building2 size={13} />
              {user.department?.name || t('organization.departmentDirectory.unassigned')}
            </WmsStatusChip>
            {user.isLead ? (
              <WmsStatusChip tone="success" marker="solid" size="sm">
                <UserCheck size={13} />
                {t('organization.lead')}
              </WmsStatusChip>
            ) : null}
            <RoleTypeBadge role={primaryRole} />
            {hasMultipleRoles ? (
              <WmsStatusChip tone="warning" marker="warning" size="sm">
                {t('userDetail.multipleRoles')}
              </WmsStatusChip>
            ) : null}
            {riskItems.length ? (
              <span className={s.riskChips}>
                {riskItems.map((item) => (
                  <WmsStatusChip key={item.key} tone={item.tone} marker={item.tone === 'warning' ? 'warning' : 'solid'} size="sm">
                    {item.label}
                  </WmsStatusChip>
                ))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className={s.heroMeta}>
        <div className={s.metaItem}>
          <span>{t('organization.lastActivity')}</span>
          <strong>{formatDateTime(user.lastLoginAt)}</strong>
        </div>
        <div className={s.heroActions}>
          <button className={s.secondaryButton} type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            {t('userDetail.backToPeople')}
          </button>
          {canChangeRole ? (
            <button className={s.primaryButton} type="button" onClick={onRoles}>
              <ShieldCheck size={16} />
              {t('userDetail.changeRole')}
            </button>
          ) : null}
        </div>
      </div>
    </WmsSurface>
  );
}

function DetailCard({ title, description, children, className = '' }) {
  return (
    <WmsSurface variant="panel" padding="md" className={`${s.detailCard} ${className}`.trim()}>
      <div className={s.sectionHeader}>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </WmsSurface>
  );
}

function FactGrid({ items }) {
  return (
    <div className={s.factGrid}>
      {items.map((item) => (
        <div key={item.label} className={s.factItem}>
          <span>{item.label}</span>
          <strong>{item.value || '—'}</strong>
        </div>
      ))}
    </div>
  );
}

function MembershipEditor({ user }) {
  const { t } = useTranslation();
  const { can } = useAclPermissions();
  const canUpdateMember = can('member:update');
  const { data: departmentsRaw = [] } = useListDepartmentsQuery({}, { skip: !canUpdateMember });
  const [updateMember, { isLoading }] = useUpdateUserRoleMutation();
  const [notice, setNotice] = useState(null);
  const departments = Array.isArray(departmentsRaw) ? departmentsRaw.filter((department) => department.isActive) : [];
  const departmentId = user.departmentId || user.department?.id || '';
  const isLead = Boolean(user.isLead);

  const updateMembership = async (patch) => {
    if (!canUpdateMember || !user?.id) return;
    setNotice(null);
    try {
      await updateMember({ userId: user.id, ...patch }).unwrap();
      setNotice({ type: 'success', text: t('organization.departmentDirectory.membershipUpdated') });
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    }
  };

  if (!canUpdateMember) {
    return <p className={s.muted}>{t('organization.departmentDirectory.membershipExplainer')}</p>;
  }

  const departmentOptions = [
    { value: '', label: t('organization.departmentDirectory.unassigned') },
    ...departments.map((department) => ({ value: department.id, label: department.name })),
  ];

  return (
    <div className={s.membershipEditor}>
      <p className={s.muted}>{t('organization.departmentDirectory.membershipExplainer')}</p>
      <div className={s.membershipControls}>
        <SelectField
          value={departmentId}
          options={departmentOptions}
          onValueChange={(nextDepartmentId) => updateMembership({
            departmentId: nextDepartmentId || null,
            ...(nextDepartmentId ? {} : { isLead: false }),
          })}
          label={t('organization.departmentDirectory.name')}
          size="sm"
          disabled={isLoading}
          searchable
        />
        <CheckboxField
          name="departmentLead"
          label={t('organization.departmentDirectory.leadInformational')}
          checked={isLead}
          onValueChange={(checked) => updateMembership({ departmentId, isLead: checked })}
          disabled={isLoading || !departmentId}
          size="sm"
        />
      </div>
      {notice ? (
        <p className={`${s.inlineNotice} ${s[`inlineNotice_${notice.type}`] || ''}`.trim()}>{notice.text}</p>
      ) : null}
    </div>
  );
}

function OverviewTab({ user, summary, primaryRole, elevated = false }) {
  const { t } = useTranslation();
  const roles = Array.isArray(summary?.roles) ? summary.roles : [];
  const overrideCount = getOverrideCount(summary);
  const riskItems = getRiskItems(user, summary, primaryRole, elevated, t);

  return (
    <div className={`${s.tabPanel} ${s.overviewGrid}`}>
      <DetailCard title={t('userDetail.profile')}>
        <FactGrid
          items={[
            { label: t('organization.user'), value: fullName(user) },
            { label: t('organization.email'), value: user.email },
            { label: t('userDetail.joined'), value: formatDateTime(user.createdAt) },
            { label: t('organization.lastActivity'), value: formatDateTime(user.lastLoginAt) },
          ]}
        />
      </DetailCard>
      <DetailCard title={t('userDetail.membership')}>
        <FactGrid
          items={[
            { label: t('organization.status'), value: t(`organization.${user.status || 'active'}`, { defaultValue: user.status || 'active' }) },
            { label: t('organization.role'), value: primaryRole ? roleDisplayName(primaryRole, t) : '—' },
            { label: t('userDetail.departments'), value: user.department?.name || t('organization.departmentDirectory.unassigned') },
            { label: t('organization.lead'), value: user.isLead ? t('common.yes', 'Yes') : t('common.no', 'No') },
          ]}
        />
        <MembershipEditor user={user} />
      </DetailCard>
      <DetailCard title={t('userDetail.accessSummary')}>
        <QuickAccessSummary summary={summary} compact elevated={elevated} />
      </DetailCard>
      <DetailCard title={t('userDetail.risk')}>
        {riskItems.length ? (
          <div className={s.riskList}>
            {riskItems.map((item) => (
              <WmsStatusChip key={item.key} tone={item.tone} marker={item.tone === 'warning' ? 'warning' : 'solid'} size="sm">
                {item.label}
              </WmsStatusChip>
            ))}
          </div>
        ) : (
          <p className={s.muted}>{t('userDetail.noRisk')}</p>
        )}
        <FactGrid
          items={[
            { label: t('userDetail.overrides'), value: overrideCount },
            { label: t('userDetail.roles'), value: roles.length },
          ]}
        />
      </DetailCard>
    </div>
  );
}

function AccessTab({ userId }) {
  const { t } = useTranslation();
  const { can } = useAclPermissions();
  const canAssignRole = can('role:assign');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingRoleId, setPendingRoleId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const { data: rolesRaw = [], isFetching: rolesLoading } = useListRolesQuery();
  const { data: summary, isFetching: summaryLoading } = useUserPermSummaryQuery(userId, { skip: !userId });
  const [assignRoleToUser] = useAssignRoleToUserMutation();
  const [removeRoleFromUser] = useRemoveRoleFromUserMutation();

  const assignedRoles = Array.isArray(summary?.roles) ? summary.roles : [];
  const primaryRole = getPrimaryAssignedRole(assignedRoles);
  const hasMultipleAssignedRoles = assignedRoles.length > 1;
  const currentCapabilities = getRoleCapabilities(primaryRole, t).slice(0, 4);
  const filteredRoles = sortRolesForAssignment(Array.isArray(rolesRaw) ? rolesRaw : [], t).filter((role) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [role?.name, role?.slug, role?.key, role?.description, ...getRolePermissionNames(role)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
  const selectedAlreadyPrimary = selectedRole && primaryRole && roleIsAssigned(selectedRole, [primaryRole]) && !hasMultipleAssignedRoles;
  const preview = selectedRole && !selectedAlreadyPrimary
    ? buildAccessChangePreview(primaryRole, selectedRole, t)
    : null;
  const roleDowngrade = preview && primaryRoleRank(selectedRole) > primaryRoleRank(primaryRole);

  const applyRoleChange = async () => {
    const role = selectedRole;
    if (!canAssignRole || !userId || !role?.id) return;
    const selectedRoleId = String(role.id);
    const alreadyPrimary = primaryRole && roleIsAssigned(role, [primaryRole]) && !hasMultipleAssignedRoles;
    if (alreadyPrimary) return;

    setPendingRoleId(selectedRoleId);
    setNotice(null);
    try {
      if (!roleIsAssigned(role, assignedRoles)) {
        await assignRoleToUser({ userId, roleId: role.id }).unwrap();
      }
      const rolesToRemove = assignedRoles.filter((assignedRole) => assignedRole?.id && String(assignedRole.id) !== selectedRoleId);
      for (const assignedRole of rolesToRemove) {
        await removeRoleFromUser({ userId, roleId: assignedRole.id }).unwrap();
      }
      setNotice({ type: 'success', text: t('organization.roles.primaryRoleUpdated', { role: roleDisplayName(role, t) }) });
      setSelectedRole(null);
      setPickerOpen(false);
    } catch (error) {
      setNotice({ type: 'error', text: accessSafetyMessage(error, t) });
    } finally {
      setPendingRoleId('');
    }
  };

  return (
    <div className={s.tabPanel}>
      <WmsSurface variant="panel" padding="md" className={`${s.detailCard} ${s.currentAccessCard}`}>
        <div className={s.accessOverview}>
          <div className={s.sectionHeader}>
            <div>
              <h3>{t('userDetail.currentAccess')}</h3>
              <p>{t('userDetail.roleExplanation')}</p>
            </div>
          </div>
          <div className={s.accessIdentity}>
            <div className={s.accessRoleBlock}>
              <span>{t('userDetail.primaryRole')}</span>
              <strong>{primaryRole ? roleDisplayName(primaryRole, t) : '—'}</strong>
              <p>{primaryRole ? getRoleExplanation(primaryRole, t) : t('userDetail.noAccessData')}</p>
            </div>
            <div className={s.accessLevelBlock}>
              <span>{t('userDetail.accessLevel')}</span>
              <WmsStatusChip tone={roleIsElevated(primaryRole) ? 'success' : 'info'} marker="solid" size="sm">
                {primaryRole ? getRoleAccessLabel(primaryRole, t) : t('organization.access.levels.none')}
              </WmsStatusChip>
              <RoleTypeBadge role={primaryRole} />
            </div>
          </div>
          {currentCapabilities.length ? (
            <div className={s.accessCapabilities}>
              {currentCapabilities.map((item) => (
                <WmsStatusChip key={item.key} tone={item.level === 'full' ? 'success' : item.level === 'partial' ? 'warning' : 'info'} marker="solid" size="sm">
                  {item.label} · {t(`organization.roles.levels.${item.level}`)}
                </WmsStatusChip>
              ))}
            </div>
          ) : null}
          {hasMultipleAssignedRoles ? <div className={s.warning}>{t('userDetail.multipleLegacyRoles')}</div> : null}
          {notice ? <div className={`${s.notice} ${s[`notice_${notice.type}`]}`}>{notice.text}</div> : null}
          {canAssignRole ? (
            <div className={s.accessActions}>
              <button
                className={s.primaryButton}
                type="button"
                onClick={() => {
                  setPickerOpen((open) => !open);
                  setNotice(null);
                }}
              >
                <ShieldCheck size={16} />
                {t('userDetail.changeRole')}
              </button>
            </div>
          ) : (
            <p className={s.muted}>{t('organization.roles.readOnly')}</p>
          )}
        </div>
      </WmsSurface>

      {pickerOpen && canAssignRole ? (
        <WmsSurface variant="panel" padding="md" className={`${s.detailCard} ${s.rolePickerPanel}`}>
          <div className={s.cardToolbar}>
            <div className={s.sectionHeader}>
              <div>
                <h3>{t('userDetail.primaryRole')}</h3>
                <p>{t('organization.roles.choosePrimaryRole')}</p>
              </div>
            </div>
            <SearchField
              className={s.search}
              value={query}
              onValueChange={setQuery}
              clearable
              placeholder={t('organization.roles.searchRoles')}
            />
          </div>
          {rolesLoading || summaryLoading ? <WmsLoadingState title={t('common.loading')} rows={4} /> : null}
          <div className={s.roleList}>
            {filteredRoles.map((role) => {
              const active = primaryRole ? roleIsAssigned(role, [primaryRole]) : roleIsAssigned(role, assignedRoles);
              const selected = selectedRole ? roleIsAssigned(role, [selectedRole]) : false;
              return (
                <button
                  key={role.id || role.slug || role.name}
                  type="button"
                  className={`${s.roleRow} ${active ? s.roleRowActive : ''} ${selected ? s.roleRowSelected : ''}`.trim()}
                  disabled={pendingRoleId === String(role.id)}
                  onClick={() => {
                    setNotice(null);
                    setSelectedRole(active && !hasMultipleAssignedRoles ? null : role);
                  }}
                >
                  <span className={s.roleRadio} aria-hidden="true"><span /></span>
                  <span className={s.roleMain}>
                    <span className={s.roleHead}>
                      <span>
                        <strong>{roleDisplayName(role, t)}</strong>
                        <small>{getRoleExplanation(role, t)}</small>
                      </span>
                      <span className={s.roleBadges}>
                        <RoleTypeBadge role={role} />
                        <WmsStatusChip tone="muted" marker="solid" size="sm">
                          {getRoleAccessLabel(role, t)}
                        </WmsStatusChip>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {preview ? (
            <div className={s.impactPreview}>
              <div className={s.sectionHeader}>
                <div>
                  <h3>{t('userDetail.accessChanges')}</h3>
                  <p>
                    {roleDisplayName(primaryRole, t)} → {roleDisplayName(selectedRole, t)}
                  </p>
                </div>
              </div>
              <div className={s.impactGrid}>
                <div>
                  <span>{t('userDetail.willLose')}</span>
                  {preview.willLose.length ? (
                    <ul>
                      {preview.willLose.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className={s.muted}>—</p>
                  )}
                </div>
                <div>
                  <span>{t('userDetail.willKeep')}</span>
                  {preview.willKeep.length ? (
                    <ul>
                      {preview.willKeep.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : (
                    <p className={s.muted}>—</p>
                  )}
                </div>
              </div>
              {roleDowngrade ? (
                <div className={s.warning}>{t('userDetail.importantPermissionsWarning')}</div>
              ) : null}
              <div className={s.confirmActions}>
                <button className={s.secondaryButton} type="button" onClick={() => setSelectedRole(null)}>
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  className={s.primaryButton}
                  type="button"
                  disabled={Boolean(pendingRoleId)}
                  onClick={applyRoleChange}
                >
                  {t('userDetail.confirmRoleChange')}
                </button>
              </div>
            </div>
          ) : null}
        </WmsSurface>
      ) : null}
    </div>
  );
}

function PermissionsTab({ userId, summary, elevated = false }) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className={s.tabPanel}>
      <DetailCard title={t('userDetail.effectiveAccess')} description={t('userDetail.permissionsIntro')}>
        <QuickAccessSummary summary={summary} compact elevated={elevated} />
      </DetailCard>
      <WmsSurface variant="panel" padding="md" className={s.detailsDisclosure}>
        <button
          type="button"
          className={s.disclosureButton}
          aria-expanded={showDetails}
          onClick={() => setShowDetails((open) => !open)}
        >
          <span>{t(showDetails ? 'userDetail.hideDetailedPermissions' : 'userDetail.showDetailedPermissions')}</span>
          <span className={s.disclosureCaret} aria-hidden="true">{showDetails ? '▾' : '▸'}</span>
        </button>
        {showDetails ? (
          <div className={s.accessPanelWrap}>
            <UserAccessPanel userId={userId} permissionsOnly />
          </div>
        ) : null}
      </WmsSurface>
    </div>
  );
}

function UserDetailsTabs({ tab, userId, user, summary, primaryRole, elevated = false }) {
  if (tab === 'overview') return <OverviewTab user={user} summary={summary} primaryRole={primaryRole} elevated={elevated} />;
  if (tab === 'access') return <AccessTab userId={userId} />;
  if (tab === 'permissions') return <PermissionsTab userId={userId} summary={summary} elevated={elevated} />;
  return null;
}

export default function UserEntityPage() {
  const params = useParams();
  const userId = params.userId || params.id;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { can } = useAclPermissions();
  const tabPanelRef = useRef(null);
  const activeTabRaw = searchParams.get('tab') || 'overview';
  const activeTab = normalizeTab(activeTabRaw);

  const { data: base, isFetching, error, refetch } = useGetCompanyUserQuery(userId, { skip: !userId });
  const { data: summary, isFetching: summaryLoading } = useUserPermSummaryQuery(userId, { skip: !userId });

  const tabs = useMemo(() => ([
    { key: 'overview', label: t('userDetail.overview') },
    { key: 'access', label: t('userDetail.access') },
    { key: 'permissions', label: t('userDetail.permissions') },
  ]), [t]);

  if (!userId) {
    return (
      <main className={s.page}>
        <WmsErrorState title={t('userDetail.notFound')} description="userId is missing" />
      </main>
    );
  }

  if (error) {
    return (
      <main className={s.page}>
        <WmsErrorState title={t('userDetail.loadError')} description={errorMessage(error)} onRetry={refetch} />
      </main>
    );
  }

  if (isFetching || !base) {
    return (
      <main className={s.page}>
        <WmsLoadingState title={t('common.loading')} rows={8} />
      </main>
    );
  }

  const user = normalizeUser(base);
  const assignedRoles = Array.isArray(summary?.roles) ? summary.roles : [];
  const primaryRole = getPrimaryAssignedRole(assignedRoles) || roleFallback(user);
  const elevated = roleIsElevated(primaryRole) || ELEVATED_ROLE_KEYS.has(normalizeRoleKey(user.role));

  // Скролл только при ЯВНОМ клике по табу (не на back/forward — там URL меняет браузер,
  // setTab не вызывается, нативное восстановление скролла сохраняется).
  // Якорим начало панели вкладки через scroll-margin-top (см. .tabPanelAnchor в CSS),
  // не фокусируем search/radio, чтобы не вызвать авто-scrollIntoView.
  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
    // двойной rAF: ждём пока новая панель смонтируется и измерится, затем скроллим к её началу
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        tabPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  return (
    <main className={s.page}>
      <PageHeader
        eyebrow={t('organization.eyebrow')}
        title={t('organization.people')}
        subtitle={t('userDetail.profile')}
        breadcrumbs={(
          <div className={s.breadcrumbs}>
            <button type="button" onClick={() => navigate('/main/company-users/people')}>{t('organization.people')}</button>
            <span>/</span>
            <span>{fullName(user)}</span>
          </div>
        )}
      />

      <DetailHero
        user={user}
        summary={summary}
        primaryRole={primaryRole}
        elevated={elevated}
        canChangeRole={can('role:assign')}
        onBack={() => navigate('/main/company-users/people')}
        onRoles={() => setTab('access')}
      />

      {summaryLoading && !summary ? (
        <WmsSurface variant="panel" padding="md">
          <WmsLoadingState title={t('common.loading')} rows={4} />
        </WmsSurface>
      ) : summary ? (
        <>
          <WmsSurface variant="panel" padding="none" className={s.tabsSurface}>
            <div className={s.tabsWrap}>
              <TabBar items={tabs} activeKey={activeTab} onChange={setTab} />
            </div>
          </WmsSurface>

          <div ref={tabPanelRef} className={s.tabPanelAnchor}>
            <UserDetailsTabs
              tab={activeTab}
              userId={userId}
              user={user}
              summary={summary}
              primaryRole={primaryRole}
              elevated={elevated}
            />
          </div>
        </>
      ) : (
        <WmsEmptyState title={t('userDetail.noAccessData')} />
      )}
    </main>
  );
}
