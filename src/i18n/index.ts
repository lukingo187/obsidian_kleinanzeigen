import { de, en } from './strings';

export type Lang = 'de' | 'en';
export type StringKey = keyof typeof de;

const strings = { de, en };
let lang: Lang = 'de';

export function setLang(l: Lang): void {
  lang = l;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let str: string = strings[lang][key] ?? strings.de[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}
