<script lang="ts">
  import './app.scss';
  import Showcase from './showcase/Showcase.svelte';
  // @ts-ignore — resolved via Vite alias
  import { App as SveltedrawApp, examplePlugin } from '@sveltedraw/editor';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });

  // Strip query-string from the hash for route matching. The editor
  // needs query params (e.g. `?collab=ws://...`, `?demo=plugin`) to
  // live inside the hash fragment because GitHub Pages and other
  // static hosts don't pass top-level query strings to SPAs reliably.
  const route = $derived.by(() => {
    const qIdx = hash.indexOf('?');
    return qIdx === -1 ? hash : hash.slice(0, qIdx);
  });

  // Demo: pass `?demo=plugin` (or `#app?demo=plugin`) to mount the
  // example plugin. Lets us smoke-test the OCP wiring without
  // shipping the demo to every embedder by default.
  const demoFlag = $derived.by(() => {
    try {
      const url = new URL(window.location.href);
      const top = url.searchParams.get('demo');
      if (top) return top;
      const hashFrag = url.hash || '';
      const qIdx = hashFrag.indexOf('?');
      if (qIdx === -1) return null;
      return new URLSearchParams(hashFrag.slice(qIdx + 1)).get('demo');
    } catch { return null; }
  });
  const editorPlugins = $derived(
    demoFlag === 'plugin' ? [examplePlugin] : [],
  );
</script>

{#if route === '#showcase' || route.startsWith('#showcase/')}
  <Showcase />
{:else if route === '#app' || route.startsWith('#app/')}
  <div class="editor-root">
    <SveltedrawApp plugins={editorPlugins} />
  </div>
{:else}
  <div class="app-container">
    <h1>Sveltedraw</h1>
    <p>Svelte 5 port of Sveltedraw — work in progress.</p>
    <ul>
      <li><a href="#showcase">→ Component Showcase (bits-ui)</a></li>
      <li><a href="#app">→ Editor shell (Phase 6 batch 1 — no drawing yet)</a></li>
    </ul>
  </div>
{/if}

<style>
  .app-container {
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .editor-root {
    position: fixed;
    inset: 0;
  }
</style>
