<script lang="ts">
  // Top-left burger main menu — trigger + dropdown.
  // Outside-click and Escape handling stays in App.svelte (it owns the
  // `open` state and closes via `bind:open`).
  // Plugin-contributed menu items appear in their own group below the
  // built-in items — see PluginRegistry.menuItems.
  import { getContext } from "svelte";
  import { t } from "../state/i18n.svelte.js";
  import Icon from "../icons/Icon.svelte";
  import { PLUGIN_REGISTRY_KEY, type PluginRegistry } from "../plugins/registry.svelte.js";

  type Props = {
    open: boolean;
    theme: string;
    gridEnabled: boolean;
    onLoad: () => void;
    onSave: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    onToggleGrid: () => void;
    onToggleTheme: () => void;
    onOpenHelp: () => void;
    onClearCanvas: () => void;
  };

  let {
    open = $bindable(false),
    theme,
    gridEnabled,
    onLoad,
    onSave,
    onExportPng,
    onExportSvg,
    onToggleGrid,
    onToggleTheme,
    onOpenHelp,
    onClearCanvas,
  }: Props = $props();

  const close = () => (open = false);
  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const onClearConfirm = () => {
    if (window.confirm(t("alerts.clearReset", undefined, "Clear the canvas?"))) {
      onClearCanvas();
    }
    close();
  };

  // Plugin items section — read at render time. The component is mounted
  // unconditionally so re-registering a plugin between menu opens picks
  // up the new items without remount.
  const pluginRegistry =
    getContext<PluginRegistry | undefined>(PLUGIN_REGISTRY_KEY);
  const pluginMenuItems = $derived(pluginRegistry?.menuItems ?? []);
</script>

<button
  type="button"
  class="sveltedraw-main-menu-trigger"
  aria-label="Menu"
  title="Menu"
  aria-expanded={open}
  onclick={() => (open = !open)}
>
  <Icon name="HamburgerMenuIcon" />
</button>
{#if open}
  <div class="sveltedraw-main-menu" role="menu" tabindex="-1">
    <button type="button" class="mm-item" onclick={run(onLoad)}>{t("buttons.load", undefined, "Open…")}</button>
    <button type="button" class="mm-item" onclick={run(onSave)}>{t("buttons.save", undefined, "Save as…")}</button>
    <div class="mm-sep"></div>
    <button type="button" class="mm-item" onclick={run(onExportPng)}>{t("buttons.exportImage", undefined, "Export as image")}</button>
    <button type="button" class="mm-item" onclick={run(onExportSvg)}>{t("buttons.exportToSvg", undefined, "Export as SVG")}</button>
    <div class="mm-sep"></div>
    <button type="button" class="mm-item" onclick={run(onToggleGrid)}>
      {(gridEnabled ? "✓ " : "")}{t("labels.showGrid", undefined, "Show grid")}
    </button>
    <button type="button" class="mm-item" onclick={run(onToggleTheme)}>
      {(theme === "dark" ? "✓ " : "")}{t("buttons.darkMode", undefined, "Dark mode")}
    </button>
    <div class="mm-sep"></div>
    <button type="button" class="mm-item" onclick={run(onOpenHelp)}>{t("helpDialog.title", undefined, "Keyboard shortcuts")}</button>
    <button type="button" class="mm-item mm-item--danger" onclick={onClearConfirm}>{t("buttons.clearReset", undefined, "Reset canvas")}</button>
    {#if pluginMenuItems.length > 0}
      <div class="mm-sep"></div>
      {#each pluginMenuItems as item (item.id)}
        <button
          type="button"
          class="mm-item"
          onclick={run(item.onSelect)}
        >
          {item.label}
          {#if item.shortcut}
            <span class="mm-shortcut">{item.shortcut}</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .sveltedraw-main-menu-trigger {
    position: absolute;
    top: 12px;
    left: 12px;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    cursor: pointer;
    color: #1e1e1e;
    z-index: 50;
  }
  .sveltedraw-main-menu-trigger:hover {
    background: #f1f3f5;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-main-menu-trigger {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-main-menu-trigger:hover {
    background: #2e2e36;
  }
  :global(.sveltedraw-main-menu-trigger svg) {
    width: 18px;
    height: 18px;
  }

  .sveltedraw-main-menu {
    position: absolute;
    top: 54px;
    left: 12px;
    min-width: 200px;
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 4px 0;
    z-index: 60;
    font-size: 13px;
  }
  :global(.sveltedraw.theme--dark) .sveltedraw-main-menu {
    background: #232329;
    border-color: #363636;
    color: #e5e7ea;
  }
  .mm-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 7px 14px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 13px;
  }
  .mm-item:hover {
    background: #eeedfa;
  }
  :global(.sveltedraw.theme--dark) .mm-item:hover {
    background: #3b3a66;
  }
  .mm-item--danger {
    color: #e03131;
  }
  .mm-sep {
    height: 1px;
    background: #e5e7ea;
    margin: 4px 0;
  }
  :global(.sveltedraw.theme--dark) .mm-sep {
    background: #363636;
  }
  .mm-shortcut {
    float: right;
    color: #868e96;
    font-size: 11px;
    margin-left: 16px;
  }
</style>
