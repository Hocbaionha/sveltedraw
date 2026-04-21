<script lang="ts">
  // Port of packages/excalidraw/components/Switch.tsx
  // Direct port (not bits-ui) to preserve original CSS selectors (.Switch, .Switch input, &:before)

  import clsx from 'clsx';

  let {
    name,
    checked,
    title,
    onChange,
    disabled = false,
  }: {
    name: string;
    checked: boolean;
    title?: string;
    onChange: (value: boolean) => void;
    disabled?: boolean;
  } = $props();

  function handleChange() {
    onChange(!checked);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === ' ') {
      onChange(!checked);
    }
  }
</script>

<div class={clsx('Switch', { toggled: checked, disabled })}>
  <input
    {name}
    id={name}
    {title}
    type="checkbox"
    {checked}
    {disabled}
    onchange={handleChange}
    onkeydown={handleKeyDown}
  />
</div>
