import {
  CaptureUpdateAction,
  ShapeCache,
  getInitializedImageElements,
  isBindableElement,
  isBindingElement,
  isBoundToContainer,
  isInitializedImageElement,
  mutateElement,
  newElementWith,
  newImageElement,
  updateImageCache as _updateImageCache,
} from "@excalidraw/element";

import { KEYS, getGridPoint } from "@excalidraw/common";

import { activeEyeDropperAtom } from "../components/EyeDropper";

import type {
  ExcalidrawArrowElement,
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
} from "@excalidraw/element/types";
import type { BinaryFiles } from "../types";

import type { AppEngineContext } from "./AppEngineContext";

export function restoreReadyToEraseElements(ctx: AppEngineContext): void {
  ctx.setElementsPendingErasure(new Set());
  ctx.triggerRender();
}

export function eraseElements(ctx: AppEngineContext): void {
  let didChange = false;

  const elementsPendingErasure = ctx.getElementsPendingErasure();

  // Binding is double accounted on both elements and if one of them is
  // deleted, the binding should be removed
  elementsPendingErasure.forEach((id) => {
    const element = ctx.scene.getElement(id);
    if (isBindingElement(element)) {
      if (element.startBinding) {
        const bindable = ctx.scene.getElement(
          element.startBinding.elementId,
        )!;
        mutateElement(bindable, ctx.scene.getElementsMapIncludingDeleted(), {
          boundElements: bindable.boundElements!.filter(
            (e) => e.id !== element.id,
          ),
        });
      }
      if (element.endBinding) {
        const bindable = ctx.scene.getElement(
          element.endBinding.elementId,
        )!;
        mutateElement(bindable, ctx.scene.getElementsMapIncludingDeleted(), {
          boundElements: bindable.boundElements!.filter(
            (e) => e.id !== element.id,
          ),
        });
      }
    } else if (isBindableElement(element)) {
      element.boundElements?.forEach((boundElement) => {
        if (boundElement.type === "arrow") {
          const arrow = ctx.scene.getElement(
            boundElement.id,
          ) as ExcalidrawArrowElement;
          if (arrow?.startBinding?.elementId === element.id) {
            mutateElement(
              arrow,
              ctx.scene.getElementsMapIncludingDeleted(),
              {
                startBinding: null,
              },
            );
          }
          if (arrow?.endBinding?.elementId === element.id) {
            mutateElement(
              arrow,
              ctx.scene.getElementsMapIncludingDeleted(),
              {
                endBinding: null,
              },
            );
          }
        }
      });
    }
  });

  const elements = ctx.scene.getElementsIncludingDeleted().map((ele) => {
    if (
      elementsPendingErasure.has(ele.id) ||
      (ele.frameId && elementsPendingErasure.has(ele.frameId)) ||
      (isBoundToContainer(ele) &&
        elementsPendingErasure.has(ele.containerId))
    ) {
      didChange = true;
      return newElementWith(ele, { isDeleted: true });
    }
    return ele;
  });

  ctx.setElementsPendingErasure(new Set());

  if (didChange) {
    ctx.store.scheduleCapture();
    ctx.scene.replaceAllElements(elements);
  }
}

export function startImageCropping(
  ctx: AppEngineContext,
  image: ExcalidrawImageElement,
): void {
  ctx.store.scheduleCapture();
  ctx.setState({
    croppingElementId: image.id,
  });
}

export function finishImageCropping(ctx: AppEngineContext): void {
  if (ctx.getState().croppingElementId) {
    ctx.store.scheduleCapture();
    ctx.setState({
      croppingElementId: null,
    });
  }
}

export function clearImageShapeCache(
  ctx: AppEngineContext,
  filesMap?: BinaryFiles,
): void {
  const files = filesMap ?? ctx.files;
  ctx.scene.getNonDeletedElements().forEach((element) => {
    if (isInitializedImageElement(element) && files[element.fileId]) {
      ctx.imageCache.delete(element.fileId);
      ShapeCache.delete(element);
    }
  });
}

export function newImagePlaceholder(
  ctx: AppEngineContext,
  {
    sceneX,
    sceneY,
    addToFrameUnderCursor = true,
  }: {
    sceneX: number;
    sceneY: number;
    addToFrameUnderCursor?: boolean;
  },
) {
  const lastPointerDownEvent = ctx.getLastPointerDownEvent();
  const [gridX, gridY] = getGridPoint(
    sceneX,
    sceneY,
    lastPointerDownEvent?.[KEYS.CTRL_OR_CMD]
      ? null
      : ctx.getEffectiveGridSize(),
  );

  const topLayerFrame = addToFrameUnderCursor
    ? ctx.getTopLayerFrameAtSceneCoords({
        x: gridX,
        y: gridY,
      })
    : null;

  const state = ctx.getState();
  const placeholderSize = 100 / state.zoom.value;

  return newImageElement({
    type: "image",
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roughness: state.currentItemRoughness,
    roundness: null,
    opacity: state.currentItemOpacity,
    locked: false,
    frameId: topLayerFrame ? topLayerFrame.id : null,
    x: gridX - placeholderSize / 2,
    y: gridY - placeholderSize / 2,
    width: placeholderSize,
    height: placeholderSize,
  });
}

export function getLatestInitializedImageElement(
  ctx: AppEngineContext,
  imagePlaceholder: ExcalidrawImageElement,
  fileId: FileId,
) {
  const latestImageElement =
    ctx.scene.getElement(imagePlaceholder.id) ?? imagePlaceholder;

  return newElementWith(
    latestImageElement as InitializedExcalidrawImageElement,
    {
      fileId,
    },
  );
}

export function getImageNaturalDimensions(
  ctx: AppEngineContext,
  imageElement: ExcalidrawImageElement,
  imageHTML: HTMLImageElement,
) {
  const state = ctx.getState();
  const minHeight = Math.max(state.height - 120, 160);
  const maxHeight = Math.min(
    minHeight,
    Math.floor(state.height * 0.5) / state.zoom.value,
  );

  const height = Math.min(imageHTML.naturalHeight, maxHeight);
  const width = height * (imageHTML.naturalWidth / imageHTML.naturalHeight);

  const x = imageElement.x + imageElement.width / 2 - width / 2;
  const y = imageElement.y + imageElement.height / 2 - height / 2;

  return {
    x,
    y,
    width,
    height,
    crop: null,
  };
}

export function openEyeDropper(
  ctx: AppEngineContext,
  { type }: { type: "stroke" | "background" },
): void {
  ctx.updateEditorAtom(activeEyeDropperAtom, {
    swapPreviewOnAlt: true,
    colorPickerType:
      type === "stroke" ? "elementStroke" : "elementBackground",
    onSelect: (color: string, event: PointerEvent) => {
      const shouldUpdateStrokeColor =
        (type === "background" && event.altKey) ||
        (type === "stroke" && !event.altKey);
      const selectedElements = ctx.scene.getSelectedElements(ctx.getState());
      if (
        !selectedElements.length ||
        ctx.getState().activeTool.type !== "selection"
      ) {
        if (shouldUpdateStrokeColor) {
          ctx.syncActionResult({
            appState: { ...ctx.getState(), currentItemStrokeColor: color },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        } else {
          ctx.syncActionResult({
            appState: { ...ctx.getState(), currentItemBackgroundColor: color },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }
      } else {
        ctx.updateScene({
          elements: ctx.scene.getElementsIncludingDeleted().map((el) => {
            if (ctx.getState().selectedElementIds[el.id]) {
              return newElementWith(el, {
                [shouldUpdateStrokeColor ? "strokeColor" : "backgroundColor"]:
                  color,
              });
            }
            return el;
          }),
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      }
    },
    keepOpenOnAlt: false,
  });
}

export async function updateImageCache(
  ctx: AppEngineContext,
  elements: readonly InitializedExcalidrawImageElement[],
  files: BinaryFiles = ctx.files,
): Promise<{ updatedFiles: Map<FileId, true>; erroredFiles: Map<FileId, true> }> {
  const { updatedFiles, erroredFiles } = await _updateImageCache({
    imageCache: ctx.imageCache,
    fileIds: elements.map((element) => element.fileId),
    files,
  });

  if (erroredFiles.size) {
    ctx.store.scheduleAction(CaptureUpdateAction.NEVER);
    ctx.scene.replaceAllElements(
      ctx.scene.getElementsIncludingDeleted().map((element) => {
        if (
          isInitializedImageElement(element) &&
          erroredFiles.has(element.fileId)
        ) {
          return newElementWith(element, {
            status: "error",
          });
        }
        return element;
      }),
    );
  }

  return { updatedFiles, erroredFiles };
}

export async function addNewImagesToImageCache(
  ctx: AppEngineContext,
  imageElements: InitializedExcalidrawImageElement[] = getInitializedImageElements(
    ctx.scene.getNonDeletedElements(),
  ),
  files: BinaryFiles = ctx.files,
): Promise<void> {
  const uncachedImageElements = imageElements.filter(
    (element) => !element.isDeleted && !ctx.imageCache.has(element.fileId),
  );

  if (uncachedImageElements.length) {
    const { updatedFiles } = await updateImageCache(
      ctx,
      uncachedImageElements,
      files,
    );

    if (updatedFiles.size) {
      for (const element of uncachedImageElements) {
        if (updatedFiles.has(element.fileId)) {
          ShapeCache.delete(element);
        }
      }
    }

    if (updatedFiles.size) {
      ctx.scene.triggerUpdate();
    }
  }
}
