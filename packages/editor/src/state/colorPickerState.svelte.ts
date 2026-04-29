// Port of the jotai `activeColorPickerSectionAtom` from
// packages/engine/components/ColorPicker/colorPickerUtils.ts.
// Exposes a Svelte store with `section` reactive state so the various
// subcomponents (PickerColorList, ShadeList, CustomColorList, ColorInput)
// coordinate focus handoff without prop-drilling.

export type ActiveColorPickerSection =
  | "custom"
  | "baseColors"
  | "shades"
  | "hex"
  | null;

export class ColorPickerSectionStore {
  section = $state<ActiveColorPickerSection>(null);
  set(next: ActiveColorPickerSection) {
    this.section = next;
  }
}

/** Singleton (matches original — one ColorPicker open at a time). */
export const colorPickerSectionStore = new ColorPickerSectionStore();
