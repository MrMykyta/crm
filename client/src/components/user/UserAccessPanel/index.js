// src/components/user/UserAccessPanel/index.jsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

import Switch from '../../inputs/Switch';
import { SearchField } from '../../ui/fields';
import { WmsEmptyState, WmsStatusChip, WmsSurface } from '../../wms/ui';
import useAclPermissions from '../../../hooks/useAclPermissions';
import {
  getPermissionMeta,
  groupPermissions,
} from '../../../config/permissionMeta';
import s from './UserAccessPanel.module.css';

import {
  useListRolesQuery,
  useUserPermSummaryQuery,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  useAllowPermForUserMutation,
  useDenyPermForUserMutation,
} from '../../../store/rtk/aclApi';

function sourceSummary(resource) {
  return {
    role: resource.permissions.some((permission) => permission.viaRole),
    allow: resource.permissions.some((permission) => permission.viaUserAllow),
    deny: resource.permissions.some((permission) => permission.viaUserDeny),
  };
}

function accessLevel(resource) {
  const effective = resource.permissions.filter((permission) => permission.effective);
  if (!effective.length) return 'none';
  const actions = new Set(effective.map((permission) => permission.meta.action));
  if (actions.has('assign') || actions.has('manage') || actions.has('correct') || actions.has('post')) return 'manage';
  if (actions.has('delete') || actions.has('publish') || actions.has('archive') || actions.has('duplicate') || actions.has('cancel')) return 'manage';
  if (actions.has('create') || actions.has('update') || actions.has('upload') || actions.has('write') || actions.has('convert')) return 'write';
  return 'read';
}

function levelTone(level) {
  if (level === 'manage') return 'warning';
  if (level === 'write') return 'info';
  if (level === 'read') return 'success';
  return 'muted';
}

function SourceChips({ resource, t }) {
  const sources = sourceSummary(resource);
  return (
    <div className={s.sourceChips}>
      {sources.role ? (
        <WmsStatusChip tone="info" marker="solid" size="sm">{t('acl.permissionUx.sources.role')}</WmsStatusChip>
      ) : null}
      {sources.allow ? (
        <WmsStatusChip tone="success" marker="solid" size="sm">{t('acl.permissionUx.sources.allow')}</WmsStatusChip>
      ) : null}
      {sources.deny ? (
        <WmsStatusChip tone="danger" marker="solid" size="sm">{t('acl.permissionUx.sources.deny')}</WmsStatusChip>
      ) : null}
      {!sources.role && !sources.allow && !sources.deny ? (
        <WmsStatusChip tone="muted" marker="solid" size="sm">{t('acl.permissionUx.sources.none')}</WmsStatusChip>
      ) : null}
    </div>
  );
}

function PermissionAccordion({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={s.accordion}>
      <button type="button" className={s.accordionHead} onClick={() => setOpen((value) => !value)}>
        <span className={s.accordionTitle}>
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          {title}
        </span>
        <span className={s.countPill}>{count}</span>
      </button>
      {open ? <div className={s.accordionBody}>{children}</div> : null}
    </section>
  );
}

function ResourceCard({ resource, t }) {
  const level = accessLevel(resource);
  const visiblePermissions = resource.permissions.filter((permission) => permission.effective || permission.viaUserDeny);
  const preview = visiblePermissions.slice(0, 4);

  return (
    <WmsSurface variant="card" padding="md" className={s.resourceCard}>
      <div className={s.resourceHead}>
        <div>
          <h4>{resource.label}</h4>
          <p>{t('acl.permissionUx.resourceCount', { count: resource.permissions.length })}</p>
        </div>
        <WmsStatusChip tone={levelTone(level)} marker="solid" size="sm">
          {t(`acl.permissionUx.levels.${level}`)}
        </WmsStatusChip>
      </div>
      <SourceChips resource={resource} t={t} />
      <div className={s.permissionPreview}>
        {preview.map((permission) => (
          <span key={permission.id || permission.name} className={permission.viaUserDeny ? s.previewDeny : ''}>
            {permission.meta.label}
          </span>
        ))}
        {visiblePermissions.length > preview.length ? (
          <span className={s.previewMore}>+{visiblePermissions.length - preview.length}</span>
        ) : null}
        {!visiblePermissions.length ? <span className={s.muted}>{t('acl.permissionUx.noEffective')}</span> : null}
      </div>
    </WmsSurface>
  );
}

function EffectiveAccessSummary({ groups, t }) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      resources: group.resources.filter((resource) => (
        resource.effectiveCount || resource.directAllowCount || resource.directDenyCount || resource.roleCount
      )),
    }))
    .filter((group) => group.resources.length);

  if (!visibleGroups.length) {
    return <WmsEmptyState title={t('acl.permissionUx.noEffectiveTitle')} description={t('acl.permissionUx.noEffectiveBody')} compact />;
  }

  return (
    <div className={s.moduleStack}>
      {visibleGroups.map((group) => (
        <section key={group.key} className={s.moduleSection}>
          <div className={s.moduleHeader}>
            <h3>{group.label}</h3>
            <span>{t('acl.permissionUx.resourcesCount', { count: group.resources.length })}</span>
          </div>
          <div className={s.resourceGrid}>
            {group.resources.map((resource) => (
              <ResourceCard key={resource.key} resource={resource} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DirectOverrides({ overrides, t }) {
  if (!overrides.length) {
    return (
      <WmsEmptyState
        title={t('acl.permissionUx.noOverridesTitle')}
        description={t('acl.permissionUx.noOverridesBody')}
        compact
      />
    );
  }

  return (
    <div className={s.overrideList}>
      {overrides.map((permission) => (
        <div key={permission.id || permission.name} className={s.overrideRow}>
          <div>
            <strong>{permission.meta.label}</strong>
            <span>{permission.meta.resourceLabel}</span>
          </div>
          <div className={s.sourceChips}>
            {permission.viaUserAllow ? (
              <WmsStatusChip tone="success" marker="solid" size="sm">{t('acl.permissionUx.sources.allow')}</WmsStatusChip>
            ) : null}
            {permission.viaUserDeny ? (
              <WmsStatusChip tone="danger" marker="solid" size="sm">{t('acl.permissionUx.sources.deny')}</WmsStatusChip>
            ) : null}
            {permission.meta.danger ? (
              <WmsStatusChip tone="danger" marker="warning" size="sm">{t('acl.permissionUx.danger')}</WmsStatusChip>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdvancedPermissionGrid({
  groups,
  query,
  onQueryChange,
  canAssignPermission,
  onTogglePermission,
  t,
}) {
  return (
    <PermissionAccordion title={t('acl.permissionUx.advanced')} count={groups.reduce((sum, group) => sum + group.resources.reduce((inner, resource) => inner + resource.permissions.length, 0), 0)}>
      <div className={s.advancedToolbar}>
        <SearchField
          placeholder={t('acl.permissionUx.searchPermissions')}
          value={query}
          onValueChange={onQueryChange}
          clearable
        />
      </div>
      <div className={s.advancedStack}>
        {groups.map((group) => (
          <PermissionAccordion
            key={group.key}
            title={group.label}
            count={group.resources.reduce((sum, resource) => sum + resource.permissions.length, 0)}
          >
            {group.resources.map((resource) => (
              <PermissionAccordion key={resource.key} title={resource.label} count={resource.permissions.length}>
                <ul className={s.permissionList}>
                  {resource.permissions.map((permission) => {
                    const checked = Boolean(permission.effective);
                    return (
                      <li key={permission.id || permission.name} className={permission.meta.danger ? `${s.permissionRow} ${s.permissionRowDanger}` : s.permissionRow}>
                        <div className={s.permissionCopy}>
                          <strong>{permission.meta.label}</strong>
                          <code>{permission.name}</code>
                        </div>
                        <div className={s.sourceChips}>
                          {permission.viaRole ? <WmsStatusChip tone="info" marker="solid" size="sm">{t('acl.permissionUx.sources.role')}</WmsStatusChip> : null}
                          {permission.viaUserAllow ? <WmsStatusChip tone="success" marker="solid" size="sm">{t('acl.permissionUx.sources.allow')}</WmsStatusChip> : null}
                          {permission.viaUserDeny ? <WmsStatusChip tone="danger" marker="solid" size="sm">{t('acl.permissionUx.sources.deny')}</WmsStatusChip> : null}
                          {permission.meta.danger ? <WmsStatusChip tone="danger" marker="warning" size="sm">{t('acl.permissionUx.danger')}</WmsStatusChip> : null}
                        </div>
                        <Switch
                          checked={checked}
                          onChange={(nextChecked) => onTogglePermission(permission, nextChecked)}
                          ariaLabel={`Toggle ${permission.name}`}
                          color={checked ? 'success' : 'danger'}
                          disabled={!canAssignPermission}
                        />
                      </li>
                    );
                  })}
                </ul>
              </PermissionAccordion>
            ))}
          </PermissionAccordion>
        ))}
      </div>
    </PermissionAccordion>
  );
}

export default function UserAccessPanel({ userId, permissionsOnly = false }) {
  const { t } = useTranslation();
  const { can } = useAclPermissions();
  const canAssignRole = can('role:assign');
  const canAssignPermission = can('permission:assign');
  const [qRole, setQRole] = useState('');
  const [qPerm, setQPerm] = useState('');

  const { data: rolesRaw = [], isFetching: rolesLoading } = useListRolesQuery(undefined, {
    skip: permissionsOnly,
  });
  const { data: summary, isFetching: summaryLoading } = useUserPermSummaryQuery(userId, { skip: !userId });

  const [assignRoleToUser] = useAssignRoleToUserMutation();
  const [removeRoleFromUser] = useRemoveRoleFromUserMutation();
  const [allowPermForUser] = useAllowPermForUserMutation();
  const [denyPermForUser] = useDenyPermForUserMutation();

  const loading = (!permissionsOnly && rolesLoading) || summaryLoading;

  const allRoles = useMemo(() => {
    const term = qRole.trim().toLowerCase();
    const arr = Array.isArray(rolesRaw) ? rolesRaw : [];
    if (!term) return arr;
    return arr.filter((role) => `${role.name ?? ''} ${role.description ?? ''}`.toLowerCase().includes(term));
  }, [rolesRaw, qRole]);

  const hasRole = (roleId) => Array.isArray(summary?.roles) && summary.roles.some((role) => String(role.id) === String(roleId));

  const toggleRole = async (role) => {
    const active = hasRole(role.id);
    if (!canAssignRole) return;
    try {
      if (active) await removeRoleFromUser({ userId, roleId: role.id }).unwrap();
      else await assignRoleToUser({ userId, roleId: role.id }).unwrap();
    } catch (error) {
      console.error('toggleRole failed', error);
    }
  };

  const decoratedPermissions = useMemo(() => {
    const term = qPerm.trim().toLowerCase();
    const permissions = Array.isArray(summary?.permissions) ? summary.permissions : [];
    return permissions
      .map((permission) => ({
        ...permission,
        meta: getPermissionMeta(permission.name, t),
      }))
      .filter((permission) => {
        if (!term) return true;
        return `${permission.name} ${permission.description || ''} ${permission.meta.label} ${permission.meta.resourceLabel} ${permission.meta.moduleLabel}`
          .toLowerCase()
          .includes(term);
      });
  }, [summary, qPerm, t]);

  const groups = useMemo(() => groupPermissions(decoratedPermissions, t), [decoratedPermissions, t]);

  const directOverrides = useMemo(() => (
    decoratedPermissions
      .filter((permission) => permission.viaUserAllow || permission.viaUserDeny)
      .sort((a, b) => a.meta.moduleLabel.localeCompare(b.meta.moduleLabel) || a.meta.resourceLabel.localeCompare(b.meta.resourceLabel) || a.meta.label.localeCompare(b.meta.label))
  ), [decoratedPermissions]);

  const togglePerm = async (permission, nextChecked) => {
    if (!canAssignPermission) return;
    try {
      if (nextChecked) await allowPermForUser({ userId, permId: permission.id }).unwrap();
      else await denyPermForUser({ userId, permId: permission.id }).unwrap();
    } catch (error) {
      console.error('togglePerm failed', error);
    }
  };

  if (loading) return <div className={s.panel}>{t('common.loading')}</div>;
  if (!summary) return <div className={s.panel}>{t('acl.permissionUx.noAccessData')}</div>;

  return (
    <div className={s.panel}>
      <WmsSurface variant="panel" padding="md" className={s.summaryPanel}>
        <div className={s.panelHeader}>
          <div>
            <h3>{t('acl.permissionUx.effectiveAccessSummary')}</h3>
            <p>{t('acl.permissionUx.effectiveAccessDescription')}</p>
          </div>
          <WmsStatusChip tone="info" marker="solid" size="sm">
            {decoratedPermissions.filter((permission) => permission.effective).length}
          </WmsStatusChip>
        </div>
        <EffectiveAccessSummary groups={groups} t={t} />
      </WmsSurface>

      {!permissionsOnly ? (
        <WmsSurface variant="panel" padding="md" className={s.summaryPanel}>
          <div className={s.panelHeader}>
            <div>
              <h3>{t('acl.permissionUx.userRoles')}</h3>
              <p>{t('acl.permissionUx.userRolesDescription')}</p>
            </div>
            <SearchField
              className={s.roleSearch}
              placeholder={t('acl.permissionUx.searchRoles')}
              value={qRole}
              onValueChange={setQRole}
            />
          </div>
          <div className={s.roles}>
            {allRoles.map((role) => {
              const active = hasRole(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`${s.roleChip} ${active ? s.roleActive : ''}`}
                  title={role.description || role.name}
                  onClick={() => toggleRole(role)}
                  disabled={!canAssignRole}
                >
                  {role.name}
                </button>
              );
            })}
          </div>
        </WmsSurface>
      ) : null}

      <WmsSurface variant="panel" padding="md" className={s.summaryPanel}>
        <div className={s.panelHeader}>
          <div>
            <h3>{t('acl.permissionUx.directOverrides')}</h3>
            <p>{t('acl.permissionUx.directOverridesDescription')}</p>
          </div>
          {directOverrides.some((permission) => permission.meta.danger) ? (
            <WmsStatusChip tone="danger" marker="warning" size="sm">
              <AlertTriangle size={13} />
              {t('acl.permissionUx.danger')}
            </WmsStatusChip>
          ) : null}
        </div>
        <DirectOverrides overrides={directOverrides} t={t} />
      </WmsSurface>

      <WmsSurface variant="panel" padding="md" className={s.summaryPanel}>
        <AdvancedPermissionGrid
          groups={groups}
          query={qPerm}
          onQueryChange={setQPerm}
          canAssignPermission={canAssignPermission}
          onTogglePermission={togglePerm}
          t={t}
        />
      </WmsSurface>
    </div>
  );
}
