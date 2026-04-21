// Shared map for YouTube embed video states. Hoisted out of App.tsx so engine
// modules (handleIframeLikeCenterClick, onWindowMessage handler) can read/write
// the same Map.

import { YOUTUBE_STATES } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ValueOf } from "@excalidraw/common/utility-types";

export const YOUTUBE_VIDEO_STATES = new Map<
  ExcalidrawElement["id"],
  ValueOf<typeof YOUTUBE_STATES>
>();
