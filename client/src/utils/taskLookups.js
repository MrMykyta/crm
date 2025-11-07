// taskLookups.js


export function getCompanyMembersOptions() {
  try {
    const raw = localStorage.getItem('companyMembers');
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(m => {
      const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || m.userId || m.id;
      const value = m.userId || m.id;
      return { value, label };
    });
  } catch { return []; }
}

export function getCompanyDepartmentsOptions() {
  try {
    const raw = localStorage.getItem('companyDepartments');
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.map(d => ({ value: d.id, label: d.name || d.title || d.id }));
  } catch { return []; }
}

export function buildTaskLookups() {
  return {
    userOptions: getCompanyMembersOptions(),
    departmentOptions: getCompanyDepartmentsOptions(),
    contactOptions: [],
    counterpartyOptions: [],
    dealOptions: [],
    categoryOptions: undefined,
  };
}