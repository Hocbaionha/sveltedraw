<script lang="ts" module>
  // SCSS sidecar (ToolIcon.scss) loaded globally by host app.
  export type ToolButtonSize = "small" | "medium";
  export type ToolButtonType = "button" | "submit" | "icon" | "radio";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, getContext } from "svelte";
  import clsx from "clsx";
  import { isPromiseLike } from "@sveltedraw/common";
  import type { PointerType } from "@sveltedraw/element/types";
  import Spinner from "./Spinner.svelte";
  import { EXCAL_ID_KEY } from "../state/index.js";

  type Props = {
    type: ToolButtonType;
    icon?: Snippet;
    "aria-label": string;
    "aria-keyshortcuts"?: string;
    "data-testid"?: string;
    label?: string;
    title?: string;
    name?: string;
    id?: string;
    size?: ToolButtonSize;
    keyBindingLabel?: string | null;
    showAriaLabel?: boolean;
    hidden?: boolean;
    visible?: boolean;
    selected?: boolean;
    disabled?: boolean;
    class?: string;
    style?: string;
    isLoading?: boolean;
    children?: Snippet;
    /** for type=button|submit|icon */
    onclick?: (event: MouseEvent) => void | Promise<unknown>;
    /** for type=radio */
    checked?: boolean;
    onchange?: (data: { pointerType: PointerType | null }) => void;
    onpointerdown?: (data: { pointerType: PointerType }) => void;
    ref?: HTMLButtonElement | HTMLInputElement | null;
  };

  let {
    type,
    icon,
    "aria-label": ariaLabel,
    "aria-keyshortcuts": ariaKeyShortcuts,
    "data-testid": dataTestId,
    label,
    title,
    name,
    id,
    size = "medium",
    keyBindingLabel,
    showAriaLabel,
    hidden = false,
    visible = true,
    selected,
    disabled,
    class: className = "",
    style,
    isLoading: isLoadingProp,
    children,
    onclick,
    checked = false,
    onchange,
    onpointerdown,
    ref = $bindable<HTMLButtonElement | HTMLInputElement | null>(null),
  }: Props = $props();

  // Two narrowed bindings used by bind:this — Svelte directives don't allow
  // inline TypeScript casts, so we proxy through these via $effect.
  let buttonEl: HTMLButtonElement | null = $state(null);
  let inputEl: HTMLInputElement | null = $state(null);
  $effect(() => {
    ref = (buttonEl ?? inputEl) as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
  });

  const sizeCn = $derived(`ToolIcon_size_${size}`);
  const excalId = getContext<string | undefined>(EXCAL_ID_KEY) ?? "";

  let isLoading = $state(false);
  let mounted = true;
  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });

  let lastPointerType: PointerType | null = null;

  async function handleClick(event: MouseEvent) {
    const ret = onclick?.(event);
    if (isPromiseLike(ret)) {
      try {
        isLoading = true;
        await ret;
      } catch (error: unknown) {
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
        if (mounted) isLoading = false;
      }
    }
  }
</script>

{#if type === "button" || type === "icon" || type === "submit"}
  <button
    bind:this={buttonEl}
    class={clsx(
      "ToolIcon_type_button",
      sizeCn,
      className,
      visible && !hidden
        ? "ToolIcon_type_button--show"
        : "ToolIcon_type_button--hide",
      {
        ToolIcon: !hidden,
        "ToolIcon--selected": selected,
        "ToolIcon--plain": type === "icon",
      },
    )}
    {style}
    data-testid={dataTestId}
    {hidden}
    {title}
    aria-label={ariaLabel}
    type={type === "icon" ? "button" : type}
    onclick={handleClick}
    disabled={isLoading || isLoadingProp || !!disabled}
  >
    {#if icon || label}
      <div
        class="ToolIcon__icon"
        aria-hidden="true"
        aria-disabled={!!disabled}
      >
        {#if icon}{@render icon()}{:else}{label}{/if}
        {#if keyBindingLabel}
          <span class="ToolIcon__keybinding">{keyBindingLabel}</span>
        {/if}
        {#if isLoadingProp}<Spinner />{/if}
      </div>
    {/if}
    {#if showAriaLabel}
      <div class="ToolIcon__label">
        {ariaLabel}
        {#if isLoading}<Spinner />{/if}
      </div>
    {/if}
    {@render children?.()}
  </button>
{:else}
  <label
    class={clsx("ToolIcon", className)}
    {title}
    onpointerdown={(event) => {
      const pt = (event.pointerType || null) as PointerType | null;
      lastPointerType = pt;
      if (pt) onpointerdown?.({ pointerType: pt });
    }}
    onpointerup={() => {
      requestAnimationFrame(() => {
        lastPointerType = null;
      });
    }}
  >
    <input
      bind:this={inputEl}
      class={`ToolIcon_type_radio ${sizeCn}`}
      type="radio"
      {name}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyShortcuts}
      data-testid={dataTestId}
      id={`${excalId}-${id ?? ""}`}
      onchange={() => onchange?.({ pointerType: lastPointerType })}
      {checked}
    />
    <div class="ToolIcon__icon">
      {@render icon?.()}
      {#if keyBindingLabel}
        <span class="ToolIcon__keybinding">{keyBindingLabel}</span>
      {/if}
    </div>
  </label>
{/if}
