// Minimal i18n stub. Post-Phase-9 we removed the jotai-backed original
// version; the Svelte port has its own at
// `packages/editor/src/state/i18n.svelte.ts`.
//
// This file exists only to satisfy a handful of TS files still in
// `packages/engine/` (scene/scrollbars.ts, data/index.ts, tests)
// that call `getLanguage()` / `t()` directly. They'd otherwise pull
// the Svelte port into this package — creating a cycle since the
// Svelte port aliases into this package.
//
// Behavior:
//  - `t()` returns the key itself as fallback. No lookup, no
//    interpolation. Tests that assert on translated strings will
//    break — acceptable, they weren't running anyway.
//  - `getLanguage()` returns English (non-RTL). Scrollbars use this
//    only to pick left-vs-right orientation; RTL support in original
//    is a Phase 7 concern not yet wired to the Svelte port.

export interface Language {
  code: string;
  label: string;
  rtl?: boolean;
}

export const defaultLang: Language = { code: "en", label: "English" };

export const getLanguage = (): Language => defaultLang;

export const t = (
  path: string,
  _replacement?: Record<string, string | number> | null,
  fallback?: string,
): string => fallback ?? path;
