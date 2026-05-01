// Aggregator for built-in plugins. App.svelte installs these on top of
// whatever the host passes through the `plugins` prop. Hosts that want
// to disable a built-in pass plugins=[] (or filter the list) and assemble
// their own.

import { recentFilesPlugin } from "./recent-files/index.js";
import { settingsPlugin } from "./settings/index.js";
import { helpPlugin } from "./help/index.js";
import { templatesPlugin } from "./templates/index.js";
import { historyPanelPlugin } from "./history-panel/index.js";
import { alignmentPanelPlugin } from "./alignment-panel/index.js";
import { autoLayoutPanelPlugin } from "./autolayout-panel/index.js";
import { measurementPanelPlugin } from "./measurement-panel/index.js";
import { gridPanelPlugin } from "./grid-panel/index.js";
import { layerPanelPlugin } from "./layer-panel/index.js";
import { shapeLibraryPanelPlugin } from "./shape-library-panel/index.js";
import { connectorToolPlugin } from "./connector-tool/index.js";
import { laserPointerPlugin } from "./laser-pointer/index.js";
import { exportPanelPlugin } from "./export-panel/index.js";
import { commandPalettePlugin } from "./command-palette/index.js";
import { collabPlugin } from "./collab/index.svelte.js";
import { persistencePlugin } from "./persistence/index.js";
import { linkDialogPlugin } from "./link-dialog/index.js";
import { zOrderPlugin } from "./z-order/index.js";
import { groupPlugin } from "./group/index.js";
import type { SveltedrawPlugin } from "../types.js";

/**
 * The full list of plugins shipped with the editor by default. Order
 * affects toolbar registration order — group sorting still happens in
 * UtilityBar, so within-group ordering follows array order here.
 */
export const builtinPlugins: readonly SveltedrawPlugin[] = [
  recentFilesPlugin,
  settingsPlugin,
  helpPlugin,
  templatesPlugin,
  historyPanelPlugin,
  alignmentPanelPlugin,
  autoLayoutPanelPlugin,
  measurementPanelPlugin,
  gridPanelPlugin,
  layerPanelPlugin,
  shapeLibraryPanelPlugin,
  connectorToolPlugin,
  laserPointerPlugin,
  exportPanelPlugin,
  commandPalettePlugin,
  collabPlugin,
  persistencePlugin,
  linkDialogPlugin,
  zOrderPlugin,
  groupPlugin,
];
