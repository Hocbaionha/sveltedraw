<script lang="ts" module>
  // Port of packages/excalidraw/components/ToolPopover.tsx
  // SCSS sidecar (ToolPopover.scss) loaded globally by host app.
  //
  // The original takes `app: AppClassProperties` and uses `app.onPointerDownEmitter`
  // to close the popover on canvas interaction. Since AppClassProperties is
  // Phase 6 territory, we accept a structural `onPointerDownEmitter` shape
  // plus `setActiveTool` and `currentToolType` directly. Phase 6 wires them.
  export type ToolOption = {
    type: string;
    icon: import("svelte").Snippet;
    title?: string;
  };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { getContext } from "svelte";
  import clsx from "clsx";
  import { Popover as BitsPopover } from "bits-ui";
  // @ts-ignore upstream package
  import { capitalizeString } from "@sveltedraw/common";
  import ToolButton from "./ToolButton.svelte";

  type Emitter = {
    on: (handler: () => void) => () => void;
  };

  let {
    onPointerDownEmitter,
    options,
    activeToolType,
    defaultOption,
    class: className = "Shape",
    namePrefix,
    title,
    "data-testid": dataTestId,
    onToolChange,
    setActiveTool,
    displayedOption,
    fillable = false,
    trackEvent,
  }: {
    onPointerDownEmitter: Emitter;
    options: readonly ToolOption[];
    activeToolType: string;
    defaultOption: string;
    class?: string;
    namePrefix: string;
    title: string;
    "data-testid": string;
    onToolChange: (type: string) => void;
    setActiveTool: (type: string) => void;
    displayedOption: ToolOption;
    fillable?: boolean;
    trackEvent?: (category: string, type: string, source: string) => void;
  } = $props();

  let isPopupOpen = $state(false);
  const SIDE_OFFSET = 32 / 2 + 10;

  const isActive = $derived(displayedOption.type === activeToolType);

  // If the active tool is no longer in this popover's options, close it.
  $effect(() => {
    if (!options.some((o) => o.type === activeToolType) && isPopupOpen) {
      isPopupOpen = false;
    }
  });

  // Close on canvas pointerdown.
  $effect(() => {
    const unsubscribe = onPointerDownEmitter.on(() => {
      isPopupOpen = false;
    });
    return () => unsubscribe?.();
  });
</script>

<BitsPopover.Root bind:open={() => isPopupOpen, (v) => (isPopupOpen = v)}>
  <BitsPopover.Trigger>
    {#snippet child({ props: triggerProps })}
      <ToolButton
        {...triggerProps}
        class={clsx(className, {
          fillable,
          active: options.some((o) => o.type === activeToolType),
        })}
        type="radio"
        icon={displayedOption.icon}
        checked={isActive}
        name="editor-current-shape"
        {title}
        aria-label={title}
        data-testid={dataTestId}
        onpointerdown={() => {
          isPopupOpen = !isPopupOpen;
          onToolChange(defaultOption);
        }}
      />
    {/snippet}
  </BitsPopover.Trigger>

  <BitsPopover.Content sideOffset={SIDE_OFFSET}>
    {#snippet child({ props })}
      <div {...props} class="tool-popover-content">
        {#each options as option (option.type)}
          <ToolButton
            class={clsx(className, { active: activeToolType === option.type })}
            type="radio"
            icon={option.icon}
            checked={activeToolType === option.type}
            name={`${namePrefix}-option`}
            title={option.title || capitalizeString(option.type)}
            keyBindingLabel=""
            aria-label={option.title || capitalizeString(option.type)}
            data-testid={`toolbar-${option.type}`}
            onchange={() => {
              if (activeToolType !== option.type) {
                trackEvent?.("toolbar", option.type, "ui");
              }
              setActiveTool(option.type);
              onToolChange?.(option.type);
            }}
          />
        {/each}
      </div>
    {/snippet}
  </BitsPopover.Content>
</BitsPopover.Root>
