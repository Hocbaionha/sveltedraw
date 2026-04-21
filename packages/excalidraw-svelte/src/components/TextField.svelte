<script lang="ts">
  // Port of packages/excalidraw/components/TextField.tsx
  // React forwardRef → ref=$bindable(); discriminated union simplified to optional value/defaultValue
  // Eye icon SVGs inlined from packages/excalidraw/components/icons.tsx (eyeIcon, eyeClosedIcon)

  import type { Snippet } from 'svelte';
  import clsx from 'clsx';
  import Button from './Button.svelte';

  let {
    onChange,
    onclick,
    onKeyDown,
    readonly,
    fullWidth,
    selectOnRender = false,
    icon,
    label,
    class: className,
    placeholder,
    isRedacted = false,
    type,
    value,
    defaultValue,
    ref = $bindable(),
  }: {
    onChange?: (value: string) => void;
    onclick?: () => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    readonly?: boolean;
    fullWidth?: boolean;
    selectOnRender?: boolean;
    icon?: Snippet;
    label?: string;
    class?: string;
    placeholder?: string;
    isRedacted?: boolean;
    type?: 'text' | 'search';
    value?: string;
    defaultValue?: string;
    ref?: HTMLInputElement;
  } = $props();

  $effect(() => {
    if (selectOnRender && ref) {
      ref.focus();
      ref.select();
    }
  });

  let isTemporarilyUnredacted = $state(false);

  const isRedactedVisible = $derived(
    value !== undefined && value !== '' && isRedacted && !isTemporarilyUnredacted,
  );
</script>

<div
  class={clsx('ExcTextField', className, {
    'ExcTextField--fullWidth': fullWidth,
    'ExcTextField--hasIcon': !!icon,
  })}
  role="none"
  onclick={() => {
    ref?.focus();
    onclick?.();
  }}
>
  {#if icon}
    {@render icon()}
  {/if}
  {#if label}
    <div class="ExcTextField__label">{label}</div>
  {/if}
  <div
    class={clsx('ExcTextField__input', {
      'ExcTextField__input--readonly': readonly,
    })}
  >
    <input
      class={clsx({ 'is-redacted': isRedactedVisible })}
      readonly={readonly}
      value={value !== undefined ? value : undefined}
      placeholder={placeholder}
      bind:this={ref}
      oninput={(event) => onChange?.((event.target as HTMLInputElement).value)}
      onkeydown={onKeyDown}
      {type}
    />
    {#if isRedacted}
      <Button onSelect={() => (isTemporarilyUnredacted = !isTemporarilyUnredacted)} style="border: 0; user-select: none;">
        {#snippet children()}
          {#if isTemporarilyUnredacted}
            <!-- eyeClosedIcon -->
            <svg
              aria-hidden="true"
              focusable="false"
              role="img"
              viewBox="0 0 24 24"
              class="rtl-mirror"
              fill="none"
              stroke-width="1.5"
              style="width: 1em; height: 1em;"
            >
              <g stroke="currentColor" fill="none">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
                <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
                <path d="M3 3l18 18" />
              </g>
            </svg>
          {:else}
            <!-- eyeIcon -->
            <svg
              aria-hidden="true"
              focusable="false"
              role="img"
              viewBox="0 0 24 24"
              class="rtl-mirror"
              fill="none"
              stroke-width="1.5"
              style="width: 1em; height: 1em;"
            >
              <g stroke="currentColor" fill="none" stroke-width="1.5">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
              </g>
            </svg>
          {/if}
        {/snippet}
      </Button>
    {/if}
  </div>
</div>
