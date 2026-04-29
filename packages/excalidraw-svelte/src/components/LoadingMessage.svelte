<script lang="ts">
  // Port of packages/excalidraw/components/LoadingMessage.tsx
  // TODO: i18n — "Loading scene..." is hardcoded; original uses t("labels.loadingScene")

  import { untrack } from 'svelte';
  import clsx from 'clsx';
  import Spinner from './Spinner.svelte';
  import { t } from '../state/i18n.svelte.js';

  const THEME_DARK = 'dark'; // matches THEME.DARK from @sveltedraw/common

  let {
    delay,
    theme,
  }: {
    delay?: number;
    theme?: string;
  } = $props();

  // untrack: intentionally capture initial value only — $effect handles updates
  let isWaiting = $state(untrack(() => !!delay));

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
    <div class="LoadingMessage-text">{t('labels.loadingScene')}</div>
  </div>
{/if}
