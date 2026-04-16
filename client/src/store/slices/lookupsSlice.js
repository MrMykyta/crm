import { createSlice, createEntityAdapter } from '@reduxjs/toolkit';
import { crmApi } from '../rtk/crmApi';

// mkAdapter: вспомогательная логика модуля.
const mkAdapter = () => createEntityAdapter({ // selectId : select id.
// selectId: вспомогательная логика модуля.
selectId: (e) => e.id || e.userId });

const membersAdapter = mkAdapter();
const departmentsAdapter = mkAdapter();
const contactsAdapter = mkAdapter();
const counterpartiesAdapter = mkAdapter();
const dealsAdapter = mkAdapter();

const initialState = {
  members: membersAdapter.getInitialState({ updatedAt: 0 }),
  departments: departmentsAdapter.getInitialState({ updatedAt: 0 }),
  contacts: contactsAdapter.getInitialState({ updatedAt: 0 }),
  counterparties: counterpartiesAdapter.getInitialState({ updatedAt: 0 }),
  deals: dealsAdapter.getInitialState({ updatedAt: 0 }),
  version: 1,
};

const lookupsSlice = createSlice({
  name: 'lookups',
  initialState,
  reducers: {
        // hydrateFromCache: вспомогательная логика модуля.
hydrateFromCache(state, { payload }) {
      return { ...state, ...payload };
    },
        // clearLookups: вспомогательная логика модуля.
clearLookups() {
      return initialState;
    },
  },
    // extraReducers: вспомогательная логика модуля.
extraReducers: (builder) => {
        // upsert: вспомогательная логика модуля.
const upsert = (adapter, key) =>
      builder.addMatcher(
        (a) => a.type === crmApi.endpoints[`get${key}`]?.matchFulfilled?.type,
        (state, { payload }) => {
          adapter.setAll(state[key.toLowerCase()], payload?.data ?? payload ?? []);
          state[key.toLowerCase()].updatedAt = Date.now();
        }
      );

    upsert(membersAdapter, 'CompanyMembers');
    upsert(departmentsAdapter, 'Departments');
    upsert(contactsAdapter, 'Contacts');
    upsert(counterpartiesAdapter, 'Counterparties');
    upsert(dealsAdapter, 'Deals');
  },
});

export const { hydrateFromCache, clearLookups } = lookupsSlice.actions;
export default lookupsSlice.reducer;

export const membersSelectors = membersAdapter.getSelectors((s) => s.lookups.members);
export const departmentsSelectors = departmentsAdapter.getSelectors((s) => s.lookups.departments);
export const contactsSelectors = contactsAdapter.getSelectors((s) => s.lookups.contacts);
export const counterpartiesSelectors = counterpartiesAdapter.getSelectors((s) => s.lookups.counterparties);
export const dealsSelectors = dealsAdapter.getSelectors((s) => s.lookups.deals);

export // selectMemberOptions : select member options.
// selectMemberOptions: вспомогательная логика модуля.
const selectMemberOptions = (state) =>
  membersSelectors.selectAll(state).map((m) => ({
    value: m.userId || m.id,
    label: m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || '—',
  }));
