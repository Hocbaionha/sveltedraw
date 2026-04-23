// Advanced Text Features system for Phase 13

export type TextAlignment = "left" | "center" | "right" | "justify";
export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";
export type TextDecoration = "none" | "underline" | "line-through";

export interface TextProperties {
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  textDecoration: TextDecoration;
  textColor: string;
  textAlignment: TextAlignment;
  lineHeight: number;
  rotation: number;
  maxWidth?: number;
}

export interface TextElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  text?: string;
  fontSize?: number;
  [key: string]: unknown;
}

export interface TextFormatConfig {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY = "Arial";
export const DEFAULT_TEXT_COLOR = "#000000";
export const DEFAULT_TEXT_ALIGNMENT = "left" as TextAlignment;
export const DEFAULT_LINE_HEIGHT = 1.5;

/**
 * Get text properties from an element
 */
export function getTextProperties(element: TextElement): Partial<TextProperties> {
  return {
    fontSize: (element.fontSize || DEFAULT_FONT_SIZE) as number,
    fontFamily: (element.fontFamily || DEFAULT_FONT_FAMILY) as string,
    fontWeight: (element.fontWeight || "normal") as FontWeight,
    fontStyle: (element.fontStyle || "normal") as FontStyle,
    textDecoration: (element.textDecoration || "none") as TextDecoration,
    textColor: (element.textColor || DEFAULT_TEXT_COLOR) as string,
    textAlignment: (element.textAlignment || DEFAULT_TEXT_ALIGNMENT) as TextAlignment,
    rotation: (element.angle || 0) as number,
    lineHeight: (element.lineHeight || DEFAULT_LINE_HEIGHT) as number,
  };
}

/**
 * Format text with given properties
 */
export function formatText(text: string, config: TextFormatConfig): string {
  let formatted = text;

  if (config.bold) {
    formatted = `**${formatted}**`;
  }
  if (config.italic) {
    formatted = `*${formatted}*`;
  }
  if (config.underline) {
    formatted = `__${formatted}__`;
  }
  if (config.strikethrough) {
    formatted = `~~${formatted}~~`;
  }

  return formatted;
}

/**
 * Calculate text dimensions based on properties
 */
export function calculateTextDimensions(
  text: string,
  fontSize: number,
  fontFamily: string,
  maxWidth?: number,
): { width: number; height: number } {
  // Approximate character width (monospace: ~0.6 * fontSize, serif: ~0.5 * fontSize)
  const charWidth = fontSize * 0.55;
  const lineCount = text.split('\n').length;

  let width = 0;
  for (const line of text.split('\n')) {
    width = Math.max(width, line.length * charWidth);
  }

  if (maxWidth && width > maxWidth) {
    width = maxWidth;
  }

  const height = fontSize * 1.2 * lineCount;

  return {
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
}

/**
 * Wrap text to fit within a given width
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string {
  const charWidth = fontSize * 0.55;
  const charsPerLine = Math.floor(maxWidth / charWidth);

  const lines: string[] = [];
  for (const line of text.split('\n')) {
    if (line.length <= charsPerLine) {
      lines.push(line);
    } else {
      let currentLine = '';
      for (const char of line) {
        if (currentLine.length >= charsPerLine) {
          lines.push(currentLine);
          currentLine = char;
        } else {
          currentLine += char;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Rotate text angle
 */
export function rotateText(angle: number): number {
  // Normalize angle to 0-360
  return ((angle % 360) + 360) % 360;
}

/**
 * Get CSS styles for text element
 */
export function getTextStyles(props: Partial<TextProperties>): Record<string, string> {
  return {
    fontSize: `${props.fontSize || DEFAULT_FONT_SIZE}px`,
    fontFamily: props.fontFamily || DEFAULT_FONT_FAMILY,
    fontWeight: props.fontWeight === "bold" ? "bold" : "normal",
    fontStyle: props.fontStyle === "italic" ? "italic" : "normal",
    textDecoration: props.textDecoration === "underline" ? "underline" :
                   props.textDecoration === "line-through" ? "line-through" : "none",
    color: props.textColor || DEFAULT_TEXT_COLOR,
    textAlign: props.textAlignment || DEFAULT_TEXT_ALIGNMENT,
    lineHeight: `${props.lineHeight || DEFAULT_LINE_HEIGHT}`,
    transform: props.rotation ? `rotate(${props.rotation}deg)` : "none",
  };
}

/**
 * Get format config from text properties
 */
export function getFormatConfig(props: Partial<TextProperties>): TextFormatConfig {
  return {
    bold: props.fontWeight === "bold",
    italic: props.fontStyle === "italic",
    underline: props.textDecoration === "underline",
    strikethrough: props.textDecoration === "line-through",
  };
}
