// src/pages/user/UserEntityPage/index.jsx
import { useEffect, useState } from "react";
import EntityDetailPage from "../../_scaffold/EntityDetailPage";
import { userSchema, toFormUser, toApiUser } from "../../../schemas/user.schema";
import UserAvatarHeader from "../../../components/user/UserAvatarHeader";
import UserDetailTabs from "../UserDetailPage";

// предполагаю, что у тебя есть такие API:
import { getMe, updateMe } from "../../../api/user"; // если другие — замени

export default function UserEntityPage() {
  const [base, setBase] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await getMe();
      setBase(me);
    })().catch(console.error);
  }, []);

  if (!base) return null;

  const load = async () => base;

  const save = async (_id, payload) => {
    const saved = await updateMe(payload); // сервер вернёт свежий user
    setBase(saved);
    return saved;
  };

  return (
    <EntityDetailPage
    id={"me"}
    tabs={[
      { key: "security", label: "Безопасность" },
      { key: "appearance", label: "Внешний вид" },
      { key: "notifications", label: "Уведомления" },
      { key: "preferences", label: "Предпочтения" },
      
    ]}
    schemaBuilder={userSchema}
    toForm={toFormUser}
    toApi={toApiUser}
    load={load}
    save={save}
    storageKeyPrefix="user"
    autosave={{ debounceMs: 500 }}
    clearDraftOnUnmount
    leftTop={({ values, onChange }) => (
      <UserAvatarHeader values={values} onChange={onChange} />
    )}
    // 👇 вот это главное
    RightTabsComponent={UserDetailTabs}
  />
  );
}