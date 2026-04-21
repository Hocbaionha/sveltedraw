// Barrel export for all ported Svelte 5 components (Phase 3)

// Batch 1 — simple, no external SCSS dependency
export { default as Spinner } from './Spinner.svelte';
export { default as ButtonSeparator } from './ButtonSeparator.svelte';
export { default as LoadingMessage } from './LoadingMessage.svelte';
export { default as InlineIcon } from './InlineIcon.svelte';

// Section.tsx — SKIPPED: depends on useExcalidrawContainer (AppContext). Needs Phase 6.

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

// HintViewer — depends on UIAppState / AppClassProperties / app.scene → needs Phase 1 store + Phase 6 context
// LinkButton — depends on FilledButton (not yet ported)
// DarkModeToggle — depends on ToolButton (not yet ported)
