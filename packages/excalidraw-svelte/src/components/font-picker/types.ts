// Shared types for the ported FontPicker.
import type { Snippet } from "svelte";

export type FontDescriptor = {
  value: number;
  icon: Snippet;
  text: string;
  testId?: string;
  deprecated?: true;
  badge?: {
    /** Mirrors upstream DropDownMenuItemBadgeType enum values. Kept loose so
     * consumers can pick whatever CSS class they want. */
    type: string;
    placeholder: string;
  };
};
