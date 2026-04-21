# React → Svelte 5 Porting Guide

This guide documents the patterns used to port the Excalidraw React codebase
to Svelte 5.  Use it as a reference when porting new components.

---

## Table of Contents

1. [jotai atom → Svelte 5 store field](#1-jotai-atom--svelte-5-store-field)
2. [useAtom / useAtomValue / useSetAtom → getContext](#2-useatom--useatomvalue--usesetatom--getcontext)
3. [jotai-scope isolation → createEditorStore per instance](#3-jotai-scope-isolation--createeditorstore-per-instance)
4. [Imperative jotai store access (get/set outside components)](#4-imperative-jotai-store-access-getset-outside-components)
5. [forwardRef → bind:this or $bindable](#5-forwardref--bindthis-or-bindable)
6. [React.ReactNode children → Snippet](#6-reactreactnode-children--snippet)
7. [Event handlers](#7-event-handlers)
8. [className → class](#8-classname--class)
9. [Inline style objects → style string](#9-inline-style-objects--style-string)
10. [useState + useEffect(sync) → $state + $effect](#10-usestate--useeffectsync--state--effect)
11. [useEffect cleanup (unmount) → $effect returning cleanup](#11-useeffect-cleanup-unmount--effect-returning-cleanup)
12. [React context (non-jotai) → Svelte context](#12-react-context-non-jotai--svelte-context)
13. [React JSX icons → inlined SVG](#13-react-jsx-icons--inlined-svg)
14. [Known limitations & TODOs](#14-known-limitations--todos)

---

## 1. jotai atom → Svelte 5 store field

Every `atom()` in the React codebase becomes a **private `$state` field** inside
`createEditorStore()` or `createAppStore()`.  A getter + setter are exposed on
the returned object so consumers cannot bypass reactivity.

**React (jotai)**

```ts
// colorPickerUtils.ts
import { atom } from "../../editor-jotai";

export const activeColorPickerSectionAtom =
  atom<ActiveColorPickerSectionAtomType>(null);
```

**Svelte 5 equivalent** (`editorStore.svelte.ts`)

```ts
export function createEditorStore() {
  // private reactive state — one field per former atom
  let activeColorPickerSection = $state<ActiveColorPickerSection>(null);

  return {
    get activeColorPickerSection() {
      return activeColorPickerSection;
    },
    setActiveColorPickerSection(v: ActiveColorPickerSection) {
      activeColorPickerSection = v;
    },
  };
}
```

Key points:
- File extension **must** be `.svelte.ts` (not `.ts`) to enable Svelte runes
  in a plain TypeScript module.
- Use `get` property accessors on the returned object to preserve reactivity —
  if you return plain values they lose their reactive link.
- For atoms that needed an *updater function* (i.e. `setAtom(prev => ...)`)
  expose a setter that accepts `T | ((prev: T) => T)`.  The `applyUpdate`
  helper already handles this in the store files.

---

## 2. useAtom / useAtomValue / useSetAtom → getContext

**React**

```tsx
import { useAtom } from "../../editor-jotai";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { activeEyeDropperAtom } from "../EyeDropper";

const [activeSection, setActiveSection] = useAtom(activeColorPickerSectionAtom);
const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);
```

**Svelte 5**

```svelte
<script lang="ts">
  import { getContext } from "svelte";
  import { EDITOR_STORE_KEY } from "../../state/index.js";
  import type { EditorStore } from "../../state/index.js";

  const editorStore = getContext<EditorStore>(EDITOR_STORE_KEY);

  // Reading (reactive, like useAtomValue):
  const activeSection = $derived(editorStore.activeColorPickerSection);

  // Reading + writing (like useAtom):
  const eyeDropperState = $derived(editorStore.activeEyeDropper);
  // write:
  editorStore.setActiveEyeDropper(null);
</script>
```

Mapping table:

| React hook | Svelte 5 pattern |
|---|---|
| `useAtomValue(atom)` | `$derived(store.field)` |
| `useSetAtom(atom)` | `store.setSomeField(v)` |
| `useAtom(atom)` | `$derived(store.field)` + `store.setField(v)` |

---

## 3. jotai-scope isolation → createEditorStore per instance

In React, `jotai-scope`'s `createIsolation()` gives each `<Excalidraw>` mount
a **separate atom scope** — two instances on the same page do not share atoms.

In Svelte 5 we achieve the same by calling `createEditorStore()` **once per
Excalidraw root component** and providing it via `setContext`:

```svelte
<!-- Excalidraw.svelte (root component) -->
<script lang="ts">
  import { setContext } from "svelte";
  import { EDITOR_STORE_KEY, createEditorStore } from "./state/index.js";

  // A fresh store is created for every <Excalidraw> instance.
  const editorStore = createEditorStore();
  setContext(EDITOR_STORE_KEY, editorStore);
</script>

<slot />
```

Child components call `getContext(EDITOR_STORE_KEY)` to get the right instance.

For the *app-level* store (collab, language, share dialog) call
`createAppStore()` once at the application root and use `APP_STORE_KEY`.

---

## 4. Imperative jotai store access (get/set outside components)

The React codebase also uses `editorJotaiStore.get(atom)` and
`editorJotaiStore.set(atom, value)` **outside React components** — for example
in action handlers and async utilities (`openConfirmModal`, App class methods).

The Svelte store instance is **not globally importable** because it is created
per component instance.  Options for this pattern:

1. **Pass the store as an argument** to imperative functions.
2. **Export a module-level ref** that the Excalidraw root component sets after
   creation, and that actions/utilities read.  This mirrors how the React app
   passes `excalidrawAPI` around.
3. **Use Svelte's `getContext` inside a Svelte component** and pass the result
   down to whatever needs it.

For the initial port, option 1 or 2 is recommended.  Do *not* use a singleton
module-level `$state` if you need multi-instance support.

---

## 5. forwardRef → bind:this or $bindable

React's `forwardRef` is used in two ways:

### a) Exposing an internal DOM element to a parent

```tsx
// React
export const MyInput = forwardRef<HTMLInputElement, Props>((props, ref) => (
  <input ref={ref} />
));
```

```svelte
<!-- Svelte 5 -->
<script lang="ts">
  let { inputRef = $bindable() }: { inputRef?: HTMLInputElement } = $props();
</script>
<input bind:this={inputRef} />
```

Or, if the parent uses `bind:ref`:
```svelte
<!-- parent -->
<MyInput bind:inputRef={myRef} />
```

### b) forwardRef only used *internally* (ref never escapes)

`ColorInput.tsx` is an example: both refs (`inputRef`, `eyeDropperTriggerRef`)
are internal-only and never passed via forwardRef.  In this case just declare
them as plain local bindings — no `$bindable` needed:

```svelte
<script lang="ts">
  let inputEl: HTMLInputElement | undefined = $state();
  let eyeDropperTriggerEl: HTMLDivElement | undefined = $state();
</script>
<input bind:this={inputEl} />
<div bind:this={eyeDropperTriggerEl}></div>
```

---

## 6. React.ReactNode children → Snippet

**React**

```tsx
interface Props {
  children?: React.ReactNode;
  header: React.ReactNode;
}
const MyPanel = ({ children, header }: Props) => (
  <div>
    <div className="header">{header}</div>
    {children}
  </div>
);
```

**Svelte 5**

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    children?: Snippet;
    header: Snippet;
  };
  const { children, header }: Props = $props();
</script>

<div>
  <div class="header">{@render header()}</div>
  {#if children}
    {@render children()}
  {/if}
</div>
```

**Parent usage:**

```svelte
<MyPanel>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}
  Body content here
</MyPanel>
```

---

## 7. Event handlers

React uses camelCase synthetic event names; Svelte uses lowercase DOM event names.

| React | Svelte 5 |
|---|---|
| `onChange={fn}` | `oninput={fn}` or `onchange={fn}` |
| `onBlur={fn}` | `onblur={fn}` |
| `onFocus={fn}` | `onfocus={fn}` |
| `onClick={fn}` | `onclick={fn}` |
| `onKeyDown={fn}` | `onkeydown={fn}` |
| `onPointerDown={fn}` | `onpointerdown={fn}` |

Note: In Svelte 5 (runes mode) the event binding syntax is the same as standard
HTML attributes — `onclick={handler}`, not `on:click={handler}` (that is the
legacy syntax).

For `<input>`, React's `onChange` fires on every keystroke (like `oninput`),
not only on blur.  Always map React `onChange` on `<input>` to Svelte `oninput`.

---

## 8. className → class

Simple find-and-replace:

```tsx
// React
<div className="my-component">
<div className={clsx("base", { active: isActive })}>
```

```svelte
<!-- Svelte -->
<div class="my-component">
<div class="base" class:active={isActive}>
```

`clsx` still works in Svelte if you prefer it:
```svelte
<div class={clsx("base", { active: isActive })}>
```

---

## 9. Inline style objects → style string

**React**

```tsx
<div style={{ width: "1px", backgroundColor: "var(--default-border-color)" }} />
<input style={{ border: 0, padding: 0 }} />
```

**Svelte 5** (two options)

Option A — `style` directive (for individual properties):
```svelte
<div style:width="1px" style:background-color="var(--default-border-color)"></div>
```

Option B — style string (closer to the React original, easier for bulk props):
```svelte
<input style="border: 0; padding: 0;" />
```

Option C — CSS variables via `style` attribute:
```svelte
<!-- mirrors React's style={{ "--swatch-color": color }} -->
<div style="--swatch-color: {color};"></div>
```

---

## 10. useState + useEffect(sync) → $state + $effect

A common React pattern: local state that mirrors a prop, kept in sync via
`useEffect`:

```tsx
// React
const [innerValue, setInnerValue] = useState(color);
useEffect(() => {
  setInnerValue(color);
}, [color]);
```

**Svelte 5 — do NOT use $derived here** because `innerValue` is also mutated
locally on every keystroke.  Use `$state` + `$effect`:

```svelte
<script lang="ts">
  let innerValue = $state(color);

  $effect(() => {
    innerValue = color;   // re-sync when prop changes
  });
</script>
```

Alternative (when the component should reset rather than patch): key the block:
```svelte
{#key color}
  <InputComponent defaultValue={color} />
{/key}
```

---

## 11. useEffect cleanup (unmount) → $effect returning cleanup

**React**

```tsx
useEffect(() => {
  return () => {
    setEyeDropperState(null);  // runs on unmount
  };
}, [setEyeDropperState]);
```

**Svelte 5** — `$effect` can return a cleanup function; it runs both on
re-execution of the effect *and* on component destroy:

```svelte
<script lang="ts">
  $effect(() => {
    return () => {
      editorStore.setActiveEyeDropper(null);
    };
  });
</script>
```

---

## 12. React context (non-jotai) → Svelte context

The React codebase has several plain `React.createContext` contexts that are
**not** jotai atoms, e.g.:

- `EditorInterfaceContext` (`EditorInterface` object — formFactor, desktopUIMode…)
- `UIAppStateContext` (`UIAppState`)
- `ExcalidrawAPIContext`

These are ported using `setContext` / `getContext` with typed Symbol keys.
The keys are exported from `packages/excalidraw-svelte/src/state/index.ts`:

```ts
export const EDITOR_STORE_KEY: unique symbol = Symbol("editorStore");
export const APP_STORE_KEY: unique symbol = Symbol("appStore");
export const EDITOR_INTERFACE_KEY: unique symbol = Symbol("editorInterface");
```

Usage in a consumer component:

```svelte
<script lang="ts">
  import { getContext } from "svelte";
  import { EDITOR_INTERFACE_KEY } from "../../state/index.js";
  import type { EditorInterface } from "@excalidraw/common";

  const editorInterface = getContext<EditorInterface>(EDITOR_INTERFACE_KEY);
  const isPhone = editorInterface?.formFactor === "phone";
</script>
```

---

## 13. React JSX icons → inlined SVG

Many Excalidraw icons are React JSX elements created by `createIcon()` from
`packages/excalidraw/components/icons.tsx`.  These **cannot** be directly
imported into a `.svelte` file because they produce React VNodes.

**Strategy:**

1. **Inline the SVG** — copy the `<svg>` markup from the `createIcon` call.
   This is the recommended approach for PoC and for icons used in isolation.

2. **Create a `.svelte` icon component** that renders the same SVG.  Good for
   icons reused across many components.

3. **Use a Svelte wrapper** around a web component or raw DOM insertion.
   Avoid this — it adds complexity.

Example (`eyeDropperIcon` → inlined in `ColorInput.svelte`):

```tsx
// React original (icons.tsx)
export const eyeDropperIcon = createIcon(
  <g strokeWidth={1.25}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
    <path d="M11 7l6 6"></path>
    <path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"></path>
  </g>,
  tablerIconProps,   // { width: 24, height: 24, fill: "none", stroke: "currentColor", ... }
);
```

```svelte
<!-- Svelte equivalent -->
<svg
  aria-hidden="true"
  focusable="false"
  role="img"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.25"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
  <path d="M11 7l6 6"></path>
  <path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4z"></path>
</svg>
```

---

## 14. Known limitations & TODOs

### No build pipeline yet

`packages/excalidraw-svelte/` has no `package.json`, `tsconfig.json`, or Vite
config yet.  The note in the task brief that "Vite aliases already exist" is
aspirational — they do not exist in the current worktree.  Before the components
can be compiled and run:

- Create `packages/excalidraw-svelte/package.json` with `svelte`, `svelte-check`,
  and `@sveltejs/vite-plugin-svelte` as dev deps.
- Configure `@sveltejs/vite-plugin-svelte` in a Vite config.
- Add path aliases for `@excalidraw/common`, `@excalidraw/element`, etc.
- Register the package in the root `package.json` workspaces.

### i18n

`t()` is currently imported from `packages/excalidraw/i18n.ts` which has a
jotai dependency (`editorLangCodeAtom`).  The function itself is side-effect-free,
but the module-level atom registration will be a problem once jotai is fully
removed.  Long-term fix: extract `t()` into a standalone module that Svelte
components can import without pulling in any jotai/React code.

### CollabAPI type

`appStore.svelte.ts` types `collabAPI` as `unknown` to avoid importing the
concrete `CollabAPI` interface which itself depends on the React Collab
component.  Once the Svelte Collab module is ported, replace `unknown` with the
real type.

### OverwriteConfirm description

The `OverwriteConfirmState.description` field in the React version is
`React.ReactNode`, allowing arbitrary JSX.  The Svelte version narrows it to
`string`.  If rich content is needed, convert it to a `Snippet` prop on the
`OverwriteConfirm.svelte` component instead.

### Imperative store access from non-component code

Action handlers and App class methods call `editorJotaiStore.get()` /
`editorJotaiStore.set()` imperatively from outside React components.  The
Svelte store does not have a global handle.  See
[section 4](#4-imperative-jotai-store-access-getset-outside-components) for the
recommended approaches.

### App language default

`appStore.svelte.ts` initialises `appLangCode` to `"en"`.  The React app calls
`getPreferredLanguage()` (from `excalidraw-app/app-language/language-detector.ts`)
which uses `i18next-browser-languagedetector` to detect the browser's preferred
language and match it against the supported list.  Until `i18next-browser-languagedetector`
is added as a dependency of `excalidraw-svelte`, the root app component should
call `appStore.setAppLangCode(getPreferredLanguage())` immediately after creating
the store.

### withInternalFallback HOC

`hoc/withInternalFallback.tsx` creates a private `renderAtom` atom per
HOC instance using a closure.  There is no direct Svelte equivalent.  If needed,
replace with a Svelte component that tracks a local `$state` counter.
