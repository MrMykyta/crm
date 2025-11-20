import { useParams } from 'react-router-dom';
import EntityDetailPage from '../../_scaffold/EntityDetailPage';
import { userSchema, toFormUser, toApiUser } from '../../../schemas/user.schema';
import UserAvatarHeader from '../../../components/user/UserAvatarHeader';
import UserAccessPanel from '../../../components/user/UserAccessPanel';
import {
  useGetCompanyUserQuery,
  useUpdateCompanyUserMutation,
} from '../../../store/rtk/companyUsersApi';

export default function UserEntityPage() {
  const { userId } = useParams();

  const { data: base, isFetching, error } = useGetCompanyUserQuery(userId, { skip: !userId });
  const [updateUser, { isLoading: saving }] = useUpdateCompanyUserMutation();

  if (!userId) return <div style={{ padding:16, color:'var(--danger)' }}>userId отсутствует в URL</div>;
  if (error)   return <div style={{ padding:16, color:'var(--danger)' }}>Не удалось загрузить пользователя</div>;
  if (isFetching || !base) return null;

  const load = async () => base;
  const save = async (_id, payload) => {
    const saved = await updateUser({ userId, body: payload }).unwrap();
    return saved;
  };

  return (
    <EntityDetailPage
      id={userId}
      tabs={[ { key:'access', label:'Права доступа' } ]}
      tabsNamespace="admin.user.detail"
      schemaBuilder={userSchema}
      toForm={toFormUser}
      toApi={toApiUser}
      load={load}
      save={save}
      isSaving={saving}
      storageKeyPrefix="user"
      autosave={{ debounceMs: 500 }}
      clearDraftOnUnmount
      leftTop={({ values, onChange }) => (
        <UserAvatarHeader values={values} onChange={onChange} />
      )}
      RightTabsComponent={({ tab }) =>
        tab === 'access' ? <UserAccessPanel userId={userId} /> : null
      }
    />
  );
}