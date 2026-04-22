import { mount } from 'svelte';
import App from './App.svelte';

// Upstream Excalidraw's `ExcalidrawFontFace.createUrls` treats raw asset
// paths as relative and needs `window.EXCALIDRAW_ASSET_PATH` to build a
// correct absolute URL. In our Vite dev setup, the font imports resolve
// to `/@fs/C:/.../fonts/Excalifont/...woff2` — an absolute path on THIS
// origin. Setting the base to `location.origin + "/"` makes the resolver
// do `new URL("@fs/C:/...", "http://localhost:3002/")` → the correct
// Vite-served URL. Without this the resolver falls back to esm.sh, which
// yields a dead URL (the errors we saw before this fix).
// Needs to run BEFORE App.svelte mounts so Fonts class reads it at init.
// @ts-ignore — not in lib.dom
window.EXCALIDRAW_ASSET_PATH = window.location.origin + '/';

mount(App, { target: document.getElementById('app')! });
