// Ambient shims for globals and cross-file types that show up when
// svelte-check walks upstream packages/{common,element,excalidraw}.
//
// Why not use packages/excalidraw/global.d.ts directly: our tsconfig
// excludes packages/** so its global.d.ts isn't auto-loaded. Mirroring
// the same declarations here keeps the scope narrow to files our port
// actually touches.

// ─── Window globals upstream relies on ─────────────────────────────
interface Window {
  __EXCALIDRAW_SHA__: string | undefined;
  EXCALIDRAW_ASSET_PATH: string | string[] | undefined;
  EXCALIDRAW_THROTTLE_RENDER: boolean | undefined;
  DEBUG_FRACTIONAL_INDICES: boolean | undefined;
  EXCALIDRAW_EXPORT_SOURCE: string;
}

// ─── Node globals leaked into universal TS files ───────────────────
// Upstream TS files reference `process.env`, `Buffer.from()`, etc. for
// environment detection. They're guarded at runtime — these are just
// type shims to silence svelte-check.
declare const process: {
  env: Record<string, string | undefined>;
};
declare const Buffer: {
  from(data: any, encoding?: string): {
    toString(encoding?: string): string;
    buffer: ArrayBuffer;
  };
};

// ─── React namespace shim ─────────────────────────────────────────
// A handful of upstream .ts files (linearElementEditor, clipboard)
// still have `React.PointerEvent<HTMLElement>` / `React.Component<...>`
// type annotations. We don't use React at runtime, but svelte-check
// needs the namespace resolvable. Typing all inner members as `any`
// preserves runtime behavior — callers `@ts-ignore` them anyway.
declare namespace React {
  type PointerEvent<_T = any> = any;
  type SyntheticEvent<_T = any> = any;
  type MouseEvent<_T = any> = any;
  type KeyboardEvent<_T = any> = any;
  type DragEvent<_T = any> = any;
  type Component<_P = any, _S = any> = any;
  type ForwardRefRenderFunction<_T, _P = any> = any;
}

// ─── Untyped CommonJS libs upstream still imports ─────────────────
// These are small pure-JS packages without @types/ packages. Upstream
// uses them for image processing + png-chunk round-tripping.
declare module "lodash.throttle";
declare module "lodash.debounce";
declare module "png-chunk-text";
declare module "png-chunks-encode";
declare module "png-chunks-extract";
declare module "image-blob-reduce";

// Upstream `types.ts` does `import type { PointerEvent, ... }
// from "react"`. Declare the module with the members as `any` —
// real React isn't installed; these are erased types.
declare module "react" {
  export type PointerEvent<_T = any> = any;
  export type SyntheticEvent<_T = any> = any;
  export type MouseEvent<_T = any> = any;
  export type KeyboardEvent<_T = any> = any;
  export type DragEvent<_T = any> = any;
  export type Component<_P = any, _S = any> = any;
  export type ReactNode = any;
  export namespace JSX {
    type Element = any;
    type IntrinsicElements = Record<string, any>;
  }
}

// ─── Misc Blob extensions used by upstream ────────────────────────
// File (extends Blob) has `name`; upstream's Blob-typed params sometimes
// read .name directly. Shim Blob to have optional name.
interface Blob {
  name?: string;
  handle?: any;
}
interface File {
  handle?: any;
}

// browser-fs-access (which upstream's json/blob helpers use) adds a
// `handle` property via augmentation but we don't pull that lib.

