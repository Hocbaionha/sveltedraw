import type { App } from "@excalidraw/excalidraw/types";

import { LinearElementEditor } from "../linearElementEditor";

import { handleFocusPointDrag } from "./focus";

export const maybeHandleArrowPointlikeDrag = ({
  app,
  event,
}: {
  app: App;
  event: KeyboardEvent | React.KeyboardEvent<Element> | PointerEvent;
}): boolean => {
  const appState = app.state;
  if (appState.selectedLinearElement && app.lastPointerMoveCoords) {
    // Update focus point status if the binding mode is changing
    if (appState.selectedLinearElement.draggedFocusPointBinding) {
      handleFocusPointDrag(
        appState.selectedLinearElement,
        app.scene.getNonDeletedElementsMap(),
        app.lastPointerMoveCoords,
        app.scene,
        appState,
        app.getEffectiveGridSize(),
        event.altKey,
      );
      return true;
    } else if (
      appState.selectedLinearElement.hoverPointIndex !== null &&
      app.lastPointerMoveEvent &&
      appState.selectedLinearElement.initialState.lastClickedPoint >= 0 &&
      appState.selectedLinearElement.isDragging
    ) {
      LinearElementEditor.handlePointDragging(
        app.lastPointerMoveEvent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app as any, // post-Phase-9 App type is a stub
        app.lastPointerMoveCoords.x,
        app.lastPointerMoveCoords.y,
        appState.selectedLinearElement,
      );
      return true;
    }
  }
  return false;
};
