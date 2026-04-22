// Port of packages/excalidraw/components/Sidebar/common.ts
// Types + Svelte context key for the SidebarPropsContext.

import type { Snippet } from "svelte";

export type SidebarName = string;
export type SidebarTabName = string;

export type SidebarState = {
  name: SidebarName;
  tab?: SidebarTabName;
} | null;

export type SidebarProps = {
  name: SidebarName;
  children: Snippet;
  /** Called on sidebar open/close or tab change. */
  onStateChange?: (state: SidebarState) => void;
  /** supply alongside `docked` prop in order to make the Sidebar user-dockable */
  onDock?: (docked: boolean) => void;
  docked?: boolean;
  class?: string;
  /** @private internal — sidebars bundled with the editor set this so host
   *  sidebars take precedence via WithInternalFallback. */
  fallback?: boolean;
};

export type SidebarTriggerProps = {
  name: SidebarName;
  tab?: SidebarTabName;
  icon?: Snippet;
  children?: Snippet;
  title?: string;
  class?: string;
  onToggle?: (open: boolean) => void;
  style?: string;
};

export type SidebarPropsContextValue = {
  onDock?: (docked: boolean) => void;
  docked?: boolean;
  onCloseRequest: () => void;
  shouldRenderDockButton: boolean;
};

/**
 * Svelte context key for the SidebarPropsContext. Provided by SidebarInner so
 * SidebarHeader can access docked + onCloseRequest without prop-drilling.
 */
export const SIDEBAR_PROPS_KEY: unique symbol = Symbol("sidebarProps");

/**
 * Svelte context key for the currently-active sidebar tab. SidebarTabs
 * provides `{ tab: string, setTab: (tab) => void }`; SidebarTab + SidebarTabTrigger
 * read from it instead of talking to Radix/bits-ui directly. Phase 6 wires
 * SidebarTabs up to AppState.openSidebar.tab.
 */
export const SIDEBAR_TABS_KEY: unique symbol = Symbol("sidebarTabs");

export type SidebarTabsContextValue = {
  tab: SidebarTabName | undefined;
  setTab: (tab: SidebarTabName) => void;
};
