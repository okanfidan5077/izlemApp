import { Injectable, signal } from '@angular/core';
import { TR_TRANSLATIONS } from '../i18n/tr';
import { EN_TRANSLATIONS } from '../i18n/en';

export type SupportedLanguage = 'tr' | 'en';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private readonly STORAGE_KEY = 'izlem_language';

  // Current language signal — defaults to TR or saved preference
  readonly currentLang = signal<SupportedLanguage>(this.getInitialLanguage());

  private readonly dictionaries: Record<SupportedLanguage, Record<string, any>> = {
    tr: TR_TRANSLATIONS,
    en: EN_TRANSLATIONS,
  };

  private getInitialLanguage(): SupportedLanguage {
    const saved = localStorage.getItem(this.STORAGE_KEY) as SupportedLanguage;
    if (saved === 'tr' || saved === 'en') {
      return saved;
    }
    // Default to Turkish for this application
    return 'tr';
  }

  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLang() !== lang) {
      this.currentLang.set(lang);
      localStorage.setItem(this.STORAGE_KEY, lang);
    }
  }

  toggleLanguage(): void {
    const next = this.currentLang() === 'tr' ? 'en' : 'tr';
    this.setLanguage(next);
  }

  /**
   * Translate key (e.g., 'nav.teacherHub' or 'teacher.submitMultiple')
   * Supports parameters interpolation like {count}
   */
  translate(key: string, params?: Record<string, any>): string {
    const lang = this.currentLang();
    const dictionary = this.dictionaries[lang] || this.dictionaries['tr'];

    const keys = key.split('.');
    let result: any = dictionary;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = this.getFallbackKey(key);
        break;
      }
    }

    if (typeof result !== 'string') {
      return key;
    }

    // Param interpolation
    if (params) {
      Object.keys(params).forEach(paramKey => {
        result = (result as string).replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
      });
    }

    return result;
  }

  private getFallbackKey(key: string): string {
    const keys = key.split('.');
    let result: any = EN_TRANSLATIONS;
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        return key;
      }
    }
    return typeof result === 'string' ? result : key;
  }

  // Shorthand helper
  t(key: string, params?: Record<string, any>): string {
    return this.translate(key, params);
  }
}
