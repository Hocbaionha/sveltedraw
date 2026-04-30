// Plugin-local state for the Export panel.
//
// `active` toggles the modal overlay. `options` is the in-flight export
// configuration the panel mutates as the user adjusts inputs. `presets`
// is the list of width/height/scale/quality presets the panel offers
// alongside custom values.

import {
  EXPORT_PRESETS,
  getDefaultExportOptions,
  type ExportOptions,
  type ExportPreset,
} from "../../../export/types.js";

export type ExportPanelState = {
  active: boolean;
  options: ExportOptions;
  presets: ExportPreset[];
};

export function createState(): ExportPanelState {
  const s: ExportPanelState = $state({
    active: false,
    options: getDefaultExportOptions(),
    presets: [...EXPORT_PRESETS],
  });
  return s;
}
