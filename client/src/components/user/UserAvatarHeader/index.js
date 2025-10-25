import AvatarEditable from "../../media/AvatarEditable";
import { uploadFile, attachFromUrl } from "../../../api/uploads";
import styles from "./UserAvatarHeader.module.css";

const getUserId = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.id || null;
  } catch {
    return null;
  }
};

const getCompanyId = () => {
  try {
    return localStorage.getItem("companyId") || null;
  } catch {
    return null;
  }
};

export default function UserAvatarHeader({ values, onChange }) {
  const fullName =
    [values?.firstName, values?.lastName].filter(Boolean).join(" ") || "User";

  /** локальные адаптеры под AvatarEditable **/
  const uploader = async (file) => {
    const userId = getUserId();
    const companyId = getCompanyId();
    if (!userId) throw new Error("Не найден userId в localStorage");

    // сервер сам создаст Attachment и пропишет users.avatar_url
    return uploadFile("users", userId, file, {
      purpose: "avatar",
      companyId,
    });
  };

  const urlUploader = async (url) => {
    const userId = getUserId();
    const companyId = getCompanyId();
    if (!userId) throw new Error("Не найден userId в localStorage");

    return attachFromUrl("users", userId, url, {
      purpose: "avatar",
      companyId,
    });
  };

  return (
    <div className={styles.headerCard}>
      <div className={styles.avatarCol}>
        <AvatarEditable
          value={values?.avatarUrl || ""}
          onChange={(url) => onChange?.("avatarUrl", url)}
          label="Изменить"
          size={96}
          uploader={uploader}
          urlUploader={urlUploader}
        />
      </div>

      <div className={styles.titleBlock}>
        <div className={styles.title}>{fullName}</div>
        {values?.email && (
          <div className={styles.subtitle}>{values.email}</div>
        )}
      </div>
    </div>
  );
}