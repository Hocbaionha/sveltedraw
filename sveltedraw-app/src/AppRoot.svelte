<script lang="ts">
  // Root wrapper for the editor. Gives us a place to hang a Svelte 5
  // <svelte:boundary> (error boundary) so a runtime throw inside the
  // editor doesn't take down the whole mount — user sees a recoverable
  // error card + "Reload" button instead of a blank page.
  //
  // The import is a static reference (not dynamic) so Vite tree-shakes
  // the editor into the main chunk.
  import App from "./App.svelte";

  let error = $state<{ message: string; stack?: string } | null>(null);

  function handleError(
    err: unknown,
    reset: () => void,
  ) {
    const e = err as Error;
    // eslint-disable-next-line no-console
    console.error("sveltedraw: uncaught error in editor", err);
    error = {
      message: e?.message ?? String(err),
      stack: e?.stack,
    };
    // Don't auto-reset; user decides via the button.
  }

  function reload() {
    window.location.reload();
  }
</script>

<svelte:boundary onerror={handleError}>
  <App />

  {#snippet failed(err, reset)}
    <div class="sveltedraw-error-root">
      <div class="sveltedraw-error-card">
        <h1>Something went wrong.</h1>
        <p>
          The editor hit an unexpected error and can't continue safely.
          Your last saved state is still in local storage — reloading
          the page will restore it.
        </p>
        {#if error?.message}
          <pre class="sveltedraw-error-msg">{error.message}</pre>
        {/if}
        {#if error?.stack}
          <details>
            <summary>Stack trace</summary>
            <pre class="sveltedraw-error-stack">{error.stack}</pre>
          </details>
        {/if}
        <div class="sveltedraw-error-actions">
          <button type="button" onclick={reload}>Reload</button>
          <button
            type="button"
            onclick={() => {
              error = null;
              reset();
            }}>Try to continue</button
          >
        </div>
      </div>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .sveltedraw-error-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    z-index: 9999;
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif;
  }
  .sveltedraw-error-card {
    max-width: 600px;
    padding: 24px 32px;
    background: #fff;
    border: 1px solid #e5e7ea;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }
  .sveltedraw-error-card h1 {
    margin-top: 0;
    color: #e03131;
    font-size: 20px;
  }
  .sveltedraw-error-card p {
    color: #3a3d45;
    line-height: 1.5;
  }
  .sveltedraw-error-msg {
    background: #fff5f5;
    border: 1px solid #ffc9c9;
    padding: 8px 12px;
    border-radius: 4px;
    color: #c92a2a;
    font-size: 13px;
    white-space: pre-wrap;
    overflow-x: auto;
  }
  .sveltedraw-error-stack {
    background: #f1f3f5;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    max-height: 240px;
    overflow: auto;
  }
  .sveltedraw-error-actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  .sveltedraw-error-actions button {
    padding: 6px 16px;
    border-radius: 6px;
    border: 1px solid #d1d4da;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
  }
  .sveltedraw-error-actions button:first-child {
    background: #6965db;
    color: #fff;
    border-color: #6965db;
  }
</style>
