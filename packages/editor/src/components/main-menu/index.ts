// Barrel for MainMenu. DefaultItems NOT ported — each item is a thin wrapper
// around ActionManager.executeAction(actionX) which needs the Phase 6
// ActionManager bridge. Host apps can compose their own items using the
// already-ported DropdownMenuItem / DropdownMenuItemCheckbox / etc.
export { default as MainMenu } from "./MainMenu.svelte";
