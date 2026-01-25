import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useGetCompanyBrandQuery } from "../store/rtk/companyApi";
import { useGetMeQuery } from "../store/rtk/userApi";

/**
 * Данные берём через RTK Query (store).
 */
export default function useBrandAndBackground(
  bgUrl,
  { initialAvatarUrl, initialUserAvatarUrl } = {}
) {
  const bgImgRef = useRef(null);
  const companyAvatarImgRef = useRef(null);
  const userAvatarImgRef = useRef(null);
  const companyId = useSelector((s) => s.auth?.companyId);
  const accessToken = useSelector((s) => s.auth?.accessToken);

  const { data: company } = useGetCompanyBrandQuery(companyId, {
    skip: !companyId || !!initialAvatarUrl,
  });
  const { data: me } = useGetMeQuery(undefined, {
    skip: !accessToken || !!initialUserAvatarUrl,
  });
  const companyAvatarUrl =
    initialAvatarUrl || company?.avatarUrl || company?.data?.avatarUrl || null;

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

      if (companyAvatarUrl) {
        await ensureImage(
          companyAvatarUrl,
          "--company-avatar-url",
          "company:avatar-ready",
          companyAvatarImgRef
        );
      }
    })();

    return () => {
      stopped = true;
      document.documentElement.style.removeProperty("--company-avatar-url");
      companyAvatarImgRef.current = null;
    };
  }, [companyAvatarUrl]);

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

      const apiUrl =
        me?.avatarUrl ||
        me?.avatar ||
        me?.data?.avatarUrl ||
        me?.data?.avatar ||
        null;
      if (apiUrl) {
        await ensureImage(apiUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef);
      }
    })();

    return () => {
      stopped = true;
      document.documentElement.style.removeProperty("--user-avatar-url");
      userAvatarImgRef.current = null;
    };
  }, [initialUserAvatarUrl, me]);
}
