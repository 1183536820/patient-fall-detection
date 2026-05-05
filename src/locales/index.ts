import { createI18n } from 'vue-i18n'
import zh from './zh'
import en from './en'

export type MessageSchema = typeof zh

const i18n = createI18n<[MessageSchema], 'zh' | 'en'>({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh',
  fallbackLocale: 'zh',
  messages: {
    zh,
    en
  }
})

export default i18n

export function setLocale(locale: 'zh' | 'en') {
  (i18n.global.locale as any).value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.setAttribute('lang', locale)
}

export function getLocale(): string {
  return (i18n.global.locale as any).value || i18n.global.locale
}