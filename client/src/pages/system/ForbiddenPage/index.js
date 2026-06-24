import { useTranslation } from "react-i18next";

export default function ForbiddenPage({ requiredPermission }) {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--border, #d8dee9) 80%, transparent)",
          borderRadius: 8,
          padding: 24,
          background: "var(--card-bg, #fff)",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, letterSpacing: 0 }}>
          403
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 24 }}>
          {t("common.accessDenied", "Access denied")}
        </h1>
        <p style={{ margin: 0, color: "var(--muted, #64748b)" }}>
          {t("acl.noPermission", "You do not have permission to access this page.")}
        </p>
        {requiredPermission ? (
          <p style={{ margin: "12px 0 0", color: "var(--muted, #64748b)", fontSize: 13 }}>
            {t("acl.requiredPermission", "Required permission: {{permission}}", {
              permission: requiredPermission,
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
