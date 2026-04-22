<script lang="ts">
  import './app.scss';
  import Showcase from './showcase/Showcase.svelte';
  // @ts-ignore — resolved via Vite alias
  import { App as SveltedrawApp } from '@sveltedraw/excalidraw';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });
</script>

{#if hash === '#showcase' || hash.startsWith('#showcase/')}
  <Showcase />
{:else if hash === '#app' || hash.startsWith('#app/')}
  <div class="editor-root">
    <SveltedrawApp />
  </div>
{:else}
  <div class="app-container">
    <h1>Sveltedraw</h1>
    <p>Svelte 5 port of Excalidraw — work in progress.</p>
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
