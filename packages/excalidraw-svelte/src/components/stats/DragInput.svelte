<script lang="ts" module>
  // Port of packages/excalidraw/components/Stats/DragInput.tsx
  // SCSS sidecar (DragInput.scss) loaded globally by host app.
  //
  // Generic over the element type `E` and the property tag `T`, with runtime
  // collaborators accepted as opaque structural props (`scene`, `app`,
  // `appState`, `setAppState`). The caller supplies concrete types from
  // upstream (ExcalidrawElement / Scene / AppState / AppClassProperties).

  export type DragInputCallbackArgs<T, E, App, AppState, Scene> = {
    accumulatedChange: number;
    instantChange: number;
    originalElements: readonly E[];
    originalElementsMap: Map<string, E>;
    shouldKeepAspectRatio: boolean;
    shouldChangeByStepSize: boolean;
    scene: Scene;
    nextValue?: number;
    property: T;
    originalAppState: AppState;
    setInputValue: (value: number) => void;
    app: App;
    setAppState: (next: Partial<AppState> | ((s: AppState) => Partial<AppState> | null)) => void;
  };

  export type DragFinishedCallbackArgs<E, App, AppState> = {
    app: App;
    setAppState: (next: Partial<AppState> | ((s: AppState) => Partial<AppState> | null)) => void;
    originalElements: readonly E[] | null;
    originalAppState: AppState;
  };

  // Smallest step the drag math considers significant (1 px → 1 unit by default).
  const SMALLEST_DELTA = 0.01;
</script>

<script
  lang="ts"
  generics="T extends string, E extends { id: string }, App, AppState, Scene"
>
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import clsx from "clsx";
  // @ts-ignore upstream package
  import { EVENT, KEYS, cloneJSON } from "@sveltedraw/common";
  // @ts-ignore upstream package
  import { CaptureUpdateAction, deepCopyElement } from "@sveltedraw/element";
  import InlineIcon from "../InlineIcon.svelte";

  type StructuralApp = App & {
    scene: {
      getNonDeletedElements: () => readonly E[];
      getNonDeletedElementsMap: () => Map<string, E>;
    };
    syncActionResult: (opts: { captureUpdate: unknown }) => void;
    focusContainer: () => void;
  };

  let {
    label,
    icon,
    value,
    elements,
    editable = true,
    shouldKeepAspectRatio = false,
    dragInputCallback,
    dragFinishedCallback,
    property,
    scene,
    app,
    appState,
    setAppState,
    sensitivity = 1,
  }: {
    label: string | Snippet;
    icon?: Snippet;
    /** Numeric value, or "Mixed" when selection has heterogeneous values. */
    value: number | "Mixed";
    elements: readonly E[];
    editable?: boolean;
    shouldKeepAspectRatio?: boolean;
    dragInputCallback: (
      args: DragInputCallbackArgs<T, E, StructuralApp, AppState, Scene>,
    ) => void;
    dragFinishedCallback?: (
      args: DragFinishedCallbackArgs<E, StructuralApp, AppState>,
    ) => void;
    property: T;
    scene: Scene;
    app: StructuralApp;
    appState: AppState;
    setAppState: (
      next: Partial<AppState> | ((s: AppState) => Partial<AppState> | null),
    ) => void;
    /** how many px you need to drag to get 1 unit change */
    sensitivity?: number;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);
  let labelEl: HTMLDivElement | null = $state(null);

  // svelte-ignore state_referenced_locally
  let inputValue = $state(value.toString());

  type StateRef = {
    originalAppState: AppState;
    originalElements: readonly E[];
    lastUpdatedValue: string;
    updatePending: boolean;
  };
  // svelte-ignore state_referenced_locally
  const stateRef: StateRef = {
    originalAppState: cloneJSON(appState),
    // svelte-ignore state_referenced_locally
    originalElements: elements,
    // svelte-ignore state_referenced_locally
    lastUpdatedValue: inputValue,
    updatePending: false,
  };

  // Sync external value into local input.
  $effect(() => {
    const next = value.toString();
    inputValue = next;
    stateRef.lastUpdatedValue = next;
  });

  type CallbacksRef = Partial<{
    handleInputValue: (
      updatedValue: string,
      els: readonly E[],
      appState: AppState,
    ) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
  }>;
  const callbacksRef: CallbacksRef = {};

  function handleInputValue(
    updatedValue: string,
    els: readonly E[],
    appStateSnap: AppState,
  ) {
    if (!stateRef.updatePending) return;
    stateRef.updatePending = false;

    const parsed = Number(updatedValue);
    if (isNaN(parsed)) {
      inputValue = value.toString();
      return;
    }

    const rounded = Number(parsed.toFixed(2));
    const original = Number(value);

    // Only fire callback when the rounded value actually differs (or original
    // was "Mixed"), to keep idempotency.
    if (
      isNaN(original) ||
      Math.abs(rounded - original) >= SMALLEST_DELTA
    ) {
      stateRef.lastUpdatedValue = updatedValue;
      dragInputCallback({
        accumulatedChange: 0,
        instantChange: 0,
        originalElements: els,
        originalElementsMap: app.scene.getNonDeletedElementsMap(),
        shouldKeepAspectRatio,
        shouldChangeByStepSize: false,
        scene,
        nextValue: rounded,
        property,
        originalAppState: appStateSnap,
        setInputValue: (v) => (inputValue = String(v)),
        app,
        setAppState,
      });
      app.syncActionResult({
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
  }
  callbacksRef.handleInputValue = handleInputValue;

  // On unmount, flush the pending input value.
  onMount(() => {
    return () => {
      const nextValue = inputEl?.value;
      if (nextValue) {
        callbacksRef.handleInputValue?.(
          nextValue,
          stateRef.originalElements,
          stateRef.originalAppState,
        );
      }
      if (callbacksRef.onPointerMove) {
        window.removeEventListener(
          EVENT.POINTER_MOVE,
          callbacksRef.onPointerMove,
          false,
        );
      }
      if (callbacksRef.onPointerUp) {
        window.removeEventListener(
          EVENT.POINTER_UP,
          callbacksRef.onPointerUp,
          false,
        );
      }
    };
  });

  function handleLabelPointerDown() {
    if (!inputEl || !editable) return;
    document.body.classList.add("excalidraw-cursor-resize");

    let lastPointer: { x: number; y: number } | null = null;

    let originalElementsMap: Map<string, E> | null = app.scene
      .getNonDeletedElements()
      .reduce((acc: Map<string, E>, element) => {
        // deepCopyElement is typed for the upstream ExcalidrawElement; we
        // cast through unknown because we're generic over a structural E.
        acc.set(
          element.id,
          deepCopyElement(element as unknown as never) as unknown as E,
        );
        return acc;
      }, new Map<string, E>());

    let originalElements: readonly E[] | null = elements.map(
      (element) => originalElementsMap!.get(element.id) as E,
    );

    const originalAppState: AppState = cloneJSON(appState);

    let accumulatedChange = 0;
    let stepChange = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (
        lastPointer &&
        originalElementsMap !== null &&
        originalElements !== null
      ) {
        const instantChange = event.clientX - lastPointer.x;
        if (instantChange !== 0) {
          stepChange += instantChange;
          if (Math.abs(stepChange) >= sensitivity) {
            stepChange =
              Math.sign(stepChange) *
              Math.floor(Math.abs(stepChange) / sensitivity);
            accumulatedChange += stepChange;
            dragInputCallback({
              accumulatedChange,
              instantChange: stepChange,
              originalElements,
              originalElementsMap,
              shouldKeepAspectRatio,
              shouldChangeByStepSize: event.shiftKey,
              property,
              scene,
              originalAppState,
              setInputValue: (v) => (inputValue = String(v)),
              app,
              setAppState,
            });
            stepChange = 0;
          }
        }
      }
      lastPointer = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => {
      window.removeEventListener(EVENT.POINTER_MOVE, onPointerMove, false);
      app.syncActionResult({ captureUpdate: CaptureUpdateAction.IMMEDIATELY });
      dragFinishedCallback?.({
        app,
        setAppState,
        originalElements,
        originalAppState,
      });
      lastPointer = null;
      accumulatedChange = 0;
      stepChange = 0;
      originalElements = null;
      originalElementsMap = null;
      document.body.classList.remove("excalidraw-cursor-resize");
      window.removeEventListener(EVENT.POINTER_UP, onPointerUp, false);
    };

    callbacksRef.onPointerMove = onPointerMove;
    callbacksRef.onPointerUp = onPointerUp;
    window.addEventListener(EVENT.POINTER_MOVE, onPointerMove, false);
    window.addEventListener(EVENT.POINTER_UP, onPointerUp, false);
  }
</script>

{#if editable}
  <div
    class={clsx("drag-input-container", { disabled: !editable })}
    data-testid={typeof label === "string" ? label : undefined}
  >
    <div
      class="drag-input-label"
      bind:this={labelEl}
      onpointerdown={handleLabelPointerDown}
      onpointerenter={() => {
        if (labelEl) labelEl.style.cursor = "ew-resize";
      }}
      role="presentation"
    >
      {#if icon}
        <InlineIcon {icon} />
      {:else if typeof label === "string"}
        {label}
      {:else}
        {@render label()}
      {/if}
    </div>
    <input
      class="drag-input"
      autocomplete="off"
      spellcheck="false"
      bind:this={inputEl}
      value={inputValue}
      disabled={!editable}
      onkeydown={(event) => {
        if (
          editable &&
          event.target instanceof HTMLInputElement &&
          event.key === KEYS.ENTER
        ) {
          handleInputValue(event.target.value, elements, appState);
          app.focusContainer();
        }
      }}
      oninput={(event) => {
        stateRef.updatePending = true;
        inputValue = (event.target as HTMLInputElement).value;
      }}
      onfocus={(event) => {
        (event.target as HTMLInputElement).select();
        stateRef.originalElements = elements;
        stateRef.originalAppState = cloneJSON(appState);
      }}
      onblur={(event) => {
        if (!inputValue) {
          inputValue = value.toString();
        } else if (editable) {
          handleInputValue(
            (event.target as HTMLInputElement).value,
            stateRef.originalElements,
            stateRef.originalAppState,
          );
        }
      }}
    />
  </div>
{/if}
