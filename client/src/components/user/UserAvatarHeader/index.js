// src/components/users/UserAvatarHeader/index.jsx
import { useSelector, useDispatch } from "react-redux";
import AvatarEditable from "../../media/AvatarEditable";
import { useUploadFileMutation } from "../../../store/rtk/filesApi";
import { applyUserPatch } from "../../../store/slices/authSlice"; // <-- ДОБАВИЛИ
import styles from "./UserAvatarHeader.module.css";

export default function UserAvatarHeader({ values, onChange }) {
  const dispatch  = useDispatch();
  const userId    = useSelector((s) => s.auth?.currentUser?.id);
  const [uploadFile]    = useUploadFileMutation();

  const fullName =
    [values?.firstName, values?.lastName].filter(Boolean).join(" ") || "User";

  const uploader = async (file) => {
    if (!userId) throw new Error("Не найден userId (auth.currentUser.id)");
    const res = await uploadFile({
      ownerType: "user",
      ownerId: userId,
      file,
      purpose: "avatar",
      visibility: "private",
    }).unwrap();

    const fileId = res?.data?.id || res?.id || null;
    const ref = fileId || res?.data?.url || res?.url || res?.path || "";
    // 1) обновим форму (EntityDetailPage)
    onChange?.("avatarUrl", ref);
    // 2) и сразу пропихнём в Redux, чтобы меню/хедер обновились без cmd+r
    dispatch(applyUserPatch({ avatarUrl: ref })); // patchUser внутри поднимет avatarRev
    return fileId ? { id: fileId } : { url: ref };
  };

  const urlUploader = async (url) => {
    if (!url) return { url: "" };
    onChange?.("avatarUrl", url);
    dispatch(applyUserPatch({ avatarUrl: url }));
    return { url };
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
