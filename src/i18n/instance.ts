import i18next, { type TOptions } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NAMESPACES, resources, SUPPORTED_LOCALES } from './resources';
import type { SupportedLocale } from './host-locale';

export const i18n = i18next.createInstance();
i18n.use(initReactI18next);

let currentLocale: SupportedLocale = 'en-US';

export async function initI18n(initialLocale: SupportedLocale): Promise<SupportedLocale> {
  try {
    await i18n.init({
      resources,
      lng: initialLocale,
      fallbackLng: 'en-US',
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    currentLocale = initialLocale;
    return currentLocale;
  } catch (error) {
    console.warn('Failed to initialize UI localization; falling back to en-US.', error);
    currentLocale = 'en-US';

    try {
      if (i18n.isInitialized) {
        await i18n.changeLanguage('en-US');
      } else {
        await i18n.init({
          resources,
          lng: 'en-US',
          fallbackLng: 'en-US',
          supportedLngs: [...SUPPORTED_LOCALES],
          ns: [...NAMESPACES],
          defaultNS: 'common',
          interpolation: { escapeValue: false },
          returnNull: false,
        });
      }
    } catch (fallbackError) {
      console.warn('Failed to initialize the English UI localization fallback.', fallbackError);
    }

    return currentLocale;
  }
}

export function getCurrentLocale(): SupportedLocale {
  return currentLocale;
}

export type TranslationOptions = TOptions;
