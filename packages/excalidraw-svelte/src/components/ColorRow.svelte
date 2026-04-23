<script lang="ts">
  // Style-panel color picker row. Parent owns the popover-open state
  // (there's always exactly one picker open at a time — stroke vs
  // background — so the mutual-exclusion logic lives in App.svelte).
  import ColorPicker from "./color-picker/ColorPicker.svelte";

  let {
    label,
    type,
    color,
    elements,
    open,
    onToggle,
    onClose,
    onChange,
    container,
  }: {
    label: string;
    type: "elementStroke" | "elementBackground";
    color: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    elements: any[];
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    onChange: (color: string) => void;
    container: HTMLElement | null;
  } = $props();
</script>

<div class="sp-row">
  <div class="sp-label">{label}</div>
  <div class="sp-picker">
    <ColorPicker
      {type}
      {color}
      {label}
      {elements}
      updateData={() => {}}
      {open}
      {onToggle}
      {onClose}
      {onChange}
      onEyeDropperToggle={() => {}}
      {container}
    />
  </div>
</div>
