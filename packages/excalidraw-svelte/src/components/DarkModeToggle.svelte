<script lang="ts" module>
  // Port of packages/excalidraw/components/DarkModeToggle.tsx
  // i18n title fallback: callers pass an explicit title until i18n is wired.
  export type Theme = "light" | "dark";
</script>

<script lang="ts">
  import ToolButton from "./ToolButton.svelte";
  import Icon from "../icons/Icon.svelte";

  let {
    value,
    onChange,
    title,
  }: {
    value: Theme;
    onChange: (value: Theme) => void;
    /** Optional override; when omitted defaults to "Light/Dark mode" English string. */
    title?: string;
  } = $props();

  const computedTitle = $derived(
    title ?? (value === "dark" ? "Light mode" : "Dark mode"),
  );
</script>

<ToolButton
  type="icon"
  title={computedTitle}
  aria-label={computedTitle}
  data-testid="toggle-dark-mode"
  onclick={() => onChange(value === "dark" ? "light" : "dark")}
>
  {#snippet icon()}
    <Icon name={value === "light" ? "MoonIcon" : "SunIcon"} />
  {/snippet}
</ToolButton>
