import { useEffect, useRef } from "react";

/**
 * Без axios и без RTK-хуков: берём токен/компанию из window.__AUTH_TOKEN__/__COMPANY_ID__,
 * которые устанавливаются в setApiSession(). Делаем fetch напрямую.
 */
export default function useBrandAndBackground(
  bgUrl,
  { companyId, initialAvatarUrl, initialUserAvatarUrl } = {}
) {
  const bgImgRef = useRef(null);
  const companyAvatarImgRef = useRef(null);
  const userAvatarImgRef = useRef(null);

  // ---------- Фон ----------
  useEffect(() => {
    const root = document.documentElement;
    if (!bgUrl) { root.style.removeProperty("--custom-bg-layer"); return; }

    const img = new Image();
    bgImgRef.current = img;
    img.crossOrigin = "anonymous";
    img.onload = () => root.style.setProperty("--custom-bg-layer", `url("${bgUrl}")`);
    img.onerror = () => root.style.removeProperty("--custom-bg-layer");
    img.src = bgUrl;

    return () => {
      if (bgImgRef.current === img) bgImgRef.current = null;
      root.style.removeProperty("--custom-bg-layer");
    };
  }, [bgUrl]);

  const ensureImage = (url, cssVar, eventName, refHolder) =>
    new Promise((resolve) => {
      if (!url) return resolve(false);
      const root = document.documentElement;
      const img = new Image();
      refHolder.current = img;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        root.style.setProperty(cssVar, `url("${url}")`);
        if (eventName) window.dispatchEvent(new CustomEvent(eventName, { detail: { url } }));
        resolve(true);
      };
      img.onerror = () => { root.style.removeProperty(cssVar); resolve(false); };
      img.src = url;
    });

  // ---------- Аватар компании ----------
  useEffect(() => {
    let stopped = false;
    (async () => {
      if (stopped) return;

      if (initialAvatarUrl) {
        await ensureImage(initialAvatarUrl, "--company-avatar-url", "company:avatar-ready", companyAvatarImgRef);
        return;
      }
      const cid = companyId || window.__COMPANY_ID__;
      const token = window.__AUTH_TOKEN__;
      if (cid && token) {
        try {
          const res = await fetch(
            `${(process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001')}/api/companies/${encodeURIComponent(cid)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const c = await res.json().catch(() => null);
          const url = c?.avatarUrl || c?.data?.avatarUrl;
          if (!stopped && url) {
            await ensureImage(url, "--company-avatar-url", "company:avatar-ready", companyAvatarImgRef);
          }
        } catch {}
      }
    })();

    return () => {
      stopped = true;
      document.documentElement.style.removeProperty("--company-avatar-url");
      companyAvatarImgRef.current = null;
    };
  }, [companyId, initialAvatarUrl]);

  // ---------- Аватар пользователя ----------
  useEffect(() => {
    let stopped = false;
    (async () => {
      if (stopped) return;

      if (initialUserAvatarUrl) {
        await ensureImage(initialUserAvatarUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
        return;
      }
      try {
        const raw = localStorage.getItem("user");
        const u = raw ? JSON.parse(raw) : null;
        const lsUrl = u?.avatarUrl || u?.avatar || null;
        if (lsUrl) {
          const ok = await ensureImage(lsUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
          if (ok) return;
        }
      } catch {}

      // Лёгкий /me при наличии токена
      try {
        const token = window.__AUTH_TOKEN__;
        if (!token) return;
        const res = await fetch(
          `${(process.env.REACT_APP_API_URL?.replace(/\/+$/, '') || 'http://localhost:5001')}/api/users/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const me = await res.json().catch(() => null);
        const apiUrl = me?.avatarUrl || me?.avatar || null;
        if (apiUrl) {
          await ensureImage(apiUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
        }
      } catch {}
    })();

    return () => {
      stopped = true;
      document.documentElement.style.removeProperty("--user-avatar-url");
      userAvatarImgRef.current = null;
    };
  }, [initialUserAvatarUrl]);
}