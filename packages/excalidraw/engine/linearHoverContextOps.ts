import { CURSOR_TYPE } from "@excalidraw/common";

import {
  LinearElementEditor,
  handleFocusPointHover,
  hitElementItself,
  isElbowArrow,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import { setCursor } from "../cursor";
import {
  actionAddToLibrary,
  actionBringForward,
  actionBringToFront,
  actionCopy,
  actionCopyAsPng,
  actionCopyAsSvg,
  copyText,
  actionCopyStyles,
  actionCut,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionFlipHorizontal,
  actionFlipVertical,
  actionGroup,
  actionPasteStyles,
  actionSelectAll,
  actionSendBackward,
  actionSendToBack,
  actionToggleGridMode,
  actionToggleStats,
  actionToggleZenMode,
  actionUnbindText,
  actionBindText,
  actionUngroup,
  actionLink,
  actionToggleElementLock,
  actionToggleLinearEditor,
  actionToggleObjectsSnapMode,
  actionToggleArrowBinding,
  actionToggleMidpointSnapping,
  actionToggleCropEditor,
} from "../actions";
import { actionWrapTextInContainer } from "../actions/actionBoundText";
import { actionPaste } from "../actions/actionClipboard";
import { actionCopyElementLink } from "../actions/actionElementLink";
import { actionUnlockAllElements } from "../actions/actionElementLock";
import {
  actionRemoveAllElementsFromFrame,
  actionSelectAllElementsInFrame,
  actionWrapSelectionInFrame,
} from "../actions/actionFrame";
import { actionTextAutoResize } from "../actions/actionTextAutoResize";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";
import { CONTEXT_MENU_SEPARATOR } from "../components/ContextMenu";

import type {
  ContextMenuItems,
} from "../components/ContextMenu";
import type {
  ExcalidrawArrowElement,
} from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export function handleHoverSelectedLinearElement(
  ctx: AppEngineContext,
  linearElementEditor: LinearElementEditor,
  scenePointerX: number,
  scenePointerY: number,
): void {
  const elementsMap = ctx.scene.getNonDeletedElementsMap();

  const element = LinearElementEditor.getElement(
    linearElementEditor.elementId,
    elementsMap,
  );

  if (!element) {
    return;
  }
  if (ctx.getState().selectedLinearElement) {
    let hoverPointIndex = -1;
    let segmentMidPointHoveredCoords = null;
    if (
      hitElementItself({
        point: pointFrom(scenePointerX, scenePointerY),
        element,
        elementsMap,
        threshold: ctx.getElementHitThreshold(element),
      })
    ) {
      hoverPointIndex = LinearElementEditor.getPointIndexUnderCursor(
        element,
        elementsMap,
        ctx.getState().zoom,
        scenePointerX,
        scenePointerY,
      );
      segmentMidPointHoveredCoords =
        LinearElementEditor.getSegmentMidpointHitCoords(
          linearElementEditor,
          { x: scenePointerX, y: scenePointerY },
          ctx.getState(),
          ctx.scene.getNonDeletedElementsMap(),
        );
      const isHoveringAPointHandle = isElbowArrow(element)
        ? hoverPointIndex === 0 ||
          hoverPointIndex === element.points.length - 1
        : hoverPointIndex >= 0;
      if (isHoveringAPointHandle || segmentMidPointHoveredCoords) {
        setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
      } else if (hitTestEngine(ctx, scenePointerX, scenePointerY, element)) {
        if (
          !isElbowArrow(element) ||
          !(element.startBinding || element.endBinding)
        ) {
          if (
            ctx.getState().activeTool.type !== "lasso" ||
            Object.keys(ctx.getState().selectedElementIds).length > 0
          ) {
            setCursor(ctx.interactiveCanvas, CURSOR_TYPE.MOVE);
          }
        }
      }
    } else if (hitTestEngine(ctx, scenePointerX, scenePointerY, element)) {
      if (
        !isElbowArrow(element) ||
        !(element.startBinding || element.endBinding)
      ) {
        if (
          ctx.getState().activeTool.type !== "lasso" ||
          Object.keys(ctx.getState().selectedElementIds).length > 0
        ) {
          setCursor(ctx.interactiveCanvas, CURSOR_TYPE.MOVE);
        }
      }
    }

    const sel = ctx.getState().selectedLinearElement!;
    if (sel.hoverPointIndex !== hoverPointIndex) {
      ctx.setState({
        selectedLinearElement: {
          ...sel,
          hoverPointIndex,
        },
      });
    }

    const sel2 = ctx.getState().selectedLinearElement!;
    if (
      !LinearElementEditor.arePointsEqual(
        sel2.segmentMidPointHoveredCoords,
        segmentMidPointHoveredCoords,
      )
    ) {
      ctx.setState({
        selectedLinearElement: {
          ...sel2,
          segmentMidPointHoveredCoords,
        },
      });
    }

    let hoveredFocusPointBinding: "start" | "end" | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrow = element as any;
    if (arrow.startBinding || arrow.endBinding) {
      hoveredFocusPointBinding = handleFocusPointHover(
        element as ExcalidrawArrowElement,
        scenePointerX,
        scenePointerY,
        ctx.scene,
        ctx.getState(),
      );
    }

    const sel3 = ctx.getState().selectedLinearElement!;
    if (sel3.hoveredFocusPointBinding !== hoveredFocusPointBinding) {
      ctx.setState({
        selectedLinearElement: {
          ...sel3,
          isDragging: false,
          hoveredFocusPointBinding,
        },
      });
    }

    if (hoveredFocusPointBinding) {
      setCursor(ctx.interactiveCanvas, CURSOR_TYPE.POINTER);
    }
  } else {
    setCursor(ctx.interactiveCanvas, CURSOR_TYPE.AUTO);
  }
}

// Use the same hit test the App.tsx delegate uses (via textOps.hitElement
// already wired through ctx-style imports). Inline ctx call for clarity.
import { hitElement as hitTestEngine } from "./textOps";

export function getContextMenuItems(
  ctx: AppEngineContext,
  type: "canvas" | "element",
): ContextMenuItems {
  const options: ContextMenuItems = [];

  options.push(actionCopyAsPng, actionCopyAsSvg);

  if (type === "canvas") {
    if (ctx.getState().viewModeEnabled) {
      return [
        ...options,
        actionToggleGridMode,
        actionToggleZenMode,
        actionToggleViewMode,
        actionToggleStats,
      ];
    }

    return [
      actionPaste,
      CONTEXT_MENU_SEPARATOR,
      actionCopyAsPng,
      actionCopyAsSvg,
      copyText,
      CONTEXT_MENU_SEPARATOR,
      actionSelectAll,
      actionUnlockAllElements,
      CONTEXT_MENU_SEPARATOR,
      actionToggleGridMode,
      actionToggleObjectsSnapMode,
      actionToggleArrowBinding,
      actionToggleMidpointSnapping,
      actionToggleZenMode,
      actionToggleViewMode,
      actionToggleStats,
    ];
  }

  options.push(copyText);

  if (ctx.getState().viewModeEnabled) {
    return [actionCopy, ...options];
  }

  const zIndexActions: ContextMenuItems =
    ctx.editorInterface.formFactor === "desktop"
      ? [
          CONTEXT_MENU_SEPARATOR,
          actionSendBackward,
          actionBringForward,
          actionSendToBack,
          actionBringToFront,
        ]
      : [];

  return [
    CONTEXT_MENU_SEPARATOR,
    actionCut,
    actionCopy,
    actionPaste,
    CONTEXT_MENU_SEPARATOR,
    actionSelectAllElementsInFrame,
    actionRemoveAllElementsFromFrame,
    actionWrapSelectionInFrame,
    CONTEXT_MENU_SEPARATOR,
    actionToggleCropEditor,
    CONTEXT_MENU_SEPARATOR,
    ...options,
    CONTEXT_MENU_SEPARATOR,
    actionCopyStyles,
    actionPasteStyles,
    CONTEXT_MENU_SEPARATOR,
    actionGroup,
    actionTextAutoResize,
    actionUnbindText,
    actionBindText,
    actionWrapTextInContainer,
    actionUngroup,
    CONTEXT_MENU_SEPARATOR,
    actionAddToLibrary,
    ...zIndexActions,
    CONTEXT_MENU_SEPARATOR,
    actionFlipHorizontal,
    actionFlipVertical,
    CONTEXT_MENU_SEPARATOR,
    actionToggleLinearEditor,
    CONTEXT_MENU_SEPARATOR,
    actionLink,
    actionCopyElementLink,
    CONTEXT_MENU_SEPARATOR,
    actionDuplicateSelection,
    actionToggleElementLock,
    CONTEXT_MENU_SEPARATOR,
    actionDeleteSelected,
  ];
}
