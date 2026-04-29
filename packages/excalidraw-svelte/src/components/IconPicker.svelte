<script lang="ts" module>
  // Port of packages/excalidraw/components/IconPicker.tsx
  // SCSS sidecar (IconPicker.scss) loaded globally by host app.
  //
  // Contract:
  //  - "More options" toggle held in module-local $state (only one picker is
  //    open at a time in practice; switch to context if per-instance needed).
  //  - `getLanguage().rtl` passed via optional `isRTL` prop.
  //  - Collision boundary passed via optional `container` prop.
  export type IconPickerOption<T> = {
    value: T;
    text: string;
    icon: import("svelte").Snippet;
    keyBinding: string | null;
  };

  export type IconPickerSection<T> = {
    name: string;
    options: readonly IconPickerOption<T>[];
  };
</script>

<script lang="ts" generics="T">
  import { Popover as BitsPopover } from "bits-ui";
  import clsx from "clsx";
  // @ts-ignore upstream package
  import { isArrowKey, KEYS } from "@sveltedraw/common";
  import Collapsible from "./Collapsible.svelte";

  const PICKER_COLUMNS = 4;
  const DEFAULT_SECTION_NAME = "default";

  let {
    value,
    label,
    visibleSections,
    hiddenSections = [],
    onChange,
    moreOptionsLabel = "More options",
    isRTL = false,
  }: {
    value: T;
    label: string;
    visibleSections: readonly IconPickerSection<T>[];
    hiddenSections?: readonly IconPickerSection<T>[];
    onChange: (value: T) => void;
    moreOptionsLabel?: string;
    isRTL?: boolean;
  } = $props();

  let isActive = $state(false);
  let showMoreOptions = $state(false);

  const allSections = $derived([...visibleSections, ...hiddenSections]);
  const allOptions = $derived(allSections.flatMap((s) => s.options));
  const navigationSections = $derived([
    ...visibleSections,
    ...(showMoreOptions ? hiddenSections : []),
  ]);
  const navigationRows = $derived(
    navigationSections.flatMap((section) =>
      Array.from(
        { length: Math.ceil(section.options.length / PICKER_COLUMNS) },
        (_, index) =>
          section.options.slice(
            index * PICKER_COLUMNS,
            index * PICKER_COLUMNS + PICKER_COLUMNS,
          ),
      ),
    ),
  );

  const selectedOption = $derived(
    allOptions.find((o) => o.value === value) ?? null,
  );

  // Auto-expand the "more options" section when the active value lives there.
  $effect(() => {
    if (hiddenSections.some((s) => s.options.some((o) => o.value === value))) {
      showMoreOptions = true;
    }
  });

  function handleKeyDown(event: KeyboardEvent) {
    const pressedOption = allOptions.find(
      (o) => o.keyBinding === event.key.toLowerCase(),
    );

    if (!(event.metaKey || event.altKey || event.ctrlKey) && pressedOption) {
      onChange(pressedOption.value);
      event.preventDefault();
    } else if (event.key === KEYS.TAB) {
      const index = allOptions.findIndex((o) => o.value === value);
      const nextIndex = event.shiftKey
        ? (allOptions.length + index - 1) % allOptions.length
        : (index + 1) % allOptions.length;
      onChange(allOptions[nextIndex].value);
    } else if (isArrowKey(event.key)) {
      const index = allOptions.findIndex((o) => o.value === value);
      if (index === -1) return;
      const length = allOptions.length;
      let nextIndex = index;

      switch (event.key) {
        case isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT:
          nextIndex = (index + 1) % length;
          break;
        case isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT:
          nextIndex = (length + index - 1) % length;
          break;
        case KEYS.ARROW_DOWN: {
          const currentRowIndex = navigationRows.findIndex((row) =>
            row.some((o) => o.value === value),
          );
          const currentRow = navigationRows[currentRowIndex];
          if (currentRowIndex !== -1 && currentRow) {
            const column = currentRow.findIndex((o) => o.value === value);
            const nextRow =
              navigationRows[(currentRowIndex + 1) % navigationRows.length];
            const nextOption =
              nextRow[Math.min(column, nextRow.length - 1)] ??
              allOptions[index];
            onChange(nextOption.value);
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
            return;
          }
          break;
        }
        case KEYS.ARROW_UP: {
          const currentRowIndex = navigationRows.findIndex((row) =>
            row.some((o) => o.value === value),
          );
          const currentRow = navigationRows[currentRowIndex];
          if (currentRowIndex !== -1 && currentRow) {
            const column = currentRow.findIndex((o) => o.value === value);
            const previousRow =
              navigationRows[
                (navigationRows.length + currentRowIndex - 1) %
                  navigationRows.length
              ];
            const previousOption =
              previousRow[Math.min(column, previousRow.length - 1)] ??
              allOptions[index];
            onChange(previousOption.value);
            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
            return;
          }
          break;
        }
      }
      onChange(allOptions[nextIndex].value);
      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      event.preventDefault();
      isActive = false;
    }
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function focusSelected(node: HTMLButtonElement, isSelected: boolean) {
    if (isSelected) {
      setTimeout(() => node.focus(), 0);
    }
  }
</script>

<div>
  <BitsPopover.Root bind:open={() => isActive, (v) => (isActive = v)}>
    <BitsPopover.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          aria-label={label}
          onclick={() => (isActive = !isActive)}
          class={isActive ? "active" : ""}
        >
          {#if selectedOption}{@render selectedOption.icon()}{/if}
        </button>
      {/snippet}
    </BitsPopover.Trigger>
    {#if isActive}
      <BitsPopover.Content
        side="bottom"
        align="start"
        sideOffset={12}
        alignOffset={12}
      >
        {#snippet child({ props })}
          <div
            {...props}
            class="picker"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            style="z-index: var(--zIndex-ui-styles-popup);"
            onkeydown={handleKeyDown}
          >
            <div class="picker-sections">
              {#each visibleSections as section, index (section.name + index)}
                {#if section.name === DEFAULT_SECTION_NAME}
                  <div class="picker-content">
                    {#each section.options as option (option.text)}
                      <button
                        type="button"
                        class={clsx("picker-option", {
                          active: value === option.value,
                        })}
                        onclick={() => onChange(option.value)}
                        title={option.keyBinding
                          ? `${option.text} — ${option.keyBinding.toUpperCase()}`
                          : option.text}
                        aria-label={option.text || "none"}
                        aria-keyshortcuts={option.keyBinding || undefined}
                        use:focusSelected={value === option.value}
                      >
                        {@render option.icon()}
                        {#if option.keyBinding}
                          <span class="picker-keybinding"
                            >{option.keyBinding}</span
                          >
                        {/if}
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="picker-section">
                    <div class="picker-section-label">{section.name}</div>
                    <div class="picker-content">
                      {#each section.options as option (option.text)}
                        <button
                          type="button"
                          class={clsx("picker-option", {
                            active: value === option.value,
                          })}
                          onclick={() => onChange(option.value)}
                          title={option.keyBinding
                            ? `${option.text} — ${option.keyBinding.toUpperCase()}`
                            : option.text}
                          aria-label={option.text || "none"}
                          aria-keyshortcuts={option.keyBinding || undefined}
                          use:focusSelected={value === option.value}
                        >
                          {@render option.icon()}
                          {#if option.keyBinding}
                            <span class="picker-keybinding"
                              >{option.keyBinding}</span
                            >
                          {/if}
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}

              {#if hiddenSections.length > 0}
                <Collapsible
                  label={moreOptionsLabel}
                  open={showMoreOptions}
                  openTrigger={() => (showMoreOptions = !showMoreOptions)}
                  class="picker-collapsible"
                >
                  <div class="picker-sections">
                    {#each hiddenSections as section, index (section.name + index)}
                      <div class="picker-section">
                        {#if section.name !== DEFAULT_SECTION_NAME}
                          <div class="picker-section-label">{section.name}</div>
                        {/if}
                        <div class="picker-content">
                          {#each section.options as option (option.text)}
                            <button
                              type="button"
                              class={clsx("picker-option", {
                                active: value === option.value,
                              })}
                              onclick={() => onChange(option.value)}
                              title={option.keyBinding
                                ? `${option.text} — ${option.keyBinding.toUpperCase()}`
                                : option.text}
                              aria-label={option.text || "none"}
                              aria-keyshortcuts={option.keyBinding || undefined}
                              use:focusSelected={value === option.value}
                            >
                              {@render option.icon()}
                              {#if option.keyBinding}
                                <span class="picker-keybinding"
                                  >{option.keyBinding}</span
                                >
                              {/if}
                            </button>
                          {/each}
                        </div>
                      </div>
                    {/each}
                  </div>
                </Collapsible>
              {/if}
            </div>
          </div>
        {/snippet}
      </BitsPopover.Content>
    {/if}
  </BitsPopover.Root>
</div>
