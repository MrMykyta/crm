import { useState, useMemo } from "react";
import { Formik, Form } from "formik";
import { Image as ImageIcon, Download as DownloadIcon } from "lucide-react";
import * as Yup from "yup";

import page from "../../UserSettingsPage.module.css";
import st from "./AppearanceForm.module.css";
import { saveMyPreferences } from "../../../../../api/user";
import { uploadFile, attachFromUrl } from "../../../../../api/uploads";
import { useTheme } from "../../../../../Providers/ThemeProvider";

const MAX_BG_MB = 5;

const Schema = Yup.object().shape({
  fontScale: Yup.number().min(70).max(160).required(),
  backgroundPath: Yup.string().trim().nullable(),
  urlDraft: Yup.string().trim().nullable(),
});

function getCurrentUserId() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.id || null;
  } catch {
    return null;
  }
}
const getCompanyId = () => localStorage.getItem("companyId") || undefined;

export default function AppearanceForm({ initial }) {
  const { appearance, setAppearance, mode, lang } = useTheme();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");

  const initValues = useMemo(
    () => ({
      fontScale: initial?.fontScale ?? appearance.fontScale ?? 100,
      backgroundPath: initial?.backgroundPath ?? appearance.backgroundPath ?? "",
      urlDraft: "",
    }),
    [initial, appearance]
  );

  const mapUploadError = (e) => {
    const status = e?.response?.status;
    const code = e?.response?.data?.error;
    if (status === 413 || code === "file_too_large")
      return `Размер файла превышает ${MAX_BG_MB} MB`;
    if (status === 415 || code === "mime_not_allowed")
      return "Неподдерживаемый формат. Разрешены PNG, JPG, WEBP, SVG.";
    return e?.response?.data?.message || e?.message || "Ошибка загрузки файла";
  };

  const uploadBG = async (file, setFieldValue) => {
    setUploadError("");
    setSaveOk("");
    if (!file) return;
    if (file.size > MAX_BG_MB * 1024 * 1024)
      return setUploadError(`Файл больше ${MAX_BG_MB} MB`);

    const userId = getCurrentUserId();
    if (!userId) return setUploadError("Не удалось определить текущего пользователя");

    try {
      setUploading(true);
      const { url } = await uploadFile("users", userId, file, {
        purpose: "background",
        companyId: getCompanyId(),
      });
      setFieldValue("backgroundPath", url);
      setAppearance({ backgroundPath: url });
      setSaveOk("Фон загружен");
    } catch (e) {
      setUploadError(mapUploadError(e));
    } finally {
      setUploading(false);
    }
  };

  const persistByUrl = async (urlDraft, setFieldValue) => {
    setUploadError("");
    setSaveOk("");
    const src = String(urlDraft || "").trim();
    if (!src) return;
    const userId = getCurrentUserId();
    if (!userId) return setUploadError("Не удалось определить текущего пользователя");

    try {
      setUploading(true);
      const { url } = await attachFromUrl("users", userId, src, {
        purpose: "background",
        companyId: getCompanyId(),
      });
      setFieldValue("backgroundPath", url);
      setFieldValue("urlDraft", "");
      setAppearance({ backgroundPath: url });
      setSaveOk("Фон загружен");
    } catch (e) {
      setUploadError(mapUploadError(e));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    setSaveError("");
    setSaveOk("");
    try {
      await saveMyPreferences({
        themeMode: mode,
        lang,
        appearance: {
          ...appearance,
          fontScale: values.fontScale,
          backgroundPath: values.backgroundPath || null,
        },
      });
      setAppearance({
        fontScale: values.fontScale,
        backgroundPath: values.backgroundPath || null,
      });
      setSaveOk("Сохранено");
    } catch (e) {
      setSaveError(
        e?.response?.data?.message || e?.message || "Не удалось сохранить настройки"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={initValues}
      enableReinitialize
      validationSchema={Schema}
      onSubmit={handleSubmit}
    >
      {({ values, setFieldValue, isSubmitting, isValid }) => (
        <Form noValidate>
          <div className={page.grid}>
            {/* Font scale */}
            <div className={page.field}>
              <label className={page.label}>Шрифт: {values.fontScale}%</label>
              <input
                className={page.input}
                type="range"
                min="70"
                max="160"
                step="5"
                value={values.fontScale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFieldValue("fontScale", v);
                  setAppearance({ fontScale: v });
                }}
              />
            </div>

            {/* Background */}
            <div className={`${page.field} ${page.full}`}>
              <label className={page.label}>Фон</label>

              <div className={st.row}>
                <input
                  className={`${page.input} ${st.urlInput}`}
                  placeholder="Вставьте URL и нажмите «Загрузить по URL»"
                  value={values.urlDraft}
                  onChange={(e) => setFieldValue("urlDraft", e.target.value)}
                  disabled={uploading}
                />

                <button
                  type="button"
                  className={`${page.ghost} ${st.btn}`}
                  disabled={uploading || !values.urlDraft}
                  onClick={() => persistByUrl(values.urlDraft, setFieldValue)}
                  title="Скачать изображение на сервер"
                >
                  <DownloadIcon size={16} style={{ marginRight: 6 }} />
                  Загрузить по URL
                </button>

                <label className={`${page.primary} ${st.btnPrimary}`}>
                  <ImageIcon size={16} style={{ marginRight: 6 }} />
                  {uploading ? "upload…" : "upload"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBG(f, setFieldValue);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              {uploadError ? (
                <div className={st.errBox}>{uploadError}</div>
              ) : (
                <div className={st.hint}>
                  Лимит: {MAX_BG_MB} MB. Разрешены PNG, JPG, WEBP, SVG.
                </div>
              )}
            </div>
          </div>

          {saveError && <div className={st.errBox}>{saveError}</div>}
          {saveOk && <div className={st.okBox}>{saveOk}</div>}

          <div className={page.actions}>
            <button
              className={page.primary}
              type="submit"
              disabled={isSubmitting || uploading || !isValid}
            >
              {isSubmitting ? "Saving…" : "Сохранить"}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}