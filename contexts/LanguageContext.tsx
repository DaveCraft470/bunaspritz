import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ro } from '@/lib/i18n/ro';
import { en } from '@/lib/i18n/en';
import type { Translations } from '@/lib/i18n/ro';

export type Language = 'ro' | 'en';

const STORAGE_KEY = 'spritz.language';

const dictionaries: Record<Language, Translations> = { ro, en };

// Passed to Date#toLocaleDateString/toLocaleTimeString wherever the app
// formats a date — keeps day/month names and separators in sync with `t`.
const locales: Record<Language, string> = { ro: 'ro-RO', en: 'en-US' };

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: Translations;
  locale: string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  // Romanian is the app's default until the stored preference (if any)
  // resolves — mirrors ThemeContext's restore pattern.
  const [language, setLanguageState] = useState<Language>('ro');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'ro' || stored === 'en') setLanguageState(stored);
    });
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const setLanguage = (next: Language) => {
      setLanguageState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    };
    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === 'ro' ? 'en' : 'ro'),
      t: dictionaries[language],
      locale: locales[language],
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
