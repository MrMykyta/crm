import { apiBase } from "../config/api";

function buildHeaders() {
  const headers = {};
  const token = typeof window !== "undefined" ? window.__AUTH_TOKEN__ : null;
  const companyId = typeof window !== "undefined" ? window.__COMPANY_ID__ : null;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (companyId) {
    headers["X-Company-Id"] = String(companyId);
  }

  return headers;
}

export const deleteTemplate = async (templateId) => {
  const normalizedTemplateId = String(templateId || "").trim();
  if (!normalizedTemplateId) {
    throw new Error("templateId is required");
  }

  const response = await fetch(
    `${apiBase}/documents/templates/${encodeURIComponent(normalizedTemplateId)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: buildHeaders(),
    }
  );

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(
      payload?.message || payload?.error || "Failed to delete template."
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

