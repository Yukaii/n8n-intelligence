import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

// Import translation resources
import enTranslation from '../locales/en.json';
import zhTWTranslation from '../locales/zh-TW.json';
import jaTranslation from '../locales/ja.json';

// Define the translations
const resources = {
  en: {
    translation: enTranslation
  },
  'zh-TW': {
    translation: zhTWTranslation
  },
  ja: {
    translation: jaTranslation
  }
};

i18n
  .use(LanguageDetector)
  .use(Backend)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;