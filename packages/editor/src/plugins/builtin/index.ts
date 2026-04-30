// Aggregator for built-in plugins. App.svelte installs these on top of
// whatever the host passes through the `plugins` prop. Hosts that want
// to disable a built-in pass plugins=[] (or filter the list) and assemble
// their own.

import { recentFilesPlugin } from "./recent-files/index.js";
import type { SveltedrawPlugin } from "../types.js";

/**
 * The full list of plugins shipped with the editor by default. Order
 * affects toolbar registration order — group sorting still happens in
 * UtilityBar, so within-group ordering follows array order here.
 */
export const builtinPlugins: readonly SveltedrawPlugin[] = [
  recentFilesPlugin,
];
