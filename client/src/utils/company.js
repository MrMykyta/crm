// src/utils/company.js
export function getActiveCompanyId(){
  return localStorage.getItem('companyId') || null;
}