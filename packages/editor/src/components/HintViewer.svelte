<script lang="ts">
  // shell only. The 200-line `getHints()` decision tree (which walks
  // AppState/Scene/activeTool to pick which `t("hints.X")` to show) lives
  // with the caller; this component receives the resolved string.
  //
  // Hint format: `<kbd>Ctrl</kbd>` markers render as <kbd> elements;
  // everything else is plain text.

  let {
    hint,
  }: {
    /** Resolved hint text (may contain <kbd>X</kbd> tags). null/empty hides. */
    hint: string | string[] | null | undefined;
  } = $props();

  type Part = { kind: "text"; text: string } | { kind: "kbd"; key: string };

  function flattenHint(h: string | string[] | null | undefined): string | null {
    if (!h) return null;
    if (Array.isArray(h)) {
      return h.map((s) => s.replace(/\. ?$/, "")).join(", ");
    }
    return h;
  }

  function parseHint(text: string): Part[] {
    return text.split(/(<kbd>[^<]+<\/kbd>)/g).map((part) => {
      const kbdMatch = part.match(/^<kbd>([^<]+)<\/kbd>$/);
      if (kbdMatch) return { kind: "kbd", key: kbdMatch[1] } as const;
      return { kind: "text", text: part } as const;
    });
  }

  const flat = $derived(flattenHint(hint));
  const parts = $derived(flat ? parseHint(flat) : null);
</script>

{#if parts}
  <div class="HintViewer">
    <span>
      {#each parts as part, i (i)}
        {#if part.kind === "kbd"}
          <kbd>{part.key}</kbd>
        {:else}
          {part.text}
        {/if}
      {/each}
    </span>
  </div>
{/if}
