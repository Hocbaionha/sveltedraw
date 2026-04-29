<script lang="ts">
  // Canvas right-click context menu. Absolute-positioned at the click point.
  // Outside-click / Escape closing is handled in App.svelte; this
  // component just stops pointerdown propagation inside the menu.
  //
  // NOTE: a different generic ContextMenu.svelte exists in this folder —
  // that one is the port of engine packages/engine's Popover-based
  // menu. This one is the sveltedraw canvas-specific menu.
  import { t } from "../state/i18n.svelte.js";

  type ContextMenuData = {
    vpX: number;
    vpY: number;
    hasSelection: boolean;
  };

  type Props = {
    menu: ContextMenuData;
    clipboardEmpty: boolean;
    selectedCount: number;
    selectedHasLink: boolean;
    onClose: () => void;
    onCopy: () => void;
    onCut: () => void;
    onPaste: () => void;
    onOpenLink: () => void;
    onDuplicate: () => void;
    onGroup: () => void;
    onUngroup: () => void;
    onSaveToLibrary: () => void;
    onBringForward: () => void;
    onBringToFront: () => void;
    onSendBackward: () => void;
    onSendToBack: () => void;
    onDelete: () => void;
  };

  let {
    menu,
    clipboardEmpty,
    selectedCount,
    selectedHasLink,
    onClose,
    onCopy,
    onCut,
    onPaste,
    onOpenLink,
    onDuplicate,
    onGroup,
    onUngroup,
    onSaveToLibrary,
    onBringForward,
    onBringToFront,
    onSendBackward,
    onSendToBack,
    onDelete,
  }: Props = $props();

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };
</script>

<div
  class="sveltedraw-ctx-menu"
  style="position: absolute;
         left: {menu.vpX}px;
         top: {menu.vpY}px;
         z-index: 100;"
  role="menu"
  tabindex="-1"
  onpointerdown={(e) => e.stopPropagation()}
>
  {#if menu.hasSelection}
    <button type="button" class="ctx-item" onclick={run(onCopy)}>{t("labels.copy")}</button>
    <button type="button" class="ctx-item" onclick={run(onCut)}>{t("labels.cut")}</button>
  {/if}
  <button
    type="button"
    class="ctx-item"
    disabled={clipboardEmpty}
    onclick={run(onPaste)}
  >{t("labels.paste")}</button>
  {#if menu.hasSelection}
    <div class="ctx-sep"></div>
    {#if selectedCount === 1}
      <button type="button" class="ctx-item" onclick={run(onOpenLink)}>
        {selectedHasLink ? "Edit link" : "Add link"}
      </button>
    {/if}
    <button type="button" class="ctx-item" onclick={run(onDuplicate)}>{t("labels.duplicateSelection")}</button>
    <button type="button" class="ctx-item" onclick={run(onGroup)}>{t("labels.group")}</button>
    <button type="button" class="ctx-item" onclick={run(onUngroup)}>{t("labels.ungroup")}</button>
    <button type="button" class="ctx-item" onclick={run(onSaveToLibrary)}>{t("toolBar.library")}</button>
    <button type="button" class="ctx-item" onclick={run(onBringForward)}>{t("labels.bringForward")}</button>
    <button type="button" class="ctx-item" onclick={run(onBringToFront)}>{t("labels.bringToFront")}</button>
    <button type="button" class="ctx-item" onclick={run(onSendBackward)}>{t("labels.sendBackward")}</button>
    <button type="button" class="ctx-item" onclick={run(onSendToBack)}>{t("labels.sendToBack")}</button>
    <div class="ctx-sep"></div>
    <button type="button" class="ctx-item ctx-item--danger" onclick={run(onDelete)}>{t("labels.delete")}</button>
  {/if}
</div>

<style>
  .sveltedraw-ctx-menu {
    background: #fff;
    border: 1px solid #d1d4da;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    min-width: 160px;
    padding: 4px 0;
    font-size: 13px;
  }
  .ctx-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #1e1e1e;
  }
  .ctx-item:hover:not([disabled]) {
    background: #eeedfa;
  }
  .ctx-item[disabled] {
    color: #a0a3a9;
    cursor: not-allowed;
  }
  .ctx-item--danger {
    color: #e03131;
  }
  .ctx-sep {
    height: 1px;
    background: #e5e7ea;
    margin: 4px 0;
  }
</style>
