// src/pages/UserSettingsPage/sections/AppearanceForm.jsx
import { Formik, Form } from "formik";
import { Image as ImageIcon } from "lucide-react";
import s from "../../UserSettingsPage.module.css";
import { uploadBackground, saveMyPreferences } from "../../../../api/user";
import { useTheme } from "../../../../Providers/ThemeProvider";

export default function AppearanceForm({ initial }) {
  const { appearance, setAppearance, mode, lang } = useTheme();

  // загрузка файла → серверный URL → live применить и сохранить в форме
  const uploadBG = async (file, setFieldValue) => {
    const { url } = await uploadBackground(file);
    setFieldValue("backgroundPath", url);
    setAppearance({ backgroundPath: url });              // LIVE → применили и записали в localStorage
  };

  const handleLiveFont = (v) => {
    setAppearance({ fontScale: v });                      // LIVE → применили и записали в localStorage
  };

  const handleLiveBg = (path, setFieldValue) => {
    setFieldValue("backgroundPath", path);
    setAppearance({ backgroundPath: path || null });      // LIVE
  };

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      // сохраняем prefs на бэк (не перетираем тему/язык)
      await saveMyPreferences({
        themeMode: mode,
        lang,
        appearance: {
          ...appearance,
          fontScale: values.fontScale,
          backgroundPath: values.backgroundPath || null
        }
      });
      // синхронизируем провайдер, хотя он уже в live-режиме обновлён
      setAppearance({
        fontScale: values.fontScale,
        backgroundPath: values.backgroundPath || null
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{
        fontScale: initial?.fontScale ?? appearance.fontScale ?? 100,
        backgroundPath: initial?.backgroundPath ?? appearance.backgroundPath ?? ""
      }}
      enableReinitialize
      onSubmit={handleSubmit}
    >
      {({ values, setFieldValue, isSubmitting }) => (
        <Form>
          <div className={s.grid}>
            {/* Font scale */}
            <div className={s.field}>
              <label className={s.label}>Шрифт: {values.fontScale}%</label>
              <input
                className={s.input}
                type="range"
                min="70"
                max="160"
                step="5"
                value={values.fontScale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFieldValue("fontScale", v);
                  handleLiveFont(v);
                }}
              />
            </div>

            {/* Background */}
            <div className={`${s.field} ${s.full}`}>
              <label className={s.label}>Фон (URL или загрузка)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className={s.input}
                  placeholder="https://… или /static/backgrounds/xxx.webp"
                  value={values.backgroundPath}
                  onChange={(e) => handleLiveBg(e.target.value, setFieldValue)}
                />
                <label
                  className={s.primary}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <ImageIcon size={16} /> upload
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && uploadBG(e.target.files[0], setFieldValue)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className={s.actions}>
            <button className={s.primary} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Сохранить"}
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
}