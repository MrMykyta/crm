// src/pages/CompanyUsers/index.jsx
import { useMemo, useRef, useState } from "react";
import ListPage from "../../../components/data/ListPage";
import s from "../../styles/CrmUsers.module.css";
import FilterToolbar from "../../../components/filters/FilterToolbar";
import ConfirmDialog from "../../../components/dialogs/ConfirmDialog";
import AddButton from "../../../components/buttons/AddButton/AddButton";
import InviteUserModal from "../../../components/dialogs/InviteUserModal";
import RadixSelect from "../../../components/inputs/RadixSelect"; // ← новый простой select

import { useNavigate } from "react-router-dom";
import useGridPrefs from "../../../hooks/useGridPrefs";

import {
  useInviteUserMutation,
  useRemoveUserMutation,
  useUpdateUserRoleMutation,
  useResendInvitationMutation,
  useRevokeInvitationMutation,
} from "../../../store/rtk/companyUsersApi";

const ROLE_OPTIONS = [
  { value: "owner",   label: "Владелец" },
  { value: "admin",   label: "Админ" },
  { value: "manager", label: "Менеджер" },
  { value: "user",    label: "Наблюдатель" },
];

const MEMBER_STATUS_OPTIONS = [
  { value: "active",    label: "Активен" },
  { value: "suspended", label: "Заблокирован" },
];

function roleOptions() {
  return [
    { value:"",        label:"Все роли" },
    { value:"owner",   label:"Владелец" },
    { value:"admin",   label:"Админ" },
    { value:"manager", label:"Менеджер" },
    { value:"user",    label:"Наблюдатель" },
  ];
}

function statusOptionsByMode(mode) {
  if (mode === "invites") {
    return [
      { value:"",         label:"Любой статус" },
      { value:"pending",  label:"Ожидает" },
      { value:"accepted", label:"Акцептовано" },
      { value:"revoked",  label:"Отозвано" },
      { value:"expired",  label:"Истёк срок" },
    ];
  }
  return [
    { value:"",          label:"Любой статус" },
    { value:"active",    label:"Активен" },
    { value:"suspended", label:"Заблокирован" },
  ];
}

function Avatar({ name = "", email = "", url = "" }) {
  const initials =
    (name || email || "U")
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0]?.toUpperCase()).join("") || "U";

  return (
    <span className={s.avatarWrap}>
      {url ? (
        <img
          className={s.avatarImg}
          src={url}
          alt=""
          onError={(e)=>{ e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'grid'; }}
        />
      ) : null}
      <span className={s.avatar} style={{ display: url ? 'none' : 'grid' }}>{initials}</span>
    </span>
  );
}

export default function CompanyUsers() {
  const [mode, setMode] = useState("members"); // 'members' | 'invites'
  const listRef = useRef(null);
  const navigate = useNavigate();

  const { colWidths, colOrder, onColumnResize, onColumnOrderChange } =
    useGridPrefs("companyUsers", { mode });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // {title, text, onYes}

  // RTK mutations
  const [inviteUser]       = useInviteUserMutation();
  const [removeUser]       = useRemoveUserMutation();
  const [updateUserRole]   = useUpdateUserRoleMutation();
  const [resendInvitation] = useResendInvitationMutation();
  const [revokeInvitation] = useRevokeInvitationMutation();

  const columns = useMemo(() => {
    if (mode === "members") {
      return [
        {
          key: "user",
          title: "Пользователь",
          sortable: true,
          render: (row) => (
            <div className={s.userCell}
              onClick={() => navigate(`/main/users/${row.userId}`)}
              style={{ cursor: "pointer" }}
            >
              <Avatar
                name={`${row.firstName || ""} ${row.lastName || ""}`}
                email={row.email}
                url={row.avatarUrl}
              />
              <div className={s.uCol}>
                <div className={s.name}>
                  {(row.firstName || row.lastName)
                    ? `${row.firstName || ""} ${row.lastName || ""}`.trim()
                    : "—"}
                </div>
                <div className={s.muted}>{row.email}</div>
              </div>
            </div>
          ),
        },
        {
          key: "role",
          title: "Роль",
          render: (row) => (
            <RadixSelect
              className={s.select}
              value={row.role}
              options={ROLE_OPTIONS}
              placeholder="Роль"
              onChange={async (role) => {
                await updateUserRole({ userId: row.userId, role }).unwrap();
                listRef.current?.refetch?.();
              }}
            />
          ),
        },
        {
          key: "status",
          title: "Статус",
          render: (row) => (
            <RadixSelect
              className={s.select}
              value={row.status || "active"}
              options={MEMBER_STATUS_OPTIONS}
              placeholder="Статус"
              onChange={async (status) => {
                await updateUserRole({ userId: row.userId, role: row.role, status }).unwrap().catch(()=>{});
                listRef.current?.refetch?.();
              }}
            />
          ),
        },
        {
          key: "isLead",
          title: "Лидер отдела",
          render: (row) => (
            <span className={row.isLead ? s.yes : s.no}>
              {row.isLead ? "Да" : "Нет"}
            </span>
          ),
        },
        {
          key: "lastLoginAt",
          title: "Последний вход",
          render: (row) =>
            row.lastLoginAt
              ? new Date(row.lastLoginAt).toLocaleString("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : "—",
        },
        {
          key: "createdAt",
          title: "Добавлен",
          render: (row) =>
            row.createdAt
              ? new Date(row.createdAt).toLocaleDateString("ru-RU")
              : "—",
        },
        {
          key: "actions",
          title: "Действия",
          sortable: false,
          render: (row) => (
            <button
              className={s.linkDanger}
              onClick={() =>
                setConfirm({
                  title: "Удаление участника",
                  text: `Удалить пользователя ${row.email} из компании?`,
                  onYes: async () => {
                    await removeUser(row.userId).unwrap();
                    setConfirm(null);
                    listRef.current?.refetch?.();
                  },
                })
              }
            >
              Удалить
            </button>
          ),
        },
      ];
    }

    // === INVITES ===
    return [
      {
        key: "person",
        title: "Имя",
        render: (row) =>
          [row.firstName, row.lastName].filter(Boolean).join(" ") || "—",
      },
      { 
        key: "email", 
        title: "E-mail",
        render: (row) => row.email || "—",
      },
      {
        key: "role",
        title: "Роль",
        render: (row) =>
          ROLE_OPTIONS.find((r) => r.value === row.role)?.label || row.role,
      },
      { key: "status", title: "Статус" },
      {
        key: "actions",
        title: "Действие",
        sortable: false,
        render: (row) => {
          if (row.status !== "pending") {
            return <span className={s.muted}>—</span>;
          }
          return (
            <div className={s.rowActions}>
              <button
                className={s.link}
                onClick={async () => {
                  await resendInvitation(row.id).unwrap();
                  alert("Письмо повторно отправлено");
                }}
              >
                Отправить ещё раз
              </button>
              <span className={s.sep}>·</span>
              <button
                className={s.linkDanger}
                onClick={() =>
                  setConfirm({
                    title: "Отзыв приглашения",
                    text: `Отозвать приглашение для ${row.email}?`,
                    onYes: async () => {
                      await revokeInvitation(row.id).unwrap();
                      setConfirm(null);
                      listRef.current?.refetch?.();
                    },
                  })
                }
              >
                Отозвать
              </button>
            </div>
          );
        },
      },
    ];
  }, [mode, navigate, updateUserRole, removeUser, resendInvitation, revokeInvitation]);

  const actions = (
    <div className={s.actions}>
      {mode === "members" && (
        <AddButton onClick={() => setInviteOpen(true)}>
          Пригласить пользователя
        </AddButton>
      )}
    </div>
  );

  // Источник для ListPage:
  const source = mode === 'members' ? 'companyUsers' : 'companyInvites';

  return (
    <div className={s.wrap}>
      <ListPage
        ref={listRef}
        source={source}
        title={mode === "members" ? "Пользователи" : "Приглашения"}
        defaultQuery={{ sort: "createdAt", dir: "DESC", limit: 25 }}

        columns={columns}
        actions={actions}

        ToolbarComponent={(props) => (
          <FilterToolbar
            {...props}
            mode={mode}
            onModeChange={(nextMode) => {
              setMode(nextMode);
              props.onChange((q) => ({
                ...q,
                page: 1,
                role: undefined,
                status: undefined,
              }));
              setTimeout(() => listRef.current?.refetch?.(), 0);
            }}
            controls={[
              {
                type: "mode",
                key: "mode",
                options: [
                  { value: "members", label: "Участники" },
                  { value: "invites", label: "Приглашения" },
                ],
              },
              {
                type: "search",
                key: "search",
                placeholder: (m) =>
                  m === "invites"
                    ? "Поиск по e-mail получателя"
                    : "Поиск по имени / e-mail",
                debounce: 350,
              },
              { type: "select", key: "role", options: roleOptions },
              { type: "select", key: "status", options: statusOptionsByMode },
            ]}
          />
        )}

        columnWidths={colWidths}
        onColumnResize={onColumnResize}
        columnOrder={colOrder}
        onColumnOrderChange={onColumnOrderChange}
      />

      {inviteOpen && (
        <InviteUserModal
          roles={ROLE_OPTIONS}
          onSubmit={async (payload) => {
            await inviteUser(payload).unwrap();
            setInviteOpen(false);
            setMode("invites");
            setTimeout(() => listRef.current?.refetch?.(), 0);
          }}
          onClose={() => setInviteOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        text={confirm?.text}
        onOk={confirm?.onYes}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}