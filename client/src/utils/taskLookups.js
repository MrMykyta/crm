// taskLookups.js

export function getCompanyMembersOptions(members = []) {
  const arr = Array.isArray(members) ? members : [];
  return arr.map(m => {
    const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.userId || m.id;
    const value = m.userId || m.id;
    return { value, label };
  });
}

export function getCompanyDepartmentsOptions(departments = []) {
  const arr = Array.isArray(departments) ? departments : [];
  return arr.map(d => ({ value: d.id, label: d.name || d.title || d.id }));
}

export function buildTaskLookups({ members = [], departments = [] } = {}) {
  return {
    userOptions: getCompanyMembersOptions(members),
    departmentOptions: getCompanyDepartmentsOptions(departments),
    contactOptions: [],
    counterpartyOptions: [],
    dealOptions: [],
    categoryOptions: undefined,
  };
}
