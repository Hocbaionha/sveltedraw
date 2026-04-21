# Kế hoạch port Excalidraw (React) → Svelte 5 + Vite

> Ngày lập: 2026-04-21
> Phiên bản: v3 (cập nhật sau khi chốt 7 quyết định kiến trúc)
> Phạm vi: toàn bộ monorepo `sveltedraw` (fork `excalidraw/excalidraw`)
> Deploy target: **draw.hodion.com**

## Quyết định đã chốt (2026-04-21)

| # | Quyết định | Đã chọn |
|---|---|---|
| **A** | Framework shell | **Svelte 5 + Vite thuần** — không dùng SvelteKit. Excalidraw là 1 component SPA, không cần routing framework. |
| **B** | Upstream sync | **Fork độc lập** — không sync ngược `excalidraw/excalidraw`. Repo tự maintain. |
| **C** | Publish lib | **Không** — chỉ build web app. Không publish `@sveltedraw/excalidraw` lên npm. |
| **D** | Examples | **Viết lại bằng Svelte** — xoá `examples/with-nextjs` và `with-script-in-browser`, thay bằng Svelte equivalents. |
| **E** | dev-docs | **Giữ nguyên** Docusaurus (React), port sau khi app ổn định. |
| **F** | index-node.ts | **Giữ nguyên** — cần cho server-side render PNG/SVG từ diagram JSON. |
| **G** | Rollout | **Hard cutover** lên `draw.hodion.com`. Không cần dual-route hay feature flag. |

**Thay đổi so với v2:**
- Bỏ SvelteKit hoàn toàn (A = Svelte 5 + Vite thuần).
- Thêm deploy target `draw.hodion.com`.
- Tất cả 7 quyết định đã chốt.

---

## 1. Rà soát hiện trạng

### 1.1 Số liệu nền (snapshot hôm nay, dùng để đối chiếu)

| Hạng mục | Con số |
|---|---|
| File `.tsx` (không test) trong `packages/excalidraw` | **195** |
| File `.ts`/`.tsx` (không test) trong `packages/excalidraw` | 341 |
| File import React trong `packages/excalidraw` | 166 |
| File `.tsx` trong `excalidraw-app` | 20 |
| File `.ts` trong `excalidraw-app` | 18 |
| File SCSS trong `packages/excalidraw` + `excalidraw-app` | **78** |
| File locale JSON (`locales/`) | 59 |
| File test dùng `@testing-library/react` | 13 (+ còn `.test.tsx` thuần JSX ≥ 30) |
| Hook custom trong `hooks/` | 12 |
| Action module trong `actions/` | 47 |
| `App.tsx` tổng dòng | **12,838** |
| `App.tsx` — phần class (618–12791) | 12,173 dòng |
| `App.tsx` — trước `render()` (618–2065) | 1,447 dòng (constructor, init) |
| `App.tsx` — `render()` (2066–2406) | **341 dòng JSX** (~3% file) |
| `App.tsx` — sau `render()` (2406–12791) | ~10,385 dòng, ~116 method |
| `App.tsx` — số method (arrow + regular) | 124 |
| `LayerUI.tsx` | 681 dòng, 9 return JSX |
| Jotai hook call sites (`useAtom`/`useAtomValue`/`useSetAtom`) | 56, trên 35 file |
| Radix-ui primitive được dùng | **3** (`Popover`, `DropdownMenu`, `Tabs`) |
| Tunnel-rat tunnels | 9 (định nghĩa ở 1 file) |
| `forwardRef` sites | 10 |
| `createPortal` sites | 2 (`Modal.tsx`, `EyeDropper.tsx`) |
| `flushSync` (react-dom) sites | ≥1 (`App.tsx`) |
| `useTransition`/`useDeferredValue` sites | 3 (polyfill + 2 call sites) |
| Class component kiểu cũ | chỉ 1 — `App.tsx` |
| Error boundary | 1 — `TopErrorBoundary.tsx` |
| GitHub Actions workflow | 11 |

### 1.2 Cái gì KHÔNG phải port (giữ nguyên, framework-agnostic)

| Khu vực | Số file (src) | Ghi chú |
|---|---|---|
| `packages/common/src` | 18 | TS thuần |
| `packages/math/src` | 15 | TS thuần |
| `packages/element/src` | 49 | TS thuần (1 test file có React — không phải src) |
| `packages/utils/src` | 6 | TS thuần |
| `packages/excalidraw/renderer` | 8 | Canvas 2D, không React |
| `packages/excalidraw/scene` | 7 | TS thuần |
| `packages/excalidraw/wysiwyg` | 1 (`textWysiwyg.tsx`) | Contenteditable DOM + `react-dom` imports phụ — clean ra |
| `packages/excalidraw/fonts` | toàn bộ subsystem | `Fonts.ts`, `ExcalidrawFontFace.ts`, font data, `fonts.css` |
| `packages/excalidraw/subset` | toàn bộ | `harfbuzz/` WASM, `woff2/`, `subset-worker.chunk.ts` |
| `packages/excalidraw/workers.ts` | 1 | `WorkerPool` abstraction |
| `packages/excalidraw/data/*` | ≥14 | trừ `data/library.ts` (dùng jotai) |
| `packages/excalidraw/polyfill.ts` | 1 | `pepjs` polyfill |
| `packages/excalidraw/actions/*` | 47 | ~5 file action dùng JSX (Dialog…) — cần port; còn lại là reducer thuần |
| `packages/excalidraw/index-node.ts` | 1 | Node canvas smoke export |
| `firebase-project/` | — | Firebase rules, không code React |
| `scripts/` (build tooling) | 10+ | Node scripts |

**Nhận định:** ~55–60% codebase không đổi dòng nào khi port. Chỉ còn lớp UI + state + test + app shell.

### 1.3 Điểm nóng cần chú ý đặc biệt

1. **`App.tsx` (12,838 dòng)** — class component, nhưng **JSX thật chỉ 341 dòng**. Phần còn lại (~11,832 dòng) là method xử lý pointer/keyboard/binding/selection/clipboard/export/collab. Đây là cơ hội vàng: trích ra module TS thuần **trước khi** port Svelte → shell Svelte sẽ cực nhỏ (~400 dòng).
2. **Jotai + `jotai-scope`** — 56 call site × 35 file × 2 scoped store. Kiến trúc state phải chốt **một lần**, không quyết định từng chỗ.
3. **Tunnel-rat (9 tunnel)** — mẫu teleport render hữu ích (MainMenu, Footer, WelcomeScreen, Sidebar trigger…). Cần chuyển sang `{#snippet}` + context.
4. **`actions/manager.tsx`** — hệ action tập trung, khá nhiều action gọi Dialog. Port thận trọng.
5. **`Collab.tsx` import đường dẫn sâu** — `@excalidraw/excalidraw/components/ErrorDialog`. Khi port, cần thiết kế lại public subpath exports.
6. **`createIcon()` trong `icons.tsx`** — trả về React element trực tiếp. Cần strategy riêng cho icon system Svelte (xem §5.6).
7. **`useTransition` / `useDeferredValue`** dùng ở `LibraryMenuSection`, `MermaidToExcalidraw` — Svelte 5 không có tương đương. Thay bằng `queueMicrotask` + `$effect` hoặc `requestIdleCallback`.
8. **`flushSync` từ `react-dom`** trong `App.tsx` — Svelte 5 có `flushSync()` trong package `svelte`; may mắn.
9. **`@testing-library/react` `act()`** — khi port test: `@testing-library/svelte` + `await tick()` từ `svelte`.

---

## 2. Ba quyết định phải chốt trước khi code

| # | Quyết định | Mặc định đề xuất | Lý do | Hệ quả nếu chọn ngược |
|---|---|---|---|---|
| **A** | SvelteKit (v2) ở chế độ SPA (`adapter-static`, `ssr=false`) hay Svelte 5 + Vite thuần? | **SvelteKit chế độ SPA** | Tên repo `sveltedraw` + yêu cầu người dùng là SvelteKit. Canvas app không hưởng lợi từ SSR, nhưng SvelteKit cho routing, layout, preloading, PWA integration chuẩn. | Nếu Svelte thuần: tiết kiệm 3–4 ngày setup, nhưng mất route-level code-split, phải tự dựng PWA. |
| **B** | Giữ khả năng cherry-pick upstream `excalidraw/excalidraw` không? | **Không (fork cứng)** | Port UI = diff không thể cherry-pick được nữa cho phần React. Phần core (`packages/common/element/math/utils/renderer/scene`) có thể vẫn pull upstream. | Nếu muốn giữ upstream đầy đủ: plan này không khả thi — nên chỉ làm Phase 2 (extraction) và dừng. |
| **C** | Xuất bản lib `@sveltedraw/excalidraw` song song + parity `ExcalidrawImperativeAPI`? | **Chỉ build app. Chưa làm lib.** | Parity API cho lib consumer tốn ~1.5× công sức, phải maintain docs + examples. | Nếu chọn có: thêm ~4–6 tuần. `examples/with-nextjs`, `examples/with-script-in-browser` cần phiên bản Svelte; `dev-docs` (Docusaurus) cần cập nhật hoặc bỏ. |

**Câu hỏi phụ cần chốt ở Phase 0:**
- D. Giữ `examples/with-nextjs` và `examples/with-script-in-browser` không? (Nếu quyết định C = Không → xoá.)
- E. `dev-docs` (Docusaurus) — xoá, giữ nguyên, hay port sang MDsveX/`@sveltejs/adapter-static`? (Khuyến nghị: giữ nguyên Docusaurus — nó độc lập.)
- F. `index-node.ts` (Node canvas rendering) — còn ai dùng không? Nếu có → giữ, nhưng đổi import path sau khi restructure. Nếu không → xoá.
- G. Lộ trình rollout: cutover cứng (1 ngày chuyển đổi) hay dual-route chạy song song (`/react` + `/svelte`) rồi flip DNS?

---

## 3. Bảng mapping React → Svelte 5

### 3.1 Primitive mapping

| React | Svelte 5 | Ghi chú |
|---|---|---|
| `useState` | `let x = $state(...)` | Runes tự động deep reactive. |
| `useMemo`, derived | `let y = $derived(...)` / `$derived.by(() => ...)` | Hàm lười — chỉ chạy khi đọc. |
| `useEffect(fn, deps)` | `$effect(() => { ...; return cleanup })` | Svelte tracking deps ngầm; không có array deps. |
| `useLayoutEffect` | `$effect.pre(...)` | Chạy trước DOM commit. |
| `useRef` (DOM element) | `let el = $state<HTMLElement>(); ... bind:this={el}` | |
| `useRef` (mutable) | `let r = { current: ... }` plain object | |
| `useCallback` | Bỏ. Hàm trong module scope đã stable. | |
| `useReducer` | state object + hàm dispatch trong class/module | Không có rune tương đương |
| `React.Context` + `useContext` | `setContext(key, val)` / `getContext(key)` | Truyền qua cây component — phải nằm trong `onMount`/setup. |
| `forwardRef` | Export action/props từ component; consumer bind qua `$bindable()` hoặc lấy qua context | Svelte 5 `bind:this` trả về DOM element, không trả instance. |
| `createPortal(node, target)` | Package `svelte-portal` hoặc `mount()` từ `svelte` vào DOM khác | Chỉ 2 call site, viết tay cũng được. |
| `Suspense` / `React.lazy` | `await import(...)` + `{#await}` | Không dùng trong Excalidraw hiện tại. |
| React 19 class component | `.svelte` + runes; logic không UI tách module TS | Chỉ `App.tsx` là class. |
| `flushSync(cb)` (react-dom) | `flushSync(cb)` từ `svelte` | 1-1. |
| `useTransition`/`startTransition` | Không có. Dùng `queueMicrotask` hoặc `requestIdleCallback` bọc tay | 2 call site, thay rẻ. |
| `useDeferredValue(v)` | Tự viết: `$derived` + `$effect` hoãn bằng `setTimeout(0)` | 1 call site. |
| `React.memo` | Không cần — Svelte render theo dep granularity. | |
| `children` prop | `{@render children?.()}` + snippet | Svelte 5 thay slot bằng snippet. |
| Named slots | `{#snippet name()}...{/snippet}` + `{@render name()}` | |
| Higher-order component (HOC) | Thường viết lại bằng snippet hoặc wrapper component | `withInternalFallback.tsx` cần port cẩn thận. |
| Error boundary (`componentDidCatch`) | `<svelte:boundary onerror={...}>` (Svelte 5.3+) hoặc `+error.svelte` (SvelteKit) | `TopErrorBoundary.tsx` chỉ 1 chỗ. |
| `React.createElement` (imperative) | `mount()` / `unmount()` từ `svelte` | |

### 3.2 State & ecosystem mapping

| React ecosystem | Thay thế | Lý do / chi phí |
|---|---|---|
| `jotai` (`atom()`, `useAtom`) | **Custom rune store**: module-level class với `$state` + method | Thuần, ít boilerplate. |
| `jotai-scope` (`Provider` scope) | **Context-based store factory**: `createStore()` + `setContext('key', store)` | Xem §5.1. |
| `tunnel-rat` | **Snippet + context**: declare snippet, lưu vào context, render ở nơi khác | 1 file, 9 tunnel — viết 1 helper nhỏ. |
| `radix-ui` (Popover, DropdownMenu, Tabs) | **`bits-ui`** | 1-1, cùng mental model headless primitive. |
| `@testing-library/react` | **`@testing-library/svelte`** + `@testing-library/dom` + `@testing-library/jest-dom` | 13 file phải port. |
| `vitest-canvas-mock` | Giữ nguyên | Không phụ thuộc React. |
| `react-i18next` (không dùng) | **Custom**: chuyển `i18n.ts` (vốn dùng jotai) sang rune store + JSON loader | Giữ nguyên `locales/*.json` và `crowdin.yml`. |
| `@sentry/browser` | Giữ nguyên | Framework-agnostic. |
| `@codemirror/*` | Giữ nguyên | TTDDialog dùng — chỉ thay shell. |
| `@excalidraw/laser-pointer`, `@excalidraw/mermaid-to-excalidraw` | Giữ nguyên | Không phụ thuộc React. |
| `roughjs`, `perfect-freehand`, `points-on-curve` | Giữ nguyên | Canvas libs. |
| `browser-fs-access`, `pako`, `nanoid`, `clsx`, `fractional-indexing` | Giữ nguyên | |
| `pepjs` polyfill | Giữ nguyên | Import ở `polyfill.ts`. |
| `vite-plugin-pwa` | Giữ nguyên | Chạy được với SvelteKit. |
| `vite-plugin-svgr` (React SVG as component) | **Không cần** — không phát hiện import SVG-as-component. Nếu sau này cần: dùng `@poppanator/sveltekit-svg` hoặc import SVG raw + `{@html}`. | |
| `vite-plugin-ejs`, `vite-plugin-html` | Giữ nguyên hoặc bỏ — SvelteKit có `app.html` template riêng | |
| `vite-plugin-sitemap` | Giữ nguyên (dùng cho excalidraw.com) | |
| `@vitejs/plugin-react` | Bỏ | |
| `eslint-config-react-app`, `eslint-plugin-react` | Thay bằng `eslint-plugin-svelte` | |

### 3.3 Svelte 5 gotchas (cần cảnh báo đội dev)

- **Runes chỉ hoạt động trong file `.svelte` hoặc `.svelte.ts`**. File `.ts` thường không có runes.
- **`$state` là proxy đệ quy** — gán object lớn có thể đắt; với collection lớn (elements map) dùng `$state.raw()`.
- **Reactivity không dựa trên dependency array**. `$derived` tracking implicit theo hàm đọc — giống SolidJS.
- **`bind:this={el}` trên component** trả về `undefined` — phải dùng `$bindable` props hoặc export từ component.
- **Snippet không phải slot**. Slot cũ bị deprecate — refactor kỹ `children`.
- **HMR state preservation** khác React Fast Refresh — ít ổn định hơn; khuyên rebuild full khi đổi shape state.
- **Không có SSR** — quyết định A = Svelte 5 + Vite thuần, không có SvelteKit, không có `onMount`-vs-SSR friction.
- **Không có re-render scope** — mọi thay đổi state rune đều được Svelte compiler trace tĩnh tới DOM operation cụ thể.

---

## 4. Toolchain

### 4.1 Giữ nguyên
Vite **v6** (nâng từ v5 — chỉ trong `sveltedraw-app`; `excalidraw-app` React giữ Vite 5), Vitest, SCSS (`sass`), `vite-plugin-pwa`, `vite-plugin-sitemap`, `jsdom`, `vitest-canvas-mock`, tất cả dependency canvas/domain (roughjs, perfect-freehand, @codemirror, @excalidraw/laser-pointer, @excalidraw/mermaid-to-excalidraw, browser-fs-access, nanoid, pako, clsx, pepjs).

### 4.2 Thêm mới
- `svelte` v5
- `@sveltejs/vite-plugin-svelte` v5 (yêu cầu Vite 6)
- `svelte-check`
- `bits-ui` (Popover, DropdownMenu, Tabs)
- `@testing-library/svelte`
- `eslint-plugin-svelte`, `prettier-plugin-svelte`
- `svelte-portal` (hoặc viết tay — rất đơn giản)

### 4.3 Bỏ
`react`, `react-dom`, `@types/react*`, `@vitejs/plugin-react`, `@testing-library/react`, `jotai`, `jotai-scope`, `tunnel-rat`, `radix-ui`, `eslint-plugin-react`, `eslint-config-react-app`, `vite-plugin-svgr`, `@sveltejs/kit`, `@sveltejs/adapter-static` (không dùng SvelteKit — quyết định A).

### 4.4 Giữ có điều kiện
- `jotai`: giữ trong giai đoạn Phase 1–5 nếu dùng adapter dual-read giữa React và Svelte. Bỏ ở Phase 9.
- `vite-plugin-ejs`, `vite-plugin-html`: bỏ — Svelte app dùng `index.html` Vite thuần, không cần EJS template.

### 4.5 Build system
- Hiện tại packages build bằng **esbuild** (`scripts/buildPackage.js`); app build bằng **Vite**.
- Sau port (C = Không publish lib): bỏ esbuild package build riêng, Vite bundling tất cả qua workspace alias trực tiếp từ source TS.
- `scripts/woff2/*`, `buildWasm.js`, `build-node.js`: giữ nguyên (`build-node.js` phục vụ `index-node.ts` — quyết định F = giữ).

### 4.6 CI
11 workflow ở `.github/workflows/`:
- `lint.yml`, `test.yml`, `test-coverage-pr.yml`: update để chạy `svelte-check` + Vitest với Svelte.
- `size-limit.yml`: cập nhật size budget cho bundle mới.
- `build-docker.yml`, `publish-docker.yml`: cập nhật `Dockerfile` nếu đường dẫn build thay đổi.
- `autorelease-excalidraw.yml`: bỏ (nếu không publish npm lib) hoặc cập nhật.
- `sentry-production.yml`, `locales-coverage.yml`, `semantic-pr-title.yml`, `cancel.yml`: phần lớn không ảnh hưởng.

---

## 5. Thực thi theo giai đoạn

Nguyên tắc: mỗi PR merge được vào `master` mà **không vỡ app React đang chạy** ở hai đầu:
1. Phase 0–2 không chạm React runtime (chỉ thêm thư mục mới / refactor không chức năng mới).
2. Phase 3–6 chạy song song app React + app Svelte (dual route) trong cùng Vite dev server.
3. Phase 9 dọn dẹp sau khi Svelte đạt parity.

### 5.1 Phase 0 — Thiết lập (1–2 tuần)

**Deliverable:**
- `sveltedraw-app/` mới (SvelteKit v2, Svelte 5, `adapter-static`, `ssr=false` cho route editor).
- Route `/editor` trả về `<h1>hello</h1>`, chạy được `yarn --cwd sveltedraw-app dev`.
- Thêm `packages/excalidraw-svelte/` (rỗng, có `package.json`, `vite.config.ts` lib mode, `tsconfig.json`).
- Alias workspace cho `@excalidraw/{common,element,math,utils}` trong Vite config mới (sao chép từ `excalidraw-app/vite.config.mts`).
- Dựng showcase `/_showcase` render 3 primitive `bits-ui`: Popover, DropdownMenu, Tabs — so sánh visual với bản radix.
- Update `.github/workflows/test.yml` để chạy `svelte-check` trên `sveltedraw-app`.
- Update `CLAUDE.md` ghi chú cấu trúc mới.

**Definition of Done:**
- [ ] `yarn start` (React app) vẫn chạy bình thường trên port 3000.
- [ ] `yarn --cwd sveltedraw-app dev` chạy trên port 3001.
- [ ] `svelte-check` pass.
- [ ] Showcase `bits-ui` render đúng cho 3 primitive.

### 5.2 Phase 1 — Kiến trúc state (1 tuần)

**Deliverable:**
- Viết `packages/excalidraw-svelte/src/state/createEditorStore.ts`:
  ```ts
  export function createEditorStore() {
    const appState = $state<AppState>({ ... });
    return {
      get appState() { return appState; },
      setAppState(patch: Partial<AppState>) { Object.assign(appState, patch); },
      // ... các sub-store: convertElementTypePopupAtom, etc.
    };
  }
  ```
- `setContext('editor', createEditorStore())` ở App component.
- Helper `useEditorStore()` = `getContext('editor')`.
- Nếu chọn dual-codebase với jotai compat: viết `jotaiCompat.ts` bridge — atom vẫn là source of truth cho React, Svelte subscribe qua `store.sub()`. **Chi phí:** ~3 ngày, cho phép port từng component mà không phải port state layer cùng lúc.
- PoC: port `ColorInput.tsx` (jotai 3 call site + forwardRef) sang `ColorInput.svelte`, nghiệm thu toàn bộ pattern.

**Definition of Done:**
- [ ] `ColorInput.svelte` chạy với state đọc/ghi đúng.
- [ ] Test suite ColorPicker cho React vẫn pass (không vỡ).
- [ ] Tài liệu pattern viết vào `docs/svelte-state-guide.md`.

### 5.3 Phase 2 — Trích xuất engine khỏi `App.tsx` (3–5 tuần, LÀM TRONG REACT)

**Mục tiêu:** đưa `App.tsx` từ 12,838 dòng xuống <3,000. Lợi ích đứng riêng: codebase React cũng sạch hơn, test dễ hơn, có giá trị cả khi dừng port.

Gom ~116 method sau `render()` thành module TS thuần theo nhóm:

| Module mới | Method thuộc nhóm |
|---|---|
| `packages/excalidraw/engine/pointerEvents.ts` | `handlePointerDown`, `handlePointerMove`, `handlePointerUp`, `onPointerMoveFromPointerDownHandler`, `handleCanvasPointerMove`, `handleTapTwice`, `handleCanvasContextMenu`, … |
| `packages/excalidraw/engine/keyboardEvents.ts` | `onKeyDown`, `onKeyUp`, `handleKeyboardGlobally`, `onKeyDownFromPointerDownHandler`, … |
| `packages/excalidraw/engine/selectionOps.ts` | `selectShapesForSelectionElement`, `handleSelectionOnPointerDown`, … |
| `packages/excalidraw/engine/bindingOps.ts` | `updateBindingEnabledOnPointerMove`, `maybeBindLinearElement`, … |
| `packages/excalidraw/engine/clipboardOps.ts` | `pasteFromClipboard`, `copyToClipboard`, … |
| `packages/excalidraw/engine/imageOps.ts` | `insertImageElement`, `initializeImage`, `fetchImageElements`, … |
| `packages/excalidraw/engine/libraryOps.ts` | `updateLibrary`, `onLibraryChange`, … |
| `packages/excalidraw/engine/exportOps.ts` | `canvasClicked`, liên quan export |
| `packages/excalidraw/engine/collabBridge.ts` | `setCollaborators`, `updateScene`, `onPointerUpdate`, … |
| `packages/excalidraw/engine/gestureOps.ts` | touch, pinch, laser pointer |
| `packages/excalidraw/engine/linearEditorOps.ts` | linear element editor handlers |
| `packages/excalidraw/engine/frameOps.ts` | frame manipulation |
| `packages/excalidraw/engine/scrollOps.ts` | scroll/zoom/viewport |
| `packages/excalidraw/engine/hyperlinkOps.ts` | link popover, embed |

Mỗi module nhận `{ getState, setState, scene, actionManager, history, ... }` qua 1 object "context" → class vẫn thin-wrap các hàm này:

```ts
// trong App class sau khi trích:
private handlePointerDown = (e: PointerEvent) =>
  pointerEvents.handlePointerDown(this.getEngineContext(), e);
```

**Quy trình 1 PR/module:**
1. Tạo module mới, copy logic, chuyển `this.x` → `ctx.x`.
2. Trong `App.tsx` thay call site bằng delegate.
3. Chạy full test suite (`yarn test:all`).
4. Chỉ merge khi 100% test pass, snapshot không đổi.

**Definition of Done:**
- [ ] `App.tsx` ≤ 3,000 dòng.
- [ ] `packages/excalidraw/engine/` có ≥10 module.
- [ ] Toàn bộ `tests/` pass, không regenerate snapshot.
- [ ] Bundle size không tăng quá +3%.

### 5.4 Phase 3 — Port component "lá" (3–4 tuần, song song)

Component không có state riêng ngoài props. Đội có thể chia nhiều người làm song song.

**Batch 3.1 — Primitive UI:**
Button, ButtonIcon, ButtonIconCycle, ButtonSeparator, CheckboxItem, Switch, Range, TextField, RadioSelection, Spinner, Tooltip, Stack, Island, Section, Paragraph, Avatar, InlineIcon, Ellipsify, FilledButton, DialogActionButton, LinkButton, HelpButton, FixedSideContainer, Card, ScrollableList, Popover (wrapper), CircleButton, ToggleButton.

**Batch 3.2 — Radix-based primitives:**
Dialog, Modal (+ viết lại `createPortal` → `mount`), ContextMenu, ConfirmDialog, ErrorDialog, Toast, IconPicker, ToolPopover, PropertiesPopover, UserList (Popover), DropdownMenu subtree (13 file trong `dropdownMenu/`).

**Batch 3.3 — Icons system:**
- Quyết định: **tách `icons.tsx` thành `icons/<name>.svelte`** (một component per icon) hoặc **`icons.ts` trả về SVG markup string + `{@html}`**.
- Khuyến nghị: string-based cho simplicity và tree-shake tốt. ~300 icon → script codegen từ `icons.tsx` (parse AST, xuất SVG string).
- Viết wrapper `<Icon svg={...} size={...} mirror={...} />`.

**Definition of Done mỗi batch:**
- [ ] Component có visual parity với React version (so trong showcase route).
- [ ] Test unit Svelte pass (viết lại từ `.test.tsx` tương ứng, nếu có).
- [ ] Không còn import của component đó từ React side (sau khi shell Svelte ra đời ở Phase 6).

### 5.5 Phase 4 — Component phức hợp (4–6 tuần)

Các khu vực có state phức tạp + nhiều sub-component:

- `ColorPicker/*` (8 file, jotai nặng — dùng làm PoC Phase 1).
- `Stats/*` (4 file, drag input, multi-dimension).
- `CommandPalette/*`.
- `FontPicker/*` (+ `FontPickerList`).
- `Sidebar/*` (jotai + radix Tabs + tunnel-rat).
- `TTDDialog/*` (CodeMirror + Chat — giữ nguyên `@codemirror/*`, chỉ port shell).
- `main-menu/*`, `welcome-screen/*`, `footer/*`.
- `hyperlink/*` (Popover + input).
- `live-collaboration/*`.
- `Library*` (LibraryMenu, LibraryUnit, LibraryMenuItems, PublishLibrary, LibraryMenuSection — có `useTransition`; thay bằng `requestIdleCallback`).
- `OverwriteConfirm/*`.
- `ImageExportDialog`, `JSONExportDialog`, `PasteChartDialog`, `ShareableLinkDialog`, `HelpDialog`, `ElementLinkDialog`.
- `SearchMenu`, `QuickSearch`.
- `MobileMenu`, `MobileToolBar`.
- `EyeDropper` (+ `createPortal` thứ 2).
- `Actions.tsx`, `ConvertElementTypePopup`, `HintViewer`, `PenModeButton`, `LockButton`, `HandButton`, `LaserPointerButton`, `MagicButton`, `ShapesSwitcher`.
- `hoc/withInternalFallback` — port thành snippet-based utility.
- Tunnel-rat: viết lại `context/tunnels.ts` bằng `{#snippet}` + context. Giữ API tương đương (9 tunnel).

**Definition of Done phase:**
- [ ] Tất cả Dialog + Popover có thể mở/đóng, focus trap, ESC close đúng.
- [ ] Keyboard shortcut hoạt động (Cmd+P, Cmd+K, …).
- [ ] Test Svelte cover ≥80% logic port.

### 5.6 Phase 5 — Canvas wrappers + LayerUI (2 tuần)

- `StaticCanvas.svelte`, `InteractiveCanvas.svelte`, `NewElementCanvas.svelte`: wrapper mỏng gọi trực tiếp renderer. Chú ý:
  - `bind:this={canvasEl}` thay `ref`.
  - Render loop không đổi (renderer TS thuần).
  - Devicepixelratio / resize — dùng `$effect` + `ResizeObserver`.
- `LayerUI.svelte`: layout chính, ~600+ dòng. Port cẩn thận — có 9 JSX return block cần tách snippet con.
- `SVGLayer.svelte` (overlay SVG).

**Definition of Done:**
- [ ] Render 1,000 element ở 60fps (đo bằng Chrome devtools).
- [ ] Zoom/pan mượt.
- [ ] Layer UI responsive ở breakpoint mobile.

### 5.7 Phase 6 — App shell (3–5 tuần, mốc rủi ro cao nhất)

- `App.svelte`: kết hợp state context + engine module từ Phase 2.
- Chuyển 124 method (đã tách) thành handler:
  - Event binding qua `on:pointerdown={handler}` hoặc `$effect(() => window.addEventListener(...))`.
  - Lifecycle: `onMount` thay `componentDidMount`, `$effect` cleanup thay `componentWillUnmount`.
- `ExcalidrawImperativeAPI`:
  - Vì Svelte 5 không có "component instance" public method API, viết API như object: `const api = useEditorApi(store)` rồi expose qua callback `onExcalidrawAPI(api)`.
  - Nếu quyết định C = Không: skip parity, chỉ giữ tối thiểu cho `excalidraw-app` cần.
- `textWysiwyg.tsx` → `textWysiwyg.ts` — bỏ `react-dom` imports (chỉ dùng cho mount contenteditable), thay bằng DOM API thuần.
- `polyfill.ts`: giữ nguyên.
- `actions/manager.tsx` → `actions/manager.ts` + chỗ render Dialog chuyển sang compose ở LayerUI.

**Definition of Done:**
- [ ] Route `/editor-svelte` render full app, vẽ được tất cả tool (rectangle, arrow, text, freehand, image).
- [ ] Undo/redo hoạt động.
- [ ] Export PNG/SVG/clipboard hoạt động.
- [ ] Performance không regress quá 5% so với React bản cùng commit.

### 5.8 Phase 7 — App layer (2–3 tuần)

- `excalidraw-app/App.tsx` → `sveltedraw-app/src/routes/+page.svelte` (~1,287 dòng React, nhưng logic mỏng, chủ yếu wiring).
- `collab/Collab.tsx` → `Collab.svelte` (socket.io-client, firebase sync — giữ nguyên, chỉ thay UI). **Chú ý**: resolve import sâu `@excalidraw/excalidraw/components/ErrorDialog` bằng public entry point mới.
- `share/ShareDialog.tsx`, `components/{AppFooter,AppMainMenu,AppSidebar,AppWelcomeScreen,DebugCanvas,ExcalidrawPlusPromoBanner,ExportToExcalidrawPlus,AI,EncryptedIcon}.tsx` → `.svelte`.
- `TopErrorBoundary.tsx` → `+error.svelte` (SvelteKit) hoặc `<svelte:boundary>`.
- `data/*`: giữ nguyên (TS thuần).
- `app-language/*`: chuyển `language-state.ts` sang rune store. `LanguageList.tsx` → `.svelte`.
- `useHandleAppTheme.ts` → `useHandleAppTheme.svelte.ts` (runes trong file `.svelte.ts`).
- `sentry.ts`: giữ nguyên.
- Route thêm: `/room/:id` cho collab link.

**Definition of Done:**
- [ ] Collab join qua link hoạt động.
- [ ] Save/load từ local storage hoạt động.
- [ ] Share dialog generate link.
- [ ] i18n switch ngôn ngữ hoạt động (thử 3–5 locale).

### 5.9 Phase 8 — Tests (song song Phase 3–7, 3–4 tuần)

**Chiến lược:**

| Loại test | Số lượng | Chiến lược |
|---|---|---|
| Logic-only `.ts` test (clipboard, history, math, element, scene, data, …) | đa số | **Không đổi**. |
| `.test.tsx` chủ yếu dùng `render()` + DOM query | 13 | **Rewrite sang `@testing-library/svelte`**. Assertion (`screen.getByRole`, `fireEvent`) dịch mechanical. |
| Snapshot test | 9 `__snapshots__` folder | **Regenerate**. Svelte DOM khác React (không có `data-reactroot`, hydration markers). Verify bằng eye diff + golden review. |
| `act()` / async state | rải rác | Thay bằng `await tick()` (`svelte`) hoặc `await flushSync()`. |
| E2E | chưa có | **Thêm Playwright smoke**: draw rectangle, save, reload, verify. Đỡ cost rewrite hàng chục unit test UI. |

**Definition of Done:**
- [ ] Toàn bộ test logic pass.
- [ ] ≥90% test UI đã được port hoặc có Playwright tương đương.
- [ ] Coverage không tụt quá 10% so với baseline.

### 5.10 Phase 9 — Dọn dẹp (1–2 tuần)

- Xoá `packages/excalidraw/` React (hoặc rename `@excalidraw/excalidraw-react-legacy` nếu quyết định B cho phép).
- Xoá `excalidraw-app/` React.
- Bỏ `react`, `react-dom`, `@types/react*`, `jotai`, `jotai-scope`, `tunnel-rat`, `radix-ui`, `@vitejs/plugin-react`, `@testing-library/react`, `eslint-plugin-react`, `eslint-config-react-app`, `vite-plugin-svgr` (nếu không dùng).
- Cập nhật `package.json` root: scripts trỏ `sveltedraw-app`.
- Cập nhật `Dockerfile`, `docker-compose.yml`, `vercel.json`.
- Cập nhật `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`.
- Xoá/port `examples/with-nextjs`, `examples/with-script-in-browser` theo quyết định D.
- Cập nhật `dev-docs` `@excalidraw/excalidraw` dependency theo quyết định E.
- Update CI workflows hoàn tất.

**Definition of Done:**
- [ ] `grep -r "from ['\"]react['\"]" .` chỉ còn trong node_modules.
- [ ] `yarn build` chạy sạch, bundle production < baseline + 10%.
- [ ] Lighthouse PWA pass (giống bản React).
- [ ] Tag release `v1.0.0-svelte`.

---

## 6. Rủi ro & biện pháp (đã rà soát lại)

| Rủi ro | Mức | Tác động | Biện pháp |
|---|---|---|---|
| `App.tsx` 12.8k dòng | **Giảm từ Cao xuống Trung** (vì JSX chỉ 3%) | Thời gian port shell | Phase 2 extraction bắt buộc trước Phase 6; acceptance ≤3k dòng class trước khi port |
| `jotai-scope` nested scope | Trung | Semantics state sai → bug khó tìm | PoC context-store ở Phase 1; nghiệm thu trên ColorPicker |
| Parity `ExcalidrawImperativeAPI` | Trung–Cao (nếu C=Có) | Breaking cho lib consumer | Chỉ hứa nếu quyết định C=Có. Viết parity test từ `events.test.tsx` |
| Event pipeline (pointer/keyboard/pressure/touch) | **Cao** | Regression input UX | Pin `pepjs`; `$effect` với capture phase; Playwright trace test cho draw/select/pan |
| Canvas render loop perf | Thấp | FPS | Renderer TS thuần không đổi; đo FPS trước/sau ở Phase 6 |
| Upstream drift trong lúc port | Cao | Conflict merge | Chốt quyết định B. Nếu giữ upstream: chỉ làm Phase 2 |
| Test rewrite cost | Trung | 13 `.test.tsx` + snapshots | Ưu tiên Playwright smoke thay vì 1-1 port |
| **Svelte 5 HMR ổn định** | Trung | Dev experience | Chấp nhận rebuild full khi đổi shape state; document |
| **`flushSync` behavior khác** | Thấp | Sync state update | Svelte 5 có `flushSync()` — tương đương, test kỹ App.tsx chỗ gọi |
| **`useTransition` / `useDeferredValue` thiếu** | Thấp | `LibraryMenuSection` render chậm | Dùng `requestIdleCallback` chunked render |
| **Icon system (300+ icon)** | Trung | Volume lớn | Codegen script từ `icons.tsx` |
| **Snapshot diff sau port** | Trung | Tốn thời gian review | Regenerate 9 folder __snapshots__, review diff trong PR chuyên biệt |
| **PWA + service worker** | Thấp | PWA offline | Dùng `vite-plugin-pwa` standalone (không cần SvelteKit adapter) — verify ở Phase 7 |
| **Global event listener duplicate trong HMR** | Trung | Memory leak trong dev | `$effect` luôn return cleanup; kiểm tra `performance.memory` |
| **Import đường dẫn sâu (`@excalidraw/excalidraw/components/ErrorDialog`)** | Trung | Breaking khi restructure | Thiết kế lại subpath exports ở Phase 6 |
| **Text WYSIWYG contenteditable** | Trung | Text edit bug tinh vi | Port `textWysiwyg.tsx` muộn, test kỹ RTL, IME, paste |

---

## 7. Ước lượng effort

Cơ sở: 195 `.tsx` lib + 20 `.tsx` app + 12.8k-line App class + state arch + test rewrite + tooling/CI/cutover.

| Cấu hình | Thời gian |
|---|---|
| **1 senior engineer full-time** | 5–8 tháng |
| **2 người** (1 state+shell, 1 component) | 3–5 tháng |
| **3 người** (+ 1 test/tooling/PWA) | 2.5–3.5 tháng |

**Breakdown xấp xỉ (người-tuần):**

| Phase | Người-tuần |
|---|---|
| 0. Setup | 1–2 |
| 1. State arch | 1 |
| 2. Engine extraction | 3–5 |
| 3. Leaves (195 .tsx × ~1h/leaf) | 5–8 |
| 4. Compound | 4–6 |
| 5. Canvas + LayerUI | 2 |
| 6. App shell | 3–5 |
| 7. App layer | 2–3 |
| 8. Tests | 3–4 |
| 9. Cleanup | 1–2 |
| **Tổng** | **25–38** (= 6–9.5 tháng người) |

Phase 2 (~3–5 tuần) có thể bắt đầu ngay, giá trị đứng riêng cả khi dừng port sau đó.

---

## 8. Cutover & rollout

**Chiến lược đã chốt: Hard cutover lên `draw.hodion.com`**

Khi Svelte app đạt feature parity (Phase 6 DoD pass), deploy thẳng:

1. `yarn --cwd sveltedraw-app build` → `dist/`
2. Upload lên hosting (Vercel / Cloudflare Pages / VPS) cho domain `draw.hodion.com`
3. Không cần feature flag, không cần dual-route

**Checklist trước cutover:**
- [ ] Tất cả tool draw hoạt động (rectangle, arrow, text, freehand, image, frame)
- [ ] Undo/redo đúng
- [ ] Export PNG/SVG/clipboard đúng
- [ ] LocalStorage save/load đúng (schema không đổi so với React version)
- [ ] Collab join qua link hoạt động (nếu dùng)
- [ ] Lighthouse PWA score ≥ 90
- [ ] Sentry init đúng với `release` tag mới

**Rollback plan:** Giữ `excalidraw-app` (React) build sẵn trong 30 ngày sau cutover. Nếu cần rollback: point DNS về React build cũ < 5 phút.

**Giám sát sau cutover:**
- Sentry cho Svelte build (`release` tag khác React).
- Metric: crash rate, FPS scene lớn (>1000 element), load time, export success rate.

---

## 9. Phạm vi ngoài port (không port, xử lý riêng)

- **`dev-docs/` (Docusaurus React)**: giữ nguyên — port sau khi app ổn định (quyết định E).
- **`firebase-project/`**: rules + config, không code React.
- **`examples/*`**: viết lại bằng Svelte (quyết định D) — làm ở Phase 9.
- **`scripts/`**: Node-only. Cập nhật path nếu thay đổi. `build-node.js` phục vụ `index-node.ts`.
- **`packages/excalidraw/index-node.ts`**: giữ nguyên (quyết định F).
- **Crowdin integration (`crowdin.yml`)**: không đổi — `locales/*.json` giữ nguyên.

---

## 10. Bước tiếp theo

1. ~~Chốt 7 quyết định~~ — **DONE** (2026-04-21).
2. ~~Phase 0 setup~~ — **DONE**: `sveltedraw-app/` Svelte 5 + Vite, `packages/excalidraw-svelte/` stub, `svelte-check` 0 errors.
3. ~~Phase 2 analysis~~ — **DONE**: `ENGINE_EXTRACTION_PLAN.md` với 22 module, AppEngineContext interface, thứ tự extraction.
4. **Phase 2a đang mở** — bắt đầu extract `scrollOps` (ít phụ thuộc nhất, blueprint cho các module sau).
5. **Phase 1 song song** — thiết kế `createEditorStore()` + PoC `ColorInput.svelte`.
6. Sau Phase 1 PoC pass → viết `docs/porting-guide.md` với code examples cụ thể.
