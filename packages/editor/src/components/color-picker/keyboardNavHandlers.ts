// Takes a DOM KeyboardEvent; `setActiveColorPickerSection` accepts the
// section value directly (no functional-update form).

// @ts-ignore
import { COLORS_PER_ROW, COLOR_PALETTE, KEYS } from "@sveltedraw/common";
import type {
  ColorPickerColor,
  ColorPalette,
  ColorPaletteCustom,
} from "@sveltedraw/common";

import {
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromColor,
} from "./colorPickerUtils.js";
import type { ActiveColorPickerSection } from "../../state/colorPickerState.svelte.js";

function arrowHandler(
  eventKey: string,
  currentIndex: number | null,
  length: number,
): number | undefined {
  const rows = Math.ceil(length / COLORS_PER_ROW);
  currentIndex = currentIndex ?? -1;

  switch (eventKey) {
    case "ArrowLeft": {
      const prevIndex = currentIndex - 1;
      return prevIndex < 0 ? length - 1 : prevIndex;
    }
    case "ArrowRight":
      return (currentIndex + 1) % length;
    case "ArrowDown": {
      const nextIndex = currentIndex + COLORS_PER_ROW;
      return nextIndex >= length ? currentIndex % COLORS_PER_ROW : nextIndex;
    }
    case "ArrowUp": {
      const prevIndex = currentIndex - COLORS_PER_ROW;
      const newIndex =
        prevIndex < 0 ? COLORS_PER_ROW * rows + prevIndex : prevIndex;
      return newIndex >= length ? undefined : newIndex;
    }
  }
  return undefined;
}

function hotkeyHandler(opts: {
  e: KeyboardEvent;
  colorObj: { colorName: ColorPickerColor; shade: number | null } | null;
  onChange: (color: string) => void;
  palette: ColorPaletteCustom;
  customColors: string[];
  setActiveColorPickerSection: (section: ActiveColorPickerSection) => void;
  activeShade: number;
}): boolean {
  const {
    e,
    colorObj,
    onChange,
    palette,
    customColors,
    setActiveColorPickerSection,
    activeShade,
  } = opts;

  if (colorObj?.shade != null) {
    if (
      ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(e.code) &&
      e.shiftKey
    ) {
      const newShade = Number(e.code.slice(-1)) - 1;
      const shades = palette[colorObj.colorName];
      if (Array.isArray(shades)) {
        onChange(shades[newShade]);
        setActiveColorPickerSection("shades");
        return true;
      }
    }
  }

  if (["1", "2", "3", "4", "5"].includes(e.key)) {
    const c = customColors[Number(e.key) - 1];
    if (c) {
      onChange(c);
      setActiveColorPickerSection("custom");
      return true;
    }
  }

  if (colorPickerHotkeyBindings.includes(e.key)) {
    const index = colorPickerHotkeyBindings.indexOf(e.key);
    const paletteKey = Object.keys(palette)[index] as keyof ColorPalette;
    const paletteValue = palette[paletteKey];
    const r = Array.isArray(paletteValue)
      ? paletteValue[activeShade]
      : paletteValue;
    onChange(r);
    setActiveColorPickerSection("baseColors");
    return true;
  }
  return false;
}

export function colorPickerKeyNavHandler(opts: {
  event: KeyboardEvent;
  activeColorPickerSection: ActiveColorPickerSection;
  palette: ColorPaletteCustom;
  color: string | null;
  onChange: (color: string) => void;
  customColors: string[];
  setActiveColorPickerSection: (section: ActiveColorPickerSection) => void;
  updateData?: (formData?: unknown) => void;
  activeShade: number;
  onEyeDropperToggle: (force?: boolean) => void;
  onEscape: (event: KeyboardEvent) => void;
}): boolean {
  const {
    event,
    activeColorPickerSection,
    palette,
    color,
    onChange,
    customColors,
    setActiveColorPickerSection,
    activeShade,
    onEyeDropperToggle,
    onEscape,
  } = opts;

  // Ctrl/Cmd+X: let the browser handle (copy/paste etc.)
  if (event[KEYS.CTRL_OR_CMD as keyof KeyboardEvent]) return false;

  if (event.key === KEYS.ESCAPE) {
    onEscape(event);
    return true;
  }

  if (event.key === KEYS.ALT) {
    onEyeDropperToggle(true);
    return true;
  }

  if (event.key === KEYS.I) {
    onEyeDropperToggle();
    return true;
  }

  const colorObj = getColorNameAndShadeFromColor({ color, palette });

  if (event.key === KEYS.TAB) {
    const sectionsMap: Record<NonNullable<ActiveColorPickerSection>, boolean> =
      {
        custom: !!customColors.length,
        baseColors: true,
        shades: colorObj?.shade != null,
        hex: true,
      };

    const sections = (
      Object.entries(sectionsMap) as [
        NonNullable<ActiveColorPickerSection>,
        boolean,
      ][]
    ).reduce((acc, [key, value]) => {
      if (value) acc.push(key);
      return acc;
    }, [] as ActiveColorPickerSection[]);

    const activeSectionIndex = sections.indexOf(activeColorPickerSection);
    const indexOffset = event.shiftKey ? -1 : 1;
    const nextSectionIndex =
      activeSectionIndex + indexOffset > sections.length - 1
        ? 0
        : activeSectionIndex + indexOffset < 0
          ? sections.length - 1
          : activeSectionIndex + indexOffset;

    const nextSection = sections[nextSectionIndex];
    if (nextSection) setActiveColorPickerSection(nextSection);

    if (nextSection === "custom") {
      onChange(customColors[0]);
    } else if (nextSection === "baseColors") {
      const baseColorName = Object.entries(palette).find(([name, shades]) => {
        if (Array.isArray(shades)) return shades.includes(color ?? "");
        return shades === color ? name : null;
      });
      if (!baseColorName) onChange(COLOR_PALETTE.black);
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  if (
    hotkeyHandler({
      e: event,
      colorObj,
      onChange,
      palette,
      customColors,
      setActiveColorPickerSection,
      activeShade,
    })
  ) {
    return true;
  }

  if (activeColorPickerSection === "shades" && colorObj) {
    const { shade } = colorObj;
    const newShade = arrowHandler(event.key, shade, COLORS_PER_ROW);
    if (newShade !== undefined) {
      const shades = palette[colorObj.colorName];
      if (Array.isArray(shades)) {
        onChange(shades[newShade]);
        return true;
      }
    }
  }

  if (activeColorPickerSection === "baseColors" && colorObj) {
    const { colorName } = colorObj;
    const colorNames = Object.keys(palette) as (keyof ColorPalette)[];
    const indexOfColorName = colorNames.indexOf(colorName);
    const newColorIndex = arrowHandler(
      event.key,
      indexOfColorName,
      colorNames.length,
    );
    if (newColorIndex !== undefined) {
      const newColorName = colorNames[newColorIndex];
      const newColorNameValue = palette[newColorName];
      onChange(
        Array.isArray(newColorNameValue)
          ? newColorNameValue[activeShade]
          : newColorNameValue,
      );
      return true;
    }
  }

  if (activeColorPickerSection === "custom") {
    const indexOfColor = color != null ? customColors.indexOf(color) : 0;
    const newColorIndex = arrowHandler(
      event.key,
      indexOfColor,
      customColors.length,
    );
    if (newColorIndex !== undefined) {
      onChange(customColors[newColorIndex]);
      return true;
    }
  }

  return false;
}
