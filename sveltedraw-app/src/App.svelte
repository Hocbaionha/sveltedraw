<script lang="ts">
  import './app.scss';
  import Showcase from './showcase/Showcase.svelte';

  let hash = $state(window.location.hash);
  window.addEventListener('hashchange', () => { hash = window.location.hash; });
</script>

{#if hash === '#showcase'}
  <Showcase />
{:else}
  <div class="app-container">
    <h1>Sveltedraw</h1>
    <p>Svelte 5 port of Excalidraw — work in progress.</p>
    <a href="#showcase">→ Component Showcase (bits-ui)</a>
  </div>
{/if}

<style>
  .app-container {
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
</style>
