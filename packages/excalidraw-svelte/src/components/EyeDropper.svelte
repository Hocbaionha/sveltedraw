<script lang="ts" module>
  // Port of packages/excalidraw/components/EyeDropper.tsx
  // SCSS sidecar (EyeDropper.scss) loaded globally by host app.
  //
  // Works by sampling pixels from the canvas via getImageData. Portable because
  // it takes `canvas` + viewport offsets + selected elements as props — Phase 6
  // sources them from AppState. The "active" state (upstream `activeEyeDropperAtom`)
  // is NOT owned here; caller conditionally mounts/unmounts this component.

  // @ts-ignore upstream
  import type { ColorPickerType } from "@sveltedraw/common";
  import type { SveltedrawElement } from "@sveltedraw/element/types";

  export type EyeDropperChangeArgs = {
    type: ColorPickerType;
    color: string;
    selectedElements: SveltedrawElement[];
    event: { altKey: boolean };
  };
</script>

<script lang="ts">
  import { Portal } from "bits-ui";
  // @ts-ignore upstream
  import { EVENT, KEYS, rgbToHex } from "@sveltedraw/common";

  let {
    canvas,
    excalidrawContainer,
    offsetLeft,
    offsetTop,
    lastViewportPosition,
    selectedElements,
    colorPickerType,
    onCancel,
    onSelect,
    onChange,
  }: {
    canvas: HTMLCanvasElement | null;
    excalidrawContainer: HTMLElement | null;
    offsetLeft: number;
    offsetTop: number;
    /** Last known pointer position — used to initialise the color preview
     * at the cursor before the first pointermove. */
    lastViewportPosition: { x: number; y: number };
    selectedElements: SveltedrawElement[];
    colorPickerType: ColorPickerType;
    onCancel: () => void;
    /** Fired on pointerup with the committed color. */
    onSelect: (color: string, event: PointerEvent) => void;
    /** Fired on pointermove while holding pointerdown (live preview). */
    onChange: (args: EyeDropperChangeArgs) => void;
  } = $props();

  // Backdrop container — mounts a div inside
  // `.excalidraw-eye-dropper-container` (if present) or body.
  let backdropEl: HTMLDivElement | null = $state(null);
  let previewEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (!backdropEl || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isHoldingPointerDown = false;

    function getCurrentColor({
      clientX,
      clientY,
    }: {
      clientX: number;
      clientY: number;
    }): string {
      const pixel = ctx!.getImageData(
        (clientX - offsetLeft) * window.devicePixelRatio,
        (clientY - offsetTop) * window.devicePixelRatio,
        1,
        1,
      ).data;
      return rgbToHex(pixel[0], pixel[1], pixel[2]);
    }

    function onMouseMove({
      clientX,
      clientY,
      altKey,
    }: {
      clientX: number;
      clientY: number;
      altKey: boolean;
    }) {
      if (!previewEl) return;
      // D5: flip the preview to the opposite side when it would clip
      // past the viewport edge. Measure once per frame; assume width/height
      // are fixed via CSS (upstream swatch is ~32×32px; allow 48px pad).
      const PAD = 48;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dx = clientX + 20 + PAD > vw ? -PAD : 20;
      const dy = clientY + 20 + PAD > vh ? -PAD : 20;
      previewEl.style.top = `${clientY + dy}px`;
      previewEl.style.left = `${clientX + dx}px`;
      const currentColor = getCurrentColor({ clientX, clientY });
      if (isHoldingPointerDown) {
        onChange({
          type: colorPickerType,
          color: currentColor,
          selectedElements,
          event: { altKey },
        });
      }
      previewEl.style.background = currentColor;
    }

    function onPointerDown(event: PointerEvent) {
      isHoldingPointerDown = true;
      // Don't preventDefault here or we'd lose subsequent pointermove events.
      event.stopImmediatePropagation();
    }

    function onPointerUp(event: PointerEvent) {
      isHoldingPointerDown = false;
      // Re-focus the editor; otherwise focus lands on <body>.
      excalidrawContainer?.focus();
      event.stopImmediatePropagation();
      event.preventDefault();
      onSelect(getCurrentColor(event), event);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancel();
      }
    }

    backdropEl.tabIndex = -1;
    backdropEl.focus();

    // Init preview at last known cursor so it doesn't pop in blank.
    onMouseMove({
      clientX: lastViewportPosition.x,
      clientY: lastViewportPosition.y,
      altKey: false,
    });

    backdropEl.addEventListener(EVENT.KEYDOWN, onKeyDown);
    backdropEl.addEventListener(EVENT.POINTER_DOWN, onPointerDown);
    backdropEl.addEventListener(EVENT.POINTER_UP, onPointerUp);
    window.addEventListener("pointermove", onMouseMove, { passive: true });
    window.addEventListener(EVENT.BLUR, onCancel);

    return () => {
      isHoldingPointerDown = false;
      backdropEl?.removeEventListener(EVENT.KEYDOWN, onKeyDown);
      backdropEl?.removeEventListener(EVENT.POINTER_DOWN, onPointerDown);
      backdropEl?.removeEventListener(EVENT.POINTER_UP, onPointerUp);
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener(EVENT.BLUR, onCancel);
    };
  });

  // Outside-click close. We only cancel when the click isn't on the
  // eye-dropper trigger (which owns re-opening) or the backdrop itself.
  $effect(() => {
    const handler = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest(
          ".excalidraw-eye-dropper-trigger, .excalidraw-eye-dropper-backdrop",
        )
      ) {
        return;
      }
      if (backdropEl?.contains(target as Node)) return;
      onCancel();
    };
    document.addEventListener("pointerdown", handler, true);
    return () =>
      document.removeEventListener("pointerdown", handler, true);
  });
</script>

<Portal to=".excalidraw-eye-dropper-container, body">
  <div
    bind:this={backdropEl}
    class="excalidraw-eye-dropper-backdrop"
  >
    <div bind:this={previewEl} class="excalidraw-eye-dropper-preview"></div>
  </div>
</Portal>
