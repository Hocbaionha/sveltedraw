<script lang="ts">
  // Phase 17 / Track A3 — identity capture before joining a collab room.
  //
  // Shown when a user clicks the LiveCollaborationTrigger and no
  // identity has been persisted in localStorage. Submitting persists
  // the identity so subsequent sessions skip this dialog. Auto-start
  // flows (VITE_COLLAB_SERVER / ?collab=...) bypass this dialog and
  // use anon-fallback to keep embedding scenarios silent.
  //
  // The component is presentational — it doesn't read or write
  // localStorage itself, doesn't know about the collab store, and
  // doesn't call joinRoom. App.svelte owns those side effects so
  // this component stays trivially testable + reusable.

  import Dialog from "./Dialog.svelte";
  import TextField from "./TextField.svelte";
  import FilledButton from "./FilledButton.svelte";

  export type IdentityResult = {
    id: string;
    name: string;
    color: string;
    persist: boolean;
  };

  let {
    /** 8-color palette to choose from. Picked color writes through to
        awareness so peers can render labels in distinguishable colors. */
    palette,
    /** Pre-fill name (e.g. last persisted name on a re-prompt). */
    defaultName = "",
    /** Pre-select color. Defaults to the first palette entry. */
    defaultColor,
    /** Suggested stable id (typically `anon-{slug}` from caller). The
        dialog doesn't generate ids itself — keeps id-shape decisions
        in one place (App.svelte's makeAnonIdentity). */
    suggestedId,
    onSubmit,
    onCancel,
    title = "Join collaboration",
    nameLabel = "Your name",
    colorLabel = "Display color",
    persistLabel = "Remember on this device",
    submitLabel = "Join",
    cancelLabel = "Cancel",
  }: {
    palette: readonly string[];
    defaultName?: string;
    defaultColor?: string;
    suggestedId: string;
    onSubmit: (result: IdentityResult) => void;
    onCancel: () => void;
    title?: string;
    nameLabel?: string;
    colorLabel?: string;
    persistLabel?: string;
    submitLabel?: string;
    cancelLabel?: string;
  } = $props();

  // Props are intentionally read once at construction time as the
  // initial seed for the form's local state — the dialog owns these
  // values from there. Subsequent prop changes from the parent would
  // not update the form (Svelte's expected behavior for prop-as-default).
  // svelte-ignore state_referenced_locally
  let name = $state(defaultName);
  // Defensive: palette is always populated by the host (COLLAB_PALETTE
  // in App.svelte), but if a host passes an empty array we fall back
  // to a neutral grey rather than letting `color` be `undefined` (which
  // breaks awareness gossip downstream).
  // svelte-ignore state_referenced_locally
  let color = $state(defaultColor ?? palette[0] ?? "#888888");
  let persist = $state(true);

  // Trim-and-validate. We disable submit on empty/whitespace-only names
  // because awareness gossip without a name renders an awkward "" label.
  const trimmedName = $derived(name.trim());
  const canSubmit = $derived(trimmedName.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      id: suggestedId,
      name: trimmedName,
      color,
      persist,
    });
  };

  const onNameKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };
</script>

<Dialog onCloseRequest={onCancel} {title} size="small">
  <div class="CollabIdentityDialog">
    <div class="CollabIdentityDialog__field">
      <TextField
        label={nameLabel}
        value={name}
        fullWidth
        selectOnRender
        onChange={(v: string) => (name = v)}
        onKeyDown={onNameKeyDown}
      />
    </div>

    <div class="CollabIdentityDialog__field">
      <div class="CollabIdentityDialog__label">{colorLabel}</div>
      <div class="CollabIdentityDialog__palette" role="radiogroup" aria-label={colorLabel}>
        {#each palette as swatch (swatch)}
          <button
            type="button"
            class="CollabIdentityDialog__swatch"
            class:selected={swatch === color}
            style:background={swatch}
            aria-label={swatch}
            aria-checked={swatch === color}
            role="radio"
            onclick={() => (color = swatch)}
          ></button>
        {/each}
      </div>
    </div>

    <label class="CollabIdentityDialog__persist">
      <input type="checkbox" bind:checked={persist} />
      <span>{persistLabel}</span>
    </label>

    <div class="CollabIdentityDialog__actions">
      <button type="button" class="CollabIdentityDialog__cancel" onclick={onCancel}>
        {cancelLabel}
      </button>
      <FilledButton
        size="large"
        label={submitLabel}
        onclick={submit}
        disabled={!canSubmit}
      />
    </div>
  </div>
</Dialog>

<style>
  .CollabIdentityDialog {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .CollabIdentityDialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .CollabIdentityDialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary-color, #1b1b1f);
  }

  .CollabIdentityDialog__palette {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.5rem;
  }

  /* The selected ring uses outline rather than border so the swatch
     dimensions don't shift on selection. */
  .CollabIdentityDialog__swatch {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition: outline-color 120ms ease;
    padding: 0;
  }

  .CollabIdentityDialog__swatch.selected {
    outline-color: var(--color-primary, #6965db);
  }

  .CollabIdentityDialog__swatch:focus-visible {
    outline-color: var(--color-primary, #6965db);
  }

  .CollabIdentityDialog__persist {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    user-select: none;
  }

  .CollabIdentityDialog__persist input {
    margin: 0;
    cursor: pointer;
  }

  .CollabIdentityDialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .CollabIdentityDialog__cancel {
    background: transparent;
    border: 1px solid var(--border-color-medium, #d1d4da);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font: inherit;
    color: var(--text-primary-color, #1b1b1f);
  }

  .CollabIdentityDialog__cancel:hover {
    background: var(--button-gray-1, #f1f3f5);
  }

  :global(.sveltedraw.theme--dark) .CollabIdentityDialog__label {
    color: var(--text-primary-color);
  }
</style>
