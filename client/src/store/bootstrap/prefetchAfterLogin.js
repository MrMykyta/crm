// Вызываем сразу после успешного логина/refresh/restore.
import { userApi } from '../rtk/userApi';
import { counterpartyApi } from '../rtk/counterpartyApi';
import { tasksApi } from '../rtk/tasksApi';
import { companyUsersApi } from '../rtk/companyUsersApi';

export function prefetchAfterLogin(store) {
  const dispatch = store.dispatch;

  // профиль и prefs
  dispatch(userApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }));
  dispatch(userApi.endpoints.getMyPreferences.initiate(undefined, { forceRefetch: true }));

  // первые страницы ключевых списков
  const baseQuery = { page: 1, limit: 25, sort: 'createdAt', dir: 'DESC' };

  dispatch(counterpartyApi.endpoints.listCounterparties.initiate({ page: 1, limit: 25, sort: 'shortName', dir: 'DESC' }, { forceRefetch: true }));
  dispatch(tasksApi.endpoints.listTasks.initiate(baseQuery, { forceRefetch: true }));
  dispatch(
    companyUsersApi.endpoints.listCompanyUsers.initiate(
      { ...baseQuery, sort: 'lastName', dir: 'ASC' },
      { forceRefetch: true }
    )
  );

  // при необходимости можно прогреть ещё что-то (lookup-и, справочники и т.д.)
}