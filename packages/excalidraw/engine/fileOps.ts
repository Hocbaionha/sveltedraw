import type React from "react";

import {
  arrayToMap,
  MIME_TYPES,
  DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
  MAX_ALLOWED_FILE_BYTES,
  normalizeLink,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  embeddableURLValidator,
  getEmbedLink,
} from "@excalidraw/element";

import { duplicateElements } from "@excalidraw/element";

import { distributeLibraryItemsOnSquareGrid } from "../data/library";
import { parseLibraryJSON } from "../data/blob";
import { loadFromBlob } from "../data/blob";
import { parseDataTransferEvent } from "../clipboard";

import {
  CaptureUpdateAction,
  newElementWith,
  normalizeSVG,
  positionElementsOnGrid,
  makeNextSelectedElementIds,
  syncInvalidIndices,
} from "@excalidraw/element";

import type { LibraryItems } from "../types";

import { actionFinalize } from "../actions";
import {
  SVGStringToFile,
  generateIdFromFile,
  getDataURL,
  isSupportedImageFile,
  loadSceneOrLibraryFromBlob,
  normalizeFile,
  resizeImageFile,
} from "../data/blob";

import { ImageSceneDataError } from "../errors";
import { setCursor } from "../cursor";
import { t } from "../i18n";

import type {
  ExcalidrawImageElement,
  FileId,
  InitializedExcalidrawImageElement,
  NonDeleted,
} from "@excalidraw/element/types";

import type { AppEngineContext } from "./AppEngineContext";

export async function initializeImage(
  ctx: AppEngineContext,
  placeholderImageElement: ExcalidrawImageElement,
  imageFile: File,
): Promise<NonDeleted<InitializedExcalidrawImageElement>> {
  if (!isSupportedImageFile(imageFile)) {
    throw new Error(t("errors.unsupportedFileType"));
  }
  const mimeType = imageFile.type;

  setCursor(ctx.interactiveCanvas, "wait");

  if (mimeType === MIME_TYPES.svg) {
    try {
      imageFile = SVGStringToFile(
        normalizeSVG(await imageFile.text()),
        imageFile.name,
      );
    } catch (error: unknown) {
      console.warn(error);
      throw new Error(t("errors.svgImageInsertError"));
    }
  }

  const fileId = (await ((ctx.propGenerateIdForFile?.(
    imageFile,
  ) as Promise<FileId>) || generateIdFromFile(imageFile))) as FileId;

  if (!fileId) {
    console.warn(
      "Couldn't generate file id or the supplied `generateIdForFile` didn't resolve to one.",
    );
    throw new Error(t("errors.imageInsertError"));
  }

  const existingFileData = ctx.files[fileId];
  if (!existingFileData?.dataURL) {
    try {
      imageFile = await resizeImageFile(imageFile, {
        maxWidthOrHeight: DEFAULT_MAX_IMAGE_WIDTH_OR_HEIGHT,
      });
    } catch (error: unknown) {
      console.error("Error trying to resizing image file on insertion", error);
    }

    if (imageFile.size > MAX_ALLOWED_FILE_BYTES) {
      throw new Error(
        t("errors.fileTooBig", {
          maxSize: `${Math.trunc(MAX_ALLOWED_FILE_BYTES / 1024 / 1024)}MB`,
        }),
      );
    }
  }

  const dataURL =
    ctx.files[fileId]?.dataURL || (await getDataURL(imageFile));

  return new Promise<NonDeleted<InitializedExcalidrawImageElement>>(
    async (resolve, reject) => {
      try {
        let initializedImageElement = ctx.getLatestInitializedImageElement(
          placeholderImageElement,
          fileId,
        );

        ctx.addMissingFiles([
          {
            mimeType,
            id: fileId,
            dataURL,
            created: Date.now(),
            lastRetrieved: Date.now(),
          },
        ]);

        if (!ctx.imageCache.get(fileId)) {
          ctx.addNewImagesToImageCache();

          const { erroredFiles } = await ctx.updateImageCache([
            initializedImageElement,
          ]);

          if (erroredFiles.size) {
            throw new Error("Image cache update resulted with an error.");
          }
        }

        const imageHTML = await ctx.imageCache.get(fileId)?.image;

        if (
          imageHTML &&
          ctx.getState().newElement?.id !== initializedImageElement.id
        ) {
          initializedImageElement = ctx.getLatestInitializedImageElement(
            placeholderImageElement,
            fileId,
          );

          const naturalDimensions = ctx.getImageNaturalDimensions(
            initializedImageElement,
            imageHTML,
          );

          Object.assign(initializedImageElement, naturalDimensions);
        }

        resolve(initializedImageElement);
      } catch (error: unknown) {
        console.error(error);
        reject(new Error(t("errors.imageInsertError")));
      }
    },
  );
}

export async function insertImages(
  ctx: AppEngineContext,
  imageFiles: File[],
  sceneX: number,
  sceneY: number,
): Promise<void> {
  const gridPadding = 50 / ctx.getState().zoom.value;
  const placeholders = positionElementsOnGrid(
    imageFiles.map(() => ctx.newImagePlaceholder({ sceneX, sceneY })),
    sceneX,
    sceneY,
    gridPadding,
  );
  placeholders.forEach((el) => ctx.scene.insertElement(el));

  const initialized = await Promise.all(
    placeholders.map(async (placeholder, i) => {
      try {
        return await ctx.initializeImage(
          placeholder,
          await normalizeFile(imageFiles[i]),
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : t("errors.imageInsertError");
        ctx.setState({
          errorMessage: message,
        });
        return newElementWith(placeholder, { isDeleted: true });
      }
    }),
  );
  const initializedMap = arrayToMap(initialized);

  const positioned = positionElementsOnGrid(
    initialized.filter((el) => !el.isDeleted),
    sceneX,
    sceneY,
    gridPadding,
  );
  const positionedMap = arrayToMap(positioned);

  const nextElements = ctx.scene
    .getElementsIncludingDeleted()
    .map((el) => positionedMap.get(el.id) ?? initializedMap.get(el.id) ?? el);

  ctx.updateScene({
    appState: {
      selectedElementIds: makeNextSelectedElementIds(
        Object.fromEntries(positioned.map((el) => [el.id, true])),
        ctx.getState(),
      ),
    },
    elements: nextElements,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  ctx.setState({}, () => {
    ctx.actionManager.executeAction(actionFinalize);
  });
}

export async function handleAppOnDrop(
  ctx: AppEngineContext,
  event: React.DragEvent<HTMLDivElement>,
): Promise<void> {
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    event,
    ctx.getState(),
  );
  const dataTransferList = await parseDataTransferEvent(event);

  const fileItems = dataTransferList.getFiles();

  if (fileItems.length === 1) {
    const { file, fileHandle } = fileItems[0];

    if (
      file &&
      (file.type === MIME_TYPES.png || file.type === MIME_TYPES.svg)
    ) {
      try {
        const scene = await loadFromBlob(
          file,
          ctx.getState(),
          ctx.scene.getElementsIncludingDeleted(),
          fileHandle,
        );
        ctx.syncActionResult({
          ...scene,
          appState: {
            ...(scene.appState || ctx.getState()),
            isLoading: false,
          },
          replaceFiles: true,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return;
      } catch (error: unknown) {
        if ((error as Error)?.name !== "EncodingError") {
          throw new Error(t("alerts.couldNotLoadInvalidFile"));
        }
      }
    }
  }

  const imageFiles = fileItems
    .map((data) => data.file)
    .filter((file): file is File => Boolean(file && isSupportedImageFile(file)));

  if (imageFiles.length > 0 && ctx.isToolSupported("image")) {
    return ctx.insertImages(imageFiles, sceneX, sceneY);
  }
  const excalidrawLibrary_ids = dataTransferList.getData(
    MIME_TYPES.excalidrawlibIds,
  );
  const excalidrawLibrary_data = dataTransferList.getData(
    MIME_TYPES.excalidrawlib,
  );
  if (excalidrawLibrary_ids || excalidrawLibrary_data) {
    try {
      let libraryItems: LibraryItems | null = null;
      if (excalidrawLibrary_ids) {
        const { itemIds } = JSON.parse(excalidrawLibrary_ids) as {
          itemIds: string[];
        };
        const allLibraryItems = await ctx.getLibrary().getLatestLibrary();
        libraryItems = allLibraryItems.filter((item: { id: string }) =>
          itemIds.includes(item.id),
        );
      } else if (excalidrawLibrary_data) {
        libraryItems = parseLibraryJSON(excalidrawLibrary_data);
      }
      if (libraryItems?.length) {
        libraryItems = libraryItems.map((item) => ({
          ...item,
          elements: duplicateElements({
            type: "everything",
            elements: item.elements,
            randomizeSeed: true,
          }).duplicatedElements,
        }));

        ctx.addElementsFromPasteOrLibrary({
          elements: distributeLibraryItemsOnSquareGrid(libraryItems),
          position: event,
          files: null,
        });
      }
    } catch (error: unknown) {
      ctx.setState({
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
    }
    return;
  }

  if (fileItems.length > 0) {
    const { file, fileHandle } = fileItems[0];
    if (file) {
      await ctx.loadFileToCanvas(file, fileHandle);
    }
  }

  const textItem = dataTransferList.findByType(MIME_TYPES.text);

  if (textItem) {
    const text = textItem.value;
    if (
      text &&
      embeddableURLValidator(text, ctx.validateEmbeddable) &&
      (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(text) ||
        getEmbedLink(text)?.type === "video")
    ) {
      const embeddable = ctx.insertEmbeddableElement({
        sceneX,
        sceneY,
        link: normalizeLink(text),
      });
      if (embeddable) {
        ctx.store.scheduleCapture();
        ctx.setState({ selectedElementIds: { [embeddable.id]: true } });
      }
    }
  }
}

export async function loadFileToCanvas(
  ctx: AppEngineContext,
  file: File,
  fileHandle: FileSystemFileHandle | null,
): Promise<void> {
  file = await normalizeFile(file);
  try {
    const elements = ctx.scene.getElementsIncludingDeleted();
    let ret;
    try {
      ret = await loadSceneOrLibraryFromBlob(
        file,
        ctx.getState(),
        elements,
        fileHandle,
      );
    } catch (error: unknown) {
      const imageSceneDataError = error instanceof ImageSceneDataError;
      if (
        imageSceneDataError &&
        (error as { code?: string }).code === "IMAGE_NOT_CONTAINS_SCENE_DATA" &&
        !ctx.isToolSupported("image")
      ) {
        ctx.setState({
          isLoading: false,
          errorMessage: t("errors.imageToolNotSupported"),
        });
        return;
      }
      const errorMessage = imageSceneDataError
        ? t("alerts.cannotRestoreFromImage")
        : t("alerts.couldNotLoadInvalidFile");
      ctx.setState({
        isLoading: false,
        errorMessage,
      });
    }
    if (!ret) {
      return;
    }

    if (ret.type === MIME_TYPES.excalidraw) {
      syncInvalidIndices(elements.concat(ret.data.elements));

      ctx.store.scheduleMicroAction({
        action: CaptureUpdateAction.NEVER,
        elements,
        appState: undefined,
      });

      ctx.setState({ isLoading: true });
      ctx.syncActionResult({
        ...ret.data,
        appState: {
          ...(ret.data.appState || ctx.getState()),
          isLoading: false,
        },
        replaceFiles: true,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    } else if (ret.type === MIME_TYPES.excalidrawlib) {
      await ctx
        .getLibrary()
        .updateLibrary({
          libraryItems: file,
          merge: true,
          openLibraryMenu: true,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((error: any) => {
          console.error(error);
          ctx.setState({ errorMessage: t("errors.importLibraryError") });
        });
    }
  } catch (error: unknown) {
    ctx.setState({
      isLoading: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

