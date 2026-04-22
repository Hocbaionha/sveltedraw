<script lang="ts">
  // Port of packages/excalidraw/components/DialogActionButton.tsx
  import type { Snippet } from "svelte";
  import clsx from "clsx";
  import Spinner from "./Spinner.svelte";

  type ActionType = "primary" | "danger";

  let {
    label,
    children,
    actionType,
    type = "button",
    isLoading = false,
    class: className = "",
    onclick,
    ...rest
  }: {
    label: string;
    children?: Snippet;
    actionType?: ActionType;
    type?: "button" | "submit" | "reset";
    isLoading?: boolean;
    class?: string;
    onclick?: (event: MouseEvent) => void;
    [key: string]: unknown;
  } = $props();

  const variantClass = $derived(
    actionType ? `Dialog__action-button--${actionType}` : "",
  );
</script>

<button
  class={clsx("Dialog__action-button", variantClass, className)}
  {type}
  aria-label={label}
  {onclick}
  {...rest}
>
  {#if children}
    <div style={isLoading ? "visibility: hidden" : undefined}>
      {@render children()}
    </div>
  {/if}
  <div style={isLoading ? "visibility: hidden" : undefined}>{label}</div>
  {#if isLoading}
    <div style="position: absolute; inset: 0;">
      <Spinner />
    </div>
  {/if}
</button>
