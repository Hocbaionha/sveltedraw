<script lang="ts">
  // SCSS sidecar (SidebarTrigger.scss) loaded globally by host app.
  //
  // Caller passes `isOpen` + the on-toggle callback.

  import type { Snippet } from "svelte";
  import clsx from "clsx";

  let {
    isOpen,
    onToggle,
    icon,
    title,
    children,
    class: className,
    style,
  }: {
    isOpen: boolean;
    /** Called with the next open state. Phase 6 handles the AppState update. */
    onToggle: (nextOpen: boolean) => void;
    icon?: Snippet;
    title?: string;
    children?: Snippet;
    class?: string;
    style?: string;
  } = $props();

  function handleChange(event: Event) {
    // Remove the "animate" class on LayerUI so the sidebar slide-in doesn't
    // re-trigger on toggle (mirrors original behaviour).
    document.querySelector(".layer-ui__wrapper")?.classList.remove("animate");
    const nextOpen = (event.target as HTMLInputElement).checked;
    onToggle(nextOpen);
  }
</script>

<label {title} class="sidebar-trigger__label-element">
  <input
    class="ToolIcon_type_checkbox"
    type="checkbox"
    checked={isOpen}
    aria-label={title}
    aria-keyshortcuts="0"
    onchange={handleChange}
  />
  <div class={clsx("sidebar-trigger", className)} {style}>
    {#if icon}
      <div>{@render icon()}</div>
    {/if}
    {#if children}
      <div class="sidebar-trigger__label">{@render children()}</div>
    {/if}
  </div>
</label>
