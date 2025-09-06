import httpClient from './index';

export const getCompanyById = async (id) => {
  const {data} = await httpClient.get(`companies/${id}`);
  return data; // ожидаем { id, name, shortName, vat, domain, logoUrl, ... }
}