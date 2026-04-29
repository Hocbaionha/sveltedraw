// Barrel export for all ported Svelte 5 components (Phase 3)

// Batch 1 — simple, no external SCSS dependency
export { default as Spinner } from './Spinner.svelte';
export { default as ButtonSeparator } from './ButtonSeparator.svelte';
export { default as LoadingMessage } from './LoadingMessage.svelte';
export { default as InlineIcon } from './InlineIcon.svelte';

// Section moved to Phase 3 batch 3.1 leftovers (excalId via context with fallback).

// Batch 2 — slightly more complex, have SCSS counterparts
export { default as Island } from './Island.svelte';
export { default as StackRow } from './StackRow.svelte';
export { default as StackCol } from './StackCol.svelte';
export { default as Card } from './Card.svelte';
export { default as Paragraph } from './Paragraph.svelte';
export { default as Ellipsify } from './Ellipsify.svelte';

// Batch 3 — Phase 3 batch 2
export { default as Button } from './Button.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as Switch } from './Switch.svelte';
export { default as Range } from './Range.svelte';
export { default as TextField } from './TextField.svelte';

// Tooltip DOM utilities (framework-agnostic, used by Hyperlink and others)
export { getTooltipDiv, updateTooltipPosition } from './tooltipUtils.js';

// Batch 4 — Phase 3 batch 4 (Modal/Toast/DropdownMenu family)
// Skipped: Dialog + ContextMenu (need App-context bridge — Phase 6)
// Icons live in ../icons (Batch 3.3 codegen + hand-ported dynamics).
export { default as Modal } from './Modal.svelte';
export { default as Toast } from './Toast.svelte';
export { default as ToastProgressBar } from './ToastProgressBar.svelte';
export { default as DropdownMenu } from './DropdownMenu.svelte';
export { default as DropdownMenuTrigger } from './DropdownMenuTrigger.svelte';
export { default as DropdownMenuContent } from './DropdownMenuContent.svelte';
export { default as DropdownMenuItem } from './DropdownMenuItem.svelte';
export { default as DropdownMenuSeparator } from './DropdownMenuSeparator.svelte';
export { default as DropdownMenuGroup } from './DropdownMenuGroup.svelte';

// Phase 3 batch 3.2 — DropdownMenu remainder + RadioGroup
export { default as RadioGroup } from './RadioGroup.svelte';
export type { RadioGroupChoice } from './RadioGroup.svelte';
export { default as DropdownMenuItemContent } from './DropdownMenuItemContent.svelte';
export { default as DropdownMenuItemContentRadio } from './DropdownMenuItemContentRadio.svelte';
export { default as DropdownMenuItemCheckbox } from './DropdownMenuItemCheckbox.svelte';
export { default as DropdownMenuItemCustom } from './DropdownMenuItemCustom.svelte';
export { default as DropdownMenuItemLink } from './DropdownMenuItemLink.svelte';
export { default as DropdownMenuSub } from './DropdownMenuSub.svelte';
export { default as DropdownMenuSubTrigger } from './DropdownMenuSubTrigger.svelte';
export { default as DropdownMenuSubContent } from './DropdownMenuSubContent.svelte';

// Legacy Popover (manual position + focus trap, NOT bits-ui Popover)
export { default as Popover } from './Popover.svelte';

// Phase 3 batch 3.2 — Popover-based components
export { default as QuickSearch } from './QuickSearch.svelte';
export { default as Collapsible } from './Collapsible.svelte';
export { default as PropertiesPopover } from './PropertiesPopover.svelte';
export { default as ToolPopover } from './ToolPopover.svelte';
export type { ToolOption } from './ToolPopover.svelte';
export { default as UserList } from './UserList.svelte';
export type { UserListUserObject, RenderAvatarArg } from './UserList.svelte';
export { default as IconPicker } from './IconPicker.svelte';
export type { IconPickerOption, IconPickerSection } from './IconPicker.svelte';

// Phase 3 batch 3.2 — Dialog family (excalId/editorInterface via context;
// app-state cleanup via optional onBeforeClose prop wired in Phase 6).
export { default as Dialog } from './Dialog.svelte';
export type { DialogSize } from './Dialog.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as ErrorDialog } from './ErrorDialog.svelte';

// Phase 3 batch 3.2 — ContextMenu (presentational; items pre-resolved by Phase 6 wrapper)
export { default as ContextMenu, CONTEXT_MENU_SEPARATOR } from './ContextMenu.svelte';
export type { ContextMenuItem, ContextMenuRenderedItem } from './ContextMenu.svelte';

// Phase 4 batch 4 — toolbar buttons + small dialogs
export { default as PenModeButton } from './PenModeButton.svelte';
export { default as LockButton } from './LockButton.svelte';
export { default as HandButton } from './HandButton.svelte';
export { default as LaserPointerButton } from './LaserPointerButton.svelte';
export { default as ElementCanvasButton } from './ElementCanvasButton.svelte';
export { default as SveltedrawLogo } from './SveltedrawLogo.svelte';
export type { LogoSize } from './SveltedrawLogo.svelte';
export { default as ActiveConfirmDialog } from './ActiveConfirmDialog.svelte';
export { default as ShareableLinkDialog } from './ShareableLinkDialog.svelte';

// Phase 4 batch 5 — Dialog wrappers
export { default as JSONExportDialog } from './JSONExportDialog.svelte';
export type { JSONExportDialogProps } from './JSONExportDialog.svelte';
export { default as ElementLinkDialog } from './ElementLinkDialog.svelte';
export { default as PasteChartDialog } from './PasteChartDialog.svelte';
export type { ChartType } from './PasteChartDialog.svelte';
export * from './overwrite-confirm/index.js';
export * from './help-dialog/index.js';

// Phase 4 batch 6 — leaf primitives (HintViewer presentational; LiveCollaborationTrigger; Stats DragInput)
export { default as HintViewer } from './HintViewer.svelte';
export { default as LiveCollaborationTrigger } from './LiveCollaborationTrigger.svelte';
export * from './stats/index.js';

// Phase 4 batch 7 — ImageExportDialog (presentational; ActionManager + canvas rendering hoisted to caller props)
export * from './image-export-dialog/index.js';


// Phase 4 batch 1 — leaf buttons & toggles (no app context needed)
export { default as ButtonIcon } from './ButtonIcon.svelte';
export { default as ButtonIconCycle } from './ButtonIconCycle.svelte';
export { default as CheckboxItem } from './CheckboxItem.svelte';
export { default as Avatar } from './Avatar.svelte';
export { default as DialogActionButton } from './DialogActionButton.svelte';
export { default as FilledButton } from './FilledButton.svelte';
export type {
  FilledButtonVariant,
  FilledButtonColor,
  FilledButtonSize,
} from './FilledButton.svelte';
export { default as ToolButton } from './ToolButton.svelte';
export type { ToolButtonSize, ToolButtonType } from './ToolButton.svelte';
export { default as DarkModeToggle } from './DarkModeToggle.svelte';

// Phase 4 batch 2 — tunnels (port of context/tunnels.ts + hoc/withInternalFallback)
export { default as TunnelIn } from './TunnelIn.svelte';
export { default as TunnelOut } from './TunnelOut.svelte';
export { default as WithInternalFallback } from './WithInternalFallback.svelte';

// Phase 3 batch 3.1 leftovers — simple primitives
export { default as LinkButton } from './LinkButton.svelte';
export { default as HelpButton } from './HelpButton.svelte';
export { default as FixedSideContainer } from './FixedSideContainer.svelte';
export { default as ScrollableList } from './ScrollableList.svelte';
export { default as Section } from './Section.svelte';
export { default as RadioSelection } from './RadioSelection.svelte';

// Phase 4 batch 3 — FooterCenter + WelcomeScreen leaves
// WelcomeScreen.Center default content (Logo/MenuItemHelp/MenuItemLoadScene)
// deferred — needs SveltedrawLogo + ActionManager.
export { default as FooterCenter } from './FooterCenter.svelte';
export * from './welcome-screen/index.js';

// Phase 4 batch 8 — Sidebar + small leaves
export * from './sidebar/index.js';
export { default as ProjectName } from './ProjectName.svelte';
export { default as UnlockPopup } from './UnlockPopup.svelte';
export { default as FollowMode } from './FollowMode.svelte';

// Phase 4 batch 9 — MainMenu + Footer shells
export * from './main-menu/index.js';
export { default as Footer } from './Footer.svelte';

// Phase 4 batch 10 — ColorPicker family
export * from './color-picker/index.js';

// Phase 4 batch 11 — FontPicker family
export * from './font-picker/index.js';

// Phase 4 batch 12 — CommandPalette (shell)
export * from './command-palette/index.js';

// Phase 5 — Canvas wrappers + SVGLayer
export * from './canvases/index.js';
export { default as SVGLayer } from './SVGLayer.svelte';

// Phase 4 batch 13 — MobileMenu (layout shell; action snippets from caller)
export { default as MobileMenu } from './MobileMenu.svelte';

// Phase 4 batch 14 — EyeDropper (canvas color sampling; offsets + canvas injected)
export { default as EyeDropper } from './EyeDropper.svelte';
export type { EyeDropperChangeArgs } from './EyeDropper.svelte';

// Phase 5 complete — LayerUI (snippet-slot layout shell; Phase 6 wires actual
// components into the ~15 named slots).
export { default as LayerUI } from './LayerUI.svelte';
export type {
  LayerUIAppStateLike,
  LayerUISpacing,
} from './LayerUI.svelte';
export {
  LAYER_UI_SPACING_DEFAULT,
  LAYER_UI_SPACING_COMPACT,
} from './LayerUI.svelte';
