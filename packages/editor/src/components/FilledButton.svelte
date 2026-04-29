<script lang="ts" module>
  // SCSS sidecar (FilledButton.scss) loaded globally by host app.
  export type FilledButtonVariant = "filled" | "outlined" | "icon";
  export type FilledButtonColor =
    | "primary"
    | "danger"
    | "warning"
    | "muted"
    | "success";
  export type FilledButtonSize = "medium" | "large";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import clsx from "clsx";
  import { isPromiseLike } from "@sveltedraw/common";
  import Spinner from "./Spinner.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    label,
    children,
    onclick,
    status = null,
    variant = "filled",
    color: colorProp = "primary",
    size = "medium",
    class: className = "",
    fullWidth = false,
    icon,
    iconName,
    disabled = false,
    ref = $bindable<HTMLButtonElement | null>(null),
  }: {
    label?: string;
    children?: Snippet;
    onclick?: (event: MouseEvent) => void | Promise<unknown>;
    status?: null | "loading" | "success";
    variant?: FilledButtonVariant;
    color?: FilledButtonColor;
    size?: FilledButtonSize;
    class?: string;
    fullWidth?: boolean;
    /** Custom icon snippet — overrides iconName if both provided */
    icon?: Snippet;
    /** Static icon by name from the icons map */
    iconName?: string;
    disabled?: boolean;
    ref?: HTMLButtonElement | null;
  } = $props();

  let isLoading = $state(false);

  const _status = $derived(isLoading ? "loading" : status);
  const color = $derived(_status === "success" ? "success" : colorProp);

  async function handleClick(event: MouseEvent) {
    const ret = onclick?.(event);
    if (isPromiseLike(ret)) {
      const timer = window.setTimeout(() => {
        isLoading = true;
      }, 50);
      try {
        await ret;
      } catch (error: unknown) {
        // AbortError pattern from the engine: warn but rethrow others
        if (
          error &&
          typeof error === "object" &&
          (error as { name?: string }).name === "AbortError"
        ) {
          console.warn(error);
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timer);
        isLoading = false;
      }
    }
  }
</script>

<button
  bind:this={ref}
  class={clsx(
    "ExcButton",
    `ExcButton--color-${color}`,
    `ExcButton--variant-${variant}`,
    `ExcButton--size-${size}`,
    `ExcButton--status-${_status}`,
    { "ExcButton--fullWidth": fullWidth },
    className,
  )}
  onclick={handleClick}
  type="button"
  aria-label={label}
  disabled={disabled || _status === "loading" || _status === "success"}
>
  <div class="ExcButton__contents">
    {#if _status === "loading"}
      <Spinner class="ExcButton__statusIcon" />
    {:else if _status === "success"}
      <div class="ExcButton__statusIcon">
        <Icon name="tablerCheckIcon" />
      </div>
    {/if}
    {#if icon || iconName}
      <div class="ExcButton__icon" aria-hidden="true">
        {#if icon}
          {@render icon()}
        {:else if iconName}
          <Icon name={iconName} />
        {/if}
      </div>
    {/if}
    {#if variant !== "icon"}
      {#if children}
        {@render children()}
      {:else}
        {label}
      {/if}
    {/if}
  </div>
</button>
