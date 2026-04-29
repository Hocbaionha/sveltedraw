<script lang="ts">
  // The original reads `id` from useSveltedrawContainer(); here we use
  // EXCAL_ID_KEY (optional context). Falls back to "" if not provided.
  // i18n heading text taken as a prop with the heading key as fallback.

  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import { EXCAL_ID_KEY } from "../state/index.js";

  type Heading = "canvasActions" | "selectedShapeActions" | "shapes";

  let {
    heading,
    headingText,
    children,
    headingChildren,
    class: className = "",
  }: {
    heading: Heading;
    /** Localized heading text. Defaults to the heading key. */
    headingText?: string;
    /** Render-prop variant: receives the heading snippet. */
    headingChildren?: Snippet<[Snippet]>;
    /** Static children — renders heading then this. */
    children?: Snippet;
    class?: string;
  } = $props();

  const excalId = getContext<string | undefined>(EXCAL_ID_KEY) ?? "";
  const headingId = $derived(`${excalId}-${heading}-title`);
  const text = $derived(headingText ?? heading);
</script>

{#snippet header()}
  <h2 class="visually-hidden" id={headingId}>{text}</h2>
{/snippet}

<section class={className} aria-labelledby={headingId}>
  {#if headingChildren}
    {@render headingChildren(header)}
  {:else}
    {@render header()}
    {@render children?.()}
  {/if}
</section>
