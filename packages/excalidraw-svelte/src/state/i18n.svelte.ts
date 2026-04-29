/// <reference types="vite/client" />
// Minimal i18n rune store. Mirrors the shape of upstream's
// `packages/excalidraw/i18n.ts` (defaultLang + languages list + t()),
// but backed by Svelte $state so changes propagate reactively.
//
// Scope choices:
//  - Bundles a SHORT whitelist of locales by default (~15) rather
//    than all 59 — full set is available via setLanguage() which
//    dynamically imports on demand.
//  - Fallback chain: current → en → key itself.
//  - No percentages.json gating (upstream filters by completion
//    threshold). Keep everything available; user sees English if a
//    key is missing from their chosen locale.

// eslint-disable-next-line import/no-unresolved
// @ts-ignore — upstream JSON, resolved via Vite alias
import fallbackLangData from "@sveltedraw/engine/locales/en.json";

export type Language = {
  code: string;
  label: string;
  /** right-to-left */
  rtl?: boolean;
};

export const defaultLang: Language = { code: "en", label: "English" };

// Curated list — common languages + Vietnamese (project context).
// Full upstream list is larger; add more here as needed.
export const availableLanguages: Language[] = [
  defaultLang,
  { code: "vi-VN", label: "Tiếng Việt" },
  { code: "de-DE", label: "Deutsch" },
  { code: "es-ES", label: "Español" },
  { code: "fr-FR", label: "Français" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "pt-BR", label: "Português (BR)" },
  { code: "ru-RU", label: "Русский" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ar-SA", label: "العربية", rtl: true },
  { code: "he-IL", label: "עברית", rtl: true },
];

// Preload locale JSONs eagerly so the first language swap doesn't need
// network. Vite's import.meta.glob bundles them as chunks that lazy-load.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localeModules = import.meta.glob<{ default: any }>(
  "../../../excalidraw/locales/*.json",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let langData = $state<Record<string, any>>(fallbackLangData as any);
let langCode = $state<string>(defaultLang.code);

export function getCurrentLangCode(): string {
  return langCode;
}

// D4: pick a supported language from the browser's preference order.
// Tries exact match first (e.g. "vi-VN"), then the base tag (e.g. "vi" —
// matched against the first entry whose code starts with the same base).
// Falls back to English when no preference matches.
export function getPreferredLanguage(): string {
  if (typeof navigator === "undefined") return defaultLang.code;
  const prefs = Array.isArray(navigator.languages)
    ? navigator.languages
    : [navigator.language || defaultLang.code];
  const supportedExact = new Set(availableLanguages.map((l) => l.code));
  for (const pref of prefs) {
    if (supportedExact.has(pref)) return pref;
    const base = pref.split("-")[0].toLowerCase();
    const match = availableLanguages.find(
      (l) => l.code.split("-")[0].toLowerCase() === base,
    );
    if (match) return match.code;
  }
  return defaultLang.code;
}

export async function setLanguage(code: string): Promise<void> {
  if (code === "en") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    langData = fallbackLangData as any;
    langCode = "en";
    return;
  }
  const key = `../../../excalidraw/locales/${code}.json`;
  const loader = localeModules[key];
  if (!loader) {
    // eslint-disable-next-line no-console
    console.warn(`sveltedraw i18n: no bundled locale for ${code}`);
    return;
  }
  try {
    const mod = await loader();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    langData = (mod.default ?? mod) as any;
    langCode = code;
    // Apply RTL to document root for languages that need it.
    const lang = availableLanguages.find((l) => l.code === code);
    document.documentElement.dir = lang?.rtl ? "rtl" : "ltr";
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`sveltedraw i18n: failed loading ${code}`, err);
  }
}

// Dot-path lookup into the locale tree. Returns undefined if the path
// doesn't resolve to a string — caller falls back to English or key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookup(data: any, parts: string[]): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = data;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function t(
  path: string,
  replacement?: Record<string, string | number>,
  fallback?: string,
): string {
  // Read both $state values so Svelte tracks them — reactive callers
  // re-run when language changes.
  void langCode;
  const parts = path.split(".");
  let out =
    lookup(langData, parts) ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lookup(fallbackLangData as any, parts) ??
    fallback ??
    path;
  if (replacement) {
    for (const [k, v] of Object.entries(replacement)) {
      out = out.replace(`{{${k}}}`, String(v));
    }
  }
  return out;
}
