// src/components/users/UserAvatarHeader/index.jsx
import { useSelector, useDispatch } from "react-redux";
import AvatarEditable from "../../media/AvatarEditable";
import { useUploadFileMutation, useAttachFromUrlMutation } from "../../../store/rtk/uploadApi";
import { applyUserPatch } from "../../../store/slices/authSlice"; // <-- ДОБАВИЛИ
import styles from "./UserAvatarHeader.module.css";

export default function UserAvatarHeader({ values, onChange }) {
  const dispatch  = useDispatch();
  const userId    = useSelector((s) => s.auth?.currentUser?.id);
  const companyId = useSelector((s) => s.auth?.companyId);

  const [uploadFile]    = useUploadFileMutation();
  const [attachFromUrl] = useAttachFromUrlMutation();

  const fullName =
    [values?.firstName, values?.lastName].filter(Boolean).join(" ") || "User";

  const uploader = async (file) => {
    if (!userId) throw new Error("Не найден userId (auth.currentUser.id)");
    const res = await uploadFile({
      ownerType: "users",
      ownerId: userId,
      file,
      purpose: "avatar",
      companyId,
      uploadedBy: userId,
    }).unwrap();

    const url = res?.url || res?.data?.url || res?.path || "";
    // 1) обновим форму (EntityDetailPage)
    onChange?.("avatarUrl", url);
    // 2) и сразу пропихнём в Redux, чтобы меню/хедер обновились без cmd+r
    dispatch(applyUserPatch({ avatarUrl: url })); // patchUser внутри поднимет avatarRev
    return { url };
  };

  const urlUploader = async (url) => {
    if (!userId) throw new Error("Не найден userId (auth.currentUser.id)");
    const res = await attachFromUrl({
      ownerType: "users",
      ownerId: userId,
      remoteUrl: url,
      purpose: "avatar",
      companyId,
      uploadedBy: userId,
    }).unwrap();

    const out = res?.url || res?.data?.url || res?.path || "";
    onChange?.("avatarUrl", out);
    dispatch(applyUserPatch({ avatarUrl: out })); // то же самое для URL
    return { url: out };
  };

  return (
    <div className={styles.headerCard}>
      <div className={styles.avatarCol}>
        <AvatarEditable
          value={values?.avatarUrl || ""}
          onChange={(url) => {
            // если кто-то вручную меняет value — тоже синхронизируем Redux
            onChange?.("avatarUrl", url);
            if (url) dispatch(applyUserPatch({ avatarUrl: url }));
          }}
          label="Изменить"
          size={96}
          uploader={uploader}
          urlUploader={urlUploader}
        />
      </div>

      <div className={styles.titleBlock}>
        <div className={styles.title}>{fullName}</div>
        {values?.email && <div className={styles.subtitle}>{values.email}</div>}
      </div>
    </div>
  );
}