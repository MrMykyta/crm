import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useGetCompanyBrandQuery } from "../store/rtk/companyApi";
import { useGetMeQuery } from "../store/rtk/userApi";
import { useSignedFileUrl } from "./useSignedFileUrl";

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
  const rawCompanyAvatar =
    initialAvatarUrl || company?.avatarUrl || company?.data?.avatarUrl || null;
  const { url: companyAvatarUrl, onError: onCompanyAvatarError } = useSignedFileUrl(rawCompanyAvatar);

  const { url: safeBgUrl, onError: onBgError } = useSignedFileUrl(bgUrl);

  const rawUserAvatar =
    me?.avatarUrl ||
    me?.avatar ||
    me?.data?.avatarUrl ||
    me?.data?.avatar ||
    initialUserAvatarUrl ||
    null;

  const { url: userAvatarUrl, onError: onUserAvatarError } = useSignedFileUrl(rawUserAvatar);

  // ---------- Фон ----------
  useEffect(() => {
    const root = document.documentElement;
    if (!safeBgUrl) { root.style.removeProperty("--custom-bg-layer"); return; }

    const img = new Image();
    bgImgRef.current = img;
    img.crossOrigin = "anonymous";
    img.onload = () => root.style.setProperty("--custom-bg-layer", `url("${safeBgUrl}")`);
    img.onerror = () => { onBgError(); root.style.removeProperty("--custom-bg-layer"); };
    img.src = safeBgUrl;

    return () => {
      if (bgImgRef.current === img) bgImgRef.current = null;
      root.style.removeProperty("--custom-bg-layer");
    };
  }, [safeBgUrl]);

  const ensureImage = (url, cssVar, eventName, refHolder, onErr) =>
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
      img.onerror = () => { if (onErr) onErr(); root.style.removeProperty(cssVar); resolve(false); };
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
          companyAvatarImgRef,
          onCompanyAvatarError
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

      if (userAvatarUrl) {
        await ensureImage(userAvatarUrl, "--user-avatar-url", "user:avatar-ready", userAvatarImgRef, onUserAvatarError);
      }
    })();

    return () => {
      stopped = true;
      document.documentElement.style.removeProperty("--user-avatar-url");
      userAvatarImgRef.current = null;
    };
  }, [userAvatarUrl, onUserAvatarError]);
}
