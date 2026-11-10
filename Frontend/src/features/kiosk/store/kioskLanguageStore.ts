import { create } from 'zustand';
import { Platform } from 'react-native';

export type KioskLanguage = 'EN' | 'ZH' | 'MS' | 'TA';

export interface LanguageOption {
  code: KioskLanguage;
  label: string;
  nativeLabel: string;
}

export const KIOSK_LANGUAGES: LanguageOption[] = [
  { code: 'EN', label: 'English', nativeLabel: 'English' },
  { code: 'ZH', label: 'Chinese', nativeLabel: '中文' },
  { code: 'MS', label: 'Malay', nativeLabel: 'Melayu' },
  { code: 'TA', label: 'Tamil', nativeLabel: 'தமிழ்' },
];

const KIOSK_LANG_KEY = 'redbay_kiosk_language';

const getInitialLanguage = (): KioskLanguage => {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(KIOSK_LANG_KEY) as KioskLanguage;
      if (stored && ['EN', 'ZH', 'MS', 'TA'].includes(stored)) {
        return stored;
      }
    } catch {}
  }
  return 'EN';
};

interface KioskLanguageState {
  language: KioskLanguage;
  setLanguage: (lang: KioskLanguage) => void;
}

export const useKioskLanguageStore = create<KioskLanguageState>((set) => ({
  language: getInitialLanguage(),
  setLanguage: (lang) => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(KIOSK_LANG_KEY, lang);
      } catch {}
    }
    set({ language: lang });
  },
}));
