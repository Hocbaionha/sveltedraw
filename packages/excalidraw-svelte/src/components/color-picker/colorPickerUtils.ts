// Port of packages/excalidraw/components/ColorPicker/colorPickerUtils.ts
// (non-atom helpers only — the atom is ported to
// state/colorPickerState.svelte.ts).

// @ts-ignore upstream types
import type {
  ColorPickerColor,
  ColorPaletteCustom,
} from "@sveltedraw/common";
// @ts-ignore
import { MAX_CUSTOM_COLORS_USED_IN_CANVAS } from "@sveltedraw/common";
import type { ExcalidrawElement } from "@sveltedraw/element/types";

export type ColorPickerType =
  | "canvasBackground"
  | "elementBackground"
  | "elementStroke";

export function getColorNameAndShadeFromColor({
  palette,
  color,
}: {
  palette: ColorPaletteCustom;
  color: string | null;
}): { colorName: ColorPickerColor; shade: number | null } | null {
  if (!color) return null;
  for (const [colorName, colorVal] of Object.entries(palette)) {
    if (Array.isArray(colorVal)) {
      const shade = colorVal.indexOf(color);
      if (shade > -1) return { colorName: colorName as ColorPickerColor, shade };
    } else if (colorVal === color) {
      return { colorName: colorName as ColorPickerColor, shade: null };
    }
  }
  return null;
}

export const colorPickerHotkeyBindings = [
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

export function isCustomColor({
  color,
  palette,
}: {
  color: string;
  palette: ColorPaletteCustom;
}) {
  const paletteValues = Object.values(palette).flat();
  return !paletteValues.includes(color);
}

export function getMostUsedCustomColors(
  elements: readonly ExcalidrawElement[],
  type: "elementBackground" | "elementStroke",
  palette: ColorPaletteCustom,
) {
  const elementColorTypeMap = {
    elementBackground: "backgroundColor",
    elementStroke: "strokeColor",
  } as const;

  const relevant = elements.filter((element) => {
    if (element.isDeleted) return false;
    const color = (element as unknown as Record<string, string>)[
      elementColorTypeMap[type]
    ];
    return isCustomColor({ color, palette });
  });

  const colorCountMap = new Map<string, number>();
  relevant.forEach((element) => {
    const color = (element as unknown as Record<string, string>)[
      elementColorTypeMap[type]
    ];
    colorCountMap.set(color, (colorCountMap.get(color) ?? 0) + 1);
  });

  return [...colorCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((c) => c[0])
    .slice(0, MAX_CUSTOM_COLORS_USED_IN_CANVAS);
}
