import i18next from 'i18next';
import detector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ko from './ko';

export const LANGUAGES: {
  value: string;
  label: string;
}[] = [
  {
    value: 'en',
    label: 'English',
  },
  {
    value: 'ko',
    label: '한국어',
  },
];

const resources = {
  en,
  ko,
};

// Settings i18n
const i18n = i18next
  .use(initReactI18next)
  .use(detector)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    },
  });

export default i18n;
