// hooks/useBrandAndBackground.js
import { useEffect, useRef } from "react";
import { getCompanyById } from "../api/company";
import { getMe } from "../api/user"; // нужен лёгкий /me

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

  // helper — загрузить картинку и выставить css var + событие
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

      // приоритет: явный initialAvatarUrl → companyId.fetch
      if (initialAvatarUrl) {
        await ensureImage(initialAvatarUrl, "--company-avatar-url", "company:avatar-ready", companyAvatarImgRef);
        return;
      }
      if (companyId) {
        try {
          const c = await getCompanyById(companyId);
          if (!stopped && c?.avatarUrl) {
            await ensureImage(c.avatarUrl, "--company-avatar-url", "company:avatar-ready", companyAvatarImgRef);
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

  // ---------- Аватар пользователя (НОВОЕ) ----------
  useEffect(() => {
    let stopped = false;
    (async () => {
      if (stopped) return;

      // 1) берём из пропса, если передали
      if (initialUserAvatarUrl) {
        await ensureImage(initialUserAvatarUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
        return;
      }

      // 2) попробуем из localStorage (быстро и без сети)
      try {
        const raw = localStorage.getItem("user");
        const u = raw ? JSON.parse(raw) : null;
        const lsUrl = u?.avatarUrl || u?.avatar || null;
        if (lsUrl) {
          const ok = await ensureImage(lsUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
          if (ok) return;
        }
      } catch {}

      // 3) как fallback — лёгкий запрос /me
      try {
        const me = await getMe().catch(() => null);
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