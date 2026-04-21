import { flushSync } from "react-dom";

import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import {
  fixBindingsAfterDeletion,
  getContainerElement,
  isNonDeletedElement,
  isTextElement,
  makeNextSelectedElementIds,
  newElementWith,
  refreshTextDimensions,
  updateBoundElements,
} from "@excalidraw/element";

import { setCursorForShape } from "../cursor";
import { withBatchedUpdates } from "../reactUtils";
import { textWysiwyg } from "../wysiwyg/textWysiwyg";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export function handleTextWysiwyg(
  ctx: AppEngineContext,
  element: ExcalidrawTextElement,
  {
    isExistingElement = false,
    initialCaretSceneCoords = null,
  }: {
    isExistingElement?: boolean;
    initialCaretSceneCoords?: { x: number; y: number } | null;
  },
): void {
  const elementsMap = ctx.scene.getElementsMapIncludingDeleted();

  const updateElement = (nextOriginalText: string, isDeleted: boolean) => {
    ctx.scene.replaceAllElements([
      ...ctx.scene.getElementsIncludingDeleted().map((_element) => {
        if (_element.id === element.id && isTextElement(_element)) {
          return newElementWith(_element, {
            originalText: nextOriginalText,
            isDeleted: isDeleted ?? _element.isDeleted,
            ...refreshTextDimensions(
              _element,
              getContainerElement(_element, elementsMap),
              elementsMap,
              nextOriginalText,
            ),
          });
        }
        return _element;
      }),
    ]);
  };

  textWysiwyg({
    id: element.id,
    canvas: ctx.canvas!,
    getViewportCoords: (x, y) => {
      const { x: viewportX, y: viewportY } = sceneCoordsToViewportCoords(
        {
          sceneX: x,
          sceneY: y,
        },
        ctx.getState(),
      );
      return [
        viewportX - ctx.getState().offsetLeft,
        viewportY - ctx.getState().offsetTop,
      ];
    },
    onChange: withBatchedUpdates((nextOriginalText: string) => {
      updateElement(nextOriginalText, false);
      if (isNonDeletedElement(element)) {
        updateBoundElements(element, ctx.scene);
      }
    }),
    onSubmit: withBatchedUpdates(
      ({
        viaKeyboard,
        nextOriginalText,
      }: {
        viaKeyboard: boolean;
        nextOriginalText: string;
      }) => {
        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);

        const elementIdToSelect = viaKeyboard
          ? element.containerId || (!isDeleted ? element.id : null)
          : null;

        if (elementIdToSelect) {
          flushSync(() => {
            ctx.setState((prevState) => ({
              selectedElementIds: makeNextSelectedElementIds(
                {
                  ...prevState.selectedElementIds,
                  [elementIdToSelect]: true,
                },
                prevState,
              ),
            }));
          });
        }

        if (isDeleted) {
          fixBindingsAfterDeletion(ctx.scene.getNonDeletedElements(), [
            element,
          ]);
        }

        if (!isDeleted || isExistingElement) {
          ctx.store.scheduleCapture();
        }

        flushSync(() => {
          ctx.setState({
            newElement: null,
            editingTextElement: null,
          });
        });

        if (ctx.getState().activeTool.locked) {
          setCursorForShape(ctx.interactiveCanvas, ctx.getState());
        }

        ctx.focusContainer();
      },
    ),
    element,
    excalidrawContainer: ctx.excalidrawContainerRef.current,
    app: ctx.getApp() as unknown as Parameters<typeof textWysiwyg>[0]["app"],
    initialCaretSceneCoords,
    autoSelect: !ctx.editorInterface.isTouchScreen,
  });

  ctx.deselectElements();

  updateElement(element.originalText, false);
}
