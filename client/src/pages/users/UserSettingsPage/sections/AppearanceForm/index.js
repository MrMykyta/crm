import { useSelector } from "react-redux";
import { useState, useMemo } from "react";
import { Formik, Form } from "formik";
import { Image as ImageIcon, Download as DownloadIcon } from "lucide-react";
import * as Yup from "yup";
import { useTranslation } from "react-i18next";

import page from "../../UserSettingsPage.module.css";
import st from "./AppearanceForm.module.css";
import { useUploadFileMutation } from "../../../../../store/rtk/filesApi";
import { useTheme } from "../../../../../Providers/ThemeProvider";
import { useSaveMyPreferencesMutation } from "../../../../../store/rtk/userApi";
import ThemedSelect from "../../../../../components/inputs/RadixSelect";

const MAX_BG_MB = 5;

const Schema = Yup.object().shape({
  fontScale: Yup.number().min(70).max(160).required(),
  textSize: Yup.mixed().oneOf(["small", "medium", "large"]).required(),
  density: Yup.mixed().oneOf(["compact", "comfortable", "spacious"]).required(),
  backgroundPath: Yup.string().trim().nullable(),
  urlDraft: Yup.string().trim().nullable(),
});

// Компонент AppearanceForm: отвечает за отображение UI и обработку взаимодействий пользователя.
export default function AppearanceForm({ initial }) {
  const { appearance, setAppearance, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const userId = useSelector((s) => s.auth?.currentUser?.id);
  const [saveMyPreferences] = useSaveMyPreferencesMutation();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");

  const [uploadFile] = useUploadFileMutation();

  const textSizeOptions = useMemo(
    () => [
      { value: "small", label: t("settings.appearance.textSizeSmall", "Small") },
      { value: "medium", label: t("settings.appearance.textSizeMedium", "Medium (default)") },
      { value: "large", label: t("settings.appearance.textSizeLarge", "Large") },
    ],
    [t]
  );

  const densityOptions = useMemo(
    () => [
      { value: "compact", label: t("settings.appearance.densityCompact", "Compact") },
      { value: "comfortable", label: t("settings.appearance.densityComfortable", "Comfortable") },
      { value: "spacious", label: t("settings.appearance.densitySpacious", "Spacious") },
    ],
    [t]
  );

  const initValues = useMemo(
    () => ({
      fontScale: initial?.fontScale ?? appearance.fontScale ?? 100,
      textSize: initial?.textSize ?? appearance.textSize ?? "medium",
      density: initial?.density ?? appearance.density ?? "comfortable",
      backgroundPath: initial?.backgroundPath ?? appearance.backgroundPath ?? "",
      urlDraft: "",
    }),
    [initial, appearance]
  );

  // маппинг ошибки под RTK Query
  const mapUploadError = (e) => {
    const status = e?.status ?? e?.originalStatus ?? e?.response?.status;
    const data = e?.data ?? e?.response?.data;
    const code = data?.error;
    const msg = data?.message || e?.message;

    if (status === 413 || code === "file_too_large") return `Размер файла превышает ${MAX_BG_MB} MB`;
    if (status === 415 || code === "mime_not_allowed") return "Неподдерживаемый формат. Разрешены PNG, JPG, WEBP, SVG.";
    return msg || "Ошибка загрузки файла";
  };

    // uploadBG: вспомогательная логика компонента.
const uploadBG = async (file, setFieldValue) => {
    setUploadError("");
    setSaveOk("");
    if (!file) return;
    if (file.size > MAX_BG_MB * 1024 * 1024) return setUploadError(`Файл больше ${MAX_BG_MB} MB`);
    if (!userId) return setUploadError("Не удалось определить текущего пользователя");

    try {
      setUploading(true);
      const res = await uploadFile({
        ownerType: "user",
        ownerId: userId,
        file,
        purpose: "background",
        visibility: "private",
      }).unwrap();
      const fileId = res?.data?.id || res?.id || null;
      const ref = fileId || res?.data?.url || res?.url || res?.path || "";
      setFieldValue("backgroundPath", ref);
      setAppearance({ backgroundPath: ref });
      setSaveOk("Фон загружен");
    } catch (e) {
      setUploadError(mapUploadError(e));
    } finally {
      setUploading(false);
    }
  };

    // persistByUrl: вспомогательная логика компонента.
const persistByUrl = async (urlDraft, setFieldValue) => {
    setUploadError("");
    setSaveOk("");
    const src = String(urlDraft || "").trim();
    if (!src) return;
    if (!userId) return setUploadError("Не удалось определить текущего пользователя");

    try {
      setUploading(true);
      setFieldValue("backgroundPath", src);
      setFieldValue("urlDraft", "");
      setAppearance({ backgroundPath: src });
      setSaveOk("Фон загружен");
    } catch (e) {
      setUploadError(mapUploadError(e));
    } finally {
      setUploading(false);
    }
  };

    // handleSubmit: обработчик пользовательского действия.
const handleSubmit = async (values, { setSubmitting }) => {
    setSaveError("");
    setSaveOk("");
    try {
      await saveMyPreferences({
        themeMode: mode,
        lang: i18n.language,
        appearance: {
          ...appearance,
          fontScale: values.fontScale,
          textSize: values.textSize,
          density: values.density,
          backgroundPath: values.backgroundPath || null,
        },
      }).unwrap();

      setAppearance({
        fontScale: values.fontScale,
        textSize: values.textSize,
        density: values.density,
        backgroundPath: values.backgroundPath || null,
      });
      setSaveOk("Сохранено");
    } catch (e) {
      const msg = e?.data?.message || e?.message || "Не удалось сохранить настройки";
      setSaveError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik initialValues={initValues} enableReinitialize validationSchema={Schema} onSubmit={handleSubmit}>
      {({ values, setFieldValue, isSubmitting, isValid }) => (
        <Form noValidate>
          <div className={page.grid}>
            <div className={page.field}>
              <label className={page.label}>
                {t("settings.appearance.textSize", "Размер текста")}
              </label>
              <ThemedSelect
                className={page.input}
                value={values.textSize}
                options={textSizeOptions}
                size="sm"
                onChange={(value) => {
                  const next = String(value || "medium");
                  setFieldValue("textSize", next);
                  setAppearance({ textSize: next });
                }}
              />
            </div>

            <div className={page.field}>
              <label className={page.label}>
                {t("settings.appearance.density", "Плотность интерфейса")}
              </label>
              <ThemedSelect
                className={page.input}
                value={values.density}
                options={densityOptions}
                size="sm"
                onChange={(value) => {
                  const next = String(value || "comfortable");
                  setFieldValue("density", next);
                  setAppearance({ density: next });
                }}
              />
            </div>

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
                <div className={st.hint}>Лимит: {MAX_BG_MB} MB. Разрешены PNG, JPG, WEBP, SVG.</div>
              )}
            </div>
          </div>

          {saveError && <div className={st.errBox}>{saveError}</div>}
          {saveOk && <div className={st.okBox}>{saveOk}</div>}

          <div className={page.actions}>
            <button className={page.primary} type="submit" disabled={isSubmitting || uploading || !isValid}>
              {isSubmitting ? "Saving…" : "Сохранить"}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

