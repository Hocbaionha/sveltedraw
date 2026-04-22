<script lang="ts">
  // Port of packages/excalidraw/components/ProjectName.tsx
  // SCSS sidecars (TextInput.scss + ProjectName.scss) loaded globally.

  import { getContext } from "svelte";
  // @ts-ignore upstream package
  import { focusNearestParent, KEYS } from "@excalidraw/common";
  import { EXCAL_ID_KEY } from "../state/index.js";

  let {
    value,
    onChange,
    label,
    ignoreFocus = false,
  }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    ignoreFocus?: boolean;
  } = $props();

  const excalId = getContext<string | undefined>(EXCAL_ID_KEY) ?? "";

  // svelte-ignore state_referenced_locally
  let fileName = $state(value);
  $effect(() => {
    fileName = value;
  });

  function handleBlur(event: FocusEvent) {
    const target = event.target as HTMLInputElement;
    if (!ignoreFocus) focusNearestParent(target);
    if (target.value !== value) onChange(target.value);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== KEYS.ENTER) return;
    event.preventDefault();
    // Don't commit while an IME composition is active.
    if (event.isComposing || event.keyCode === 229) return;
    (event.currentTarget as HTMLInputElement).blur();
  }
</script>

<div class="ProjectName">
  <label class="ProjectName-label" for="filename">{`${label}:`}</label>
  <input
    type="text"
    class="TextInput"
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    id={`${excalId}-filename`}
    value={fileName}
    oninput={(event) =>
      (fileName = (event.target as HTMLInputElement).value)}
  />
</div>
