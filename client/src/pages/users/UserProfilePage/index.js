// src/pages/users/UserProfilePage/index.jsx
import { useMemo } from "react";
import EntityDetailPage from "../../_scaffold/EntityDetailPage";
import { userSchema, toFormUser, toApiUser } from "../../../schemas/user.schema";
import UserAvatarHeader from "../../../components/user/UserAvatarHeader";
import UserDetailTabs from "../UserDetailTabs";
import { useGetMeQuery, useUpdateMeMutation } from "../../../store/rtk/userApi";

export default function UserProfilePage() {
  const { data: me, isFetching } = useGetMeQuery();
  const [updateMe, { isLoading: saving }] = useUpdateMeMutation();

  // вкладки справа — хук должен вызываться до любых ранних return
  const tabs = useMemo(
    () => [
      { key: "security",      label: "Безопасность" },
      { key: "appearance",    label: "Внешний вид" },
      { key: "notifications", label: "Уведомления" },
      { key: "preferences",   label: "Предпочтения" },
    ],
    []
  );

  const base = me || null;
  const load = async () => base;

  const save = async (_id, payload) => {
    const body = toApiUser(payload);
    const saved = await updateMe(body).unwrap();
    return saved;
  };

  // ранние возвраты — ТОЛЬКО после всех хуков
  if (!base && isFetching) return null;
  if (!base) return null;

  return (
    <EntityDetailPage
      id="me"
      tabs={tabs}
      schemaBuilder={userSchema}
      toForm={toFormUser}
      toApi={toApiUser}
      load={load}
      save={save}
      storageKeyPrefix="user"
      autosave={{ debounceMs: 500 }}
      clearDraftOnUnmount
      isSaving={saving}
      leftTop={({ values, onChange }) => (
        <UserAvatarHeader values={values} onChange={onChange} />
      )}
      RightTabsComponent={UserDetailTabs}
    />
  );
}