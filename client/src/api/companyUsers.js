// src/api/companyUsers.js
import httpClient, { getCompanyId } from './index';

/* =========================
 * MEMBERS (участники компании)
 * base router: /members
 * ========================= */

// Список участников компании
// GET /members/:companyId/users
export const getMembers = async () => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.get(`/members/${companyId}/users`);
  return data; // ожидается { items: [...], total?: number } или просто массив
};

// Добавить пользователя в компанию (если у тебя сценарий “присоединить существующего”)
// POST /members/:companyId/users
export const addMember = async (payload /* { userId, role } */) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.post(`/members/${companyId}/users`, payload);
  return data;
};

// Обновить участника (роль/статус)
// PUT /members/:companyId/users/:userId
export const updateMember = async (userId, patch /* { role?, status? } */) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.put(`/members/${companyId}/users/${userId}`, patch);
  return data;
};

// Удалить пользователя из компании
// DELETE /members/:companyId/users/:userId
export const removeMember = async (userId) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.delete(`/members/${companyId}/users/${userId}`);
  return data;
};


/* =========================
 * INVITATIONS (приглашения)
 * base router: /invitations
 * ========================= */

// Создать приглашение
// POST /invitations/companies/:companyId/invitations
export const inviteMember = async (payload /* { email, firstName?, lastName?, role } */) => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const companyName = localStorage.getItem('companyName');
  payload.companyName = companyName;
  const { data } = await httpClient.post(
    `/invitations/companies/${companyId}/invitations`,
    payload
  );
  return data;
};

// Список приглашений компании
// GET /invitations/companies/:companyId/invitations
export const listInvitations = async () => {
  const companyId = getCompanyId();
  if (!companyId) throw new Error('No companyId in localStorage');
  const { data } = await httpClient.get(`/invitations/companies/${companyId}/invitations`);
  return data; // ожидается { items: [...] } или массив
};

// Повторно отправить письмо
// POST /invitations/invitations/:id/resend
export const resendInvitation = async (invitationId) => {
  const { data } = await httpClient.post(`/invitations/${invitationId}/resend`);
  return data;
};

// Отозвать приглашение
// POST /invitations/invitations/:id/revoke
export const revokeInvitation = async (invitationId) => {
  const { data } = await httpClient.post(`/invitations/${invitationId}/revoke`);
  return data;
};

// Акцепт приглашения (публичная точка — без companyId; токен в payload)
// POST /invitations/invitations/accept
export const acceptInvitation = async (payload /* { token, password, firstName?, lastName? } */) => {
  const { data } = await httpClient.post(`/invitations/accept`, payload);
  return data;
};

export async function checkInvitationByToken(token) {
  const { data } = await httpClient.get(`/invitations/check`, { params: { token } });
  // ожидаемый ответ бэка:
  // { status:'pending'|'accepted'|'revoked'|'expired', firstName?, lastName?, email? }
  return data;
}


/* =========================
 * Комбинированный загрузчик (optional)
 * подтягивает и участников, и инвайты
 * ========================= */
export const getMembersWithInvites = async () => {
  const [membersRes, invitesRes] = await Promise.all([getMembers(), listInvitations()]);
  const members = membersRes?.items ?? membersRes ?? [];
  const invites  = invitesRes?.items ?? invitesRes ?? [];
  return {
    members,
    invitations: invites
  };
};



