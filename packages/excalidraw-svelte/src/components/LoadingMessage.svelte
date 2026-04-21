<script lang="ts">
  // Port of packages/excalidraw/components/LoadingMessage.tsx
  // TODO: i18n — "Loading scene..." is hardcoded; original uses t("labels.loadingScene")

  import clsx from 'clsx';
  import Spinner from './Spinner.svelte';

  const THEME_DARK = 'dark'; // matches THEME.DARK from @excalidraw/common

  let {
    delay,
    theme,
  }: {
    delay?: number;
    theme?: string;
  } = $props();

  let isWaiting = $state(false);

  $effect(() => {
    if (!delay) {
      isWaiting = false;
      return;
    }
    isWaiting = true;
    const timer = setTimeout(() => {
      isWaiting = false;
    }, delay);
    return () => clearTimeout(timer);
  });
</script>

{#if !isWaiting}
  <div
    class={clsx('LoadingMessage', {
      'LoadingMessage--dark': theme === THEME_DARK,
    })}
  >
    <div>
      <Spinner />
    </div>
    <div class="LoadingMessage-text">Loading scene...</div>
  </div>
{/if}
