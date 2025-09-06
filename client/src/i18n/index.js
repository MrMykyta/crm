import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';
import ua from './locales/ua.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      pl: { translation: pl },
      ua: { translation: ua },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru', 'pl', 'ua'],
    detection: {
      order: ['localStorage', 'querystring', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    load: 'languageOnly',              // 'ru-RU' -> 'ru'
    nonExplicitSupportedLngs: true,    // разрешить 'ru-RU' как 'ru'
  });

export default i18n;