<script lang="ts" generics="T">
  // Port of packages/excalidraw/components/dropdownMenu/DropdownMenuItemContentRadio.tsx
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import type { EditorInterface } from "@excalidraw/common";
  import { EDITOR_INTERFACE_KEY } from "../state/index.js";
  import Ellipsify from "./Ellipsify.svelte";
  import RadioGroup, { type RadioGroupChoice } from "./RadioGroup.svelte";

  let {
    value,
    shortcut,
    choices,
    onChange,
    children,
    name,
    icon,
  }: {
    value: T;
    shortcut?: string;
    choices: RadioGroupChoice<T>[];
    onChange: (value: T) => void;
    children: Snippet;
    name: string;
    icon?: Snippet;
  } = $props();

  const editorInterface =
    getContext<EditorInterface | undefined>(EDITOR_INTERFACE_KEY);
  const showShortcut = $derived(
    !!shortcut && editorInterface?.formFactor !== "phone",
  );
</script>

<div class="dropdown-menu-item-base dropdown-menu-item-bare">
  {#if icon}
    <div class="dropdown-menu-item__icon">{@render icon()}</div>
  {/if}
  <label class="dropdown-menu-item__text">
    <Ellipsify>
      {@render children()}
    </Ellipsify>
  </label>
  <RadioGroup {name} {value} {onChange} {choices} />
</div>
{#if showShortcut}
  <div
    class="dropdown-menu-item__shortcut dropdown-menu-item__shortcut--orphaned"
  >
    {shortcut}
  </div>
{/if}
