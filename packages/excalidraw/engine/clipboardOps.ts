/**
 * clipboardOps — cut/copy/paste operations extracted from App.tsx.
 *
 * Conversion pattern:
 *   BEFORE (App.tsx):  this.method(args)  → uses `this.state`, `this.setState`, etc.
 *   AFTER (here):      method(ctx, args)  → uses ctx.getState(), ctx.setState(), etc.
 *
 * Module-level globals from App.tsx (IS_PLAIN_PASTE, PLAIN_PASTE_TOAST_SHOWN)
 * are accessed via getter/setter on ctx so these functions remain
 * framework-agnostic.
 *
 * Phase 2b delegation status:
 *   All 7 methods extracted:
 *     onCut, onCopy, pasteFromClipboard, insertClipboardContent,
 *     addElementsFromMixedContentPaste, addTextFromPaste,
 *     addElementsFromPasteOrLibrary
 *
 * Note: withBatchedUpdates wrapping is kept at the App.tsx call site per the
 * scrollOps precedent.
 */

import {
  isWritableElement,
  normalizeEOL,
  viewportCoordsToSceneCoords,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  isSafari,
  getFontString,
  getLineHeight,
  getGridPoint,
  arrayToMap,
  normalizeLink,
  distance,
} from "@excalidraw/common";

import {
  getCommonBounds,
  newElementWith,
  duplicateElements,
  newTextElement,
  syncMovedIndices,
  excludeElementsInFramesFromSelection,
  filterElementsEligibleAsFrameChildren,
  addElementsToFrame,
  selectGroupsForSelectedElements,
  makeNextSelectedElementIds,
  isBoundToContainer,
  isTextElement,
  redrawTextBoundingBox,
  getContainerElement,
  getVisibleSceneBounds,
  wrapText,
  measureText,
  getLineHeightInPx,
  maybeParseEmbedSrc,
  embeddableURLValidator,
  getEmbedLink,
  normalizeText,
  convertToExcalidrawElements,
} from "@excalidraw/element";

import { Fonts } from "../fonts";
import { restoreElements } from "../data/restore";
import { ImageURLToFile, SVGStringToFile } from "../data/blob";
import {
  parseClipboard,
  parseDataTransferEvent,
  type ParsedDataTransferFile,
} from "../clipboard";
import { actionCut, actionCopy } from "../actions";
import { tryParseSpreadsheet } from "../charts";
import { isMaybeMermaidDefinition } from "../mermaid";
import { getShortcutKey } from "../shortcut";
import { editorJotaiStore } from "../editor-jotai";
import { isSidebarDockedAtom } from "../components/Sidebar/Sidebar";
import { t } from "../i18n";

import type { AppEngineContext } from "./AppEngineContext";
import type { ClipboardData, PastedMixedContent } from "../clipboard";
import type {
  ExcalidrawElement,
  NonDeleted,
  ExcalidrawEmbeddableElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";
import type { BinaryFiles } from "../types";

// ---------------------------------------------------------------------------
// 1. onCut (line ~3592)
// ---------------------------------------------------------------------------

export function onCut(ctx: AppEngineContext, event: ClipboardEvent): void {
  const isExcalidrawActive = ctx.excalidrawContainerRef.current?.contains(
    document.activeElement,
  );
  if (!isExcalidrawActive || isWritableElement(event.target)) {
    return;
  }
  ctx.actionManager.executeAction(actionCut, "keyboard", event);
  event.preventDefault();
  event.stopPropagation();
}

// ---------------------------------------------------------------------------
// 2. onCopy (line ~3604)
// ---------------------------------------------------------------------------

export function onCopy(ctx: AppEngineContext, event: ClipboardEvent): void {
  const isExcalidrawActive = ctx.excalidrawContainerRef.current?.contains(
    document.activeElement,
  );
  if (!isExcalidrawActive || isWritableElement(event.target)) {
    return;
  }
  ctx.actionManager.executeAction(actionCopy, "keyboard", event);
  event.preventDefault();
  event.stopPropagation();
}

// ---------------------------------------------------------------------------
// 3. insertClipboardContent (line ~3698) — private async
// ---------------------------------------------------------------------------

export async function insertClipboardContent(
  ctx: AppEngineContext,
  data: ClipboardData,
  dataTransferFiles: ParsedDataTransferFile[],
  isPlainPaste: boolean,
): Promise<void> {
  const state = ctx.getState();
  const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
    {
      clientX: ctx.lastViewportPosition.x,
      clientY: ctx.lastViewportPosition.y,
    },
    state,
  );

  // ------------------- Error -------------------
  if (data.errorMessage) {
    ctx.setState({ errorMessage: data.errorMessage });
    return;
  }

  // ------------------- Mixed content with no files -------------------
  if (dataTransferFiles.length === 0 && !isPlainPaste && data.mixedContent) {
    await addElementsFromMixedContentPaste(ctx, data.mixedContent, {
      isPlainPaste,
      sceneX,
      sceneY,
    });
    return;
  }

  // ------------------- Spreadsheet -------------------
  if (!isPlainPaste && data.text) {
    const result = tryParseSpreadsheet(data.text);
    if (result.ok) {
      ctx.setState({
        openDialog: {
          name: "charts",
          data: result.data,
          rawText: data.text,
        },
      });
      return;
    }
  }

  // ------------------- Images or SVG code -------------------
  const imageFiles = dataTransferFiles.map((d) => d.file);

  if (imageFiles.length === 0 && data.text && !isPlainPaste) {
    const trimmedText = data.text.trim();
    if (trimmedText.startsWith("<svg") && trimmedText.endsWith("</svg>")) {
      // ignore SVG validation/normalization which will be done during image
      // initialization
      imageFiles.push(SVGStringToFile(trimmedText));
    }
  }

  if (imageFiles.length > 0) {
    if (ctx.isToolSupported("image")) {
      await ctx.insertImages(imageFiles, sceneX, sceneY);
    } else {
      ctx.setState({ errorMessage: t("errors.imageToolNotSupported") });
    }
    return;
  }

  // ------------------- Elements -------------------
  if (data.elements) {
    const elements = (
      data.programmaticAPI
        ? convertToExcalidrawElements(
            data.elements as ExcalidrawElementSkeleton[],
          )
        : data.elements
    ) as readonly ExcalidrawElement[];
    // TODO: remove formatting from elements if isPlainPaste
    addElementsFromPasteOrLibrary(ctx, {
      elements,
      files: data.files || null,
      position:
        ctx.editorInterface.formFactor === "desktop" ? "cursor" : "center",
      retainSeed: isPlainPaste,
    });
    return;
  }

  // ------------------- Only textual stuff remaining -------------------
  if (!data.text) {
    return;
  }

  // ------------------- Successful Mermaid -------------------
  if (!isPlainPaste && isMaybeMermaidDefinition(data.text)) {
    const api = await import("@excalidraw/mermaid-to-excalidraw");
    try {
      const { elements: skeletonElements, files = {} } =
        await api.parseMermaidToExcalidraw(data.text);

      const elements = convertToExcalidrawElements(skeletonElements, {
        regenerateIds: true,
      });

      addElementsFromPasteOrLibrary(ctx, {
        elements,
        files,
        position:
          ctx.editorInterface.formFactor === "desktop" ? "cursor" : "center",
      });

      return;
    } catch (err: any) {
      console.warn(
        `parsing pasted text as mermaid definition failed: ${err.message}`,
      );
    }
  }

  // ------------------- Pure embeddable URLs -------------------
  const nonEmptyLines = normalizeEOL(data.text)
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const embbeddableUrls = nonEmptyLines
    .map((str) => maybeParseEmbedSrc(str))
    .filter(
      (string) =>
        embeddableURLValidator(string, ctx.validateEmbeddable) &&
        (/^(http|https):\/\/[^\s/$.?#].[^\s]*$/.test(string) ||
          getEmbedLink(string)?.type === "video"),
    );

  if (
    !isPlainPaste &&
    embbeddableUrls.length > 0 &&
    embbeddableUrls.length === nonEmptyLines.length
  ) {
    const embeddables: NonDeleted<ExcalidrawEmbeddableElement>[] = [];
    for (const url of embbeddableUrls) {
      const prevEmbeddable: ExcalidrawEmbeddableElement | undefined =
        embeddables[embeddables.length - 1];
      const embeddable = ctx.insertEmbeddableElement({
        sceneX: prevEmbeddable
          ? prevEmbeddable.x + prevEmbeddable.width + 20
          : sceneX,
        sceneY,
        link: normalizeLink(url),
      });
      if (embeddable) {
        embeddables.push(embeddable);
      }
    }
    if (embeddables.length) {
      ctx.store.scheduleCapture();
      ctx.setState({
        selectedElementIds: Object.fromEntries(
          embeddables.map((embeddable) => [embeddable.id, true]),
        ),
      });
    }
    return;
  }

  // ------------------- Text -------------------
  addTextFromPaste(ctx, data.text, isPlainPaste);
}

// ---------------------------------------------------------------------------
// 4. pasteFromClipboard (line ~3864) — public async
//
// Note: `IS_PLAIN_PASTE` is a module-level bool in App.tsx. We expose it via
// ctx.getIsPlainPaste(). withBatchedUpdates is applied at the App.tsx call site.
// ---------------------------------------------------------------------------

export async function pasteFromClipboard(
  ctx: AppEngineContext,
  event: ClipboardEvent,
): Promise<void> {
  const isPlainPaste = !!ctx.getIsPlainPaste();

  // #686
  const target = document.activeElement;
  const isExcalidrawActive =
    ctx.excalidrawContainerRef.current?.contains(target);
  if (event && !isExcalidrawActive) {
    return;
  }

  const elementUnderCursor = document.elementFromPoint(
    ctx.lastViewportPosition.x,
    ctx.lastViewportPosition.y,
  );
  if (
    event &&
    (!(elementUnderCursor instanceof HTMLCanvasElement) ||
      isWritableElement(target))
  ) {
    return;
  }

  // must be called in the same frame (thus before any awaits) as the paste
  // event else some browsers (FF...) will clear the clipboardData
  // (something something security)
  const dataTransferList = await parseDataTransferEvent(event);

  const filesList = dataTransferList.getFiles();

  const data = await parseClipboard(dataTransferList, isPlainPaste);

  if (ctx.onPaste) {
    try {
      if ((await ctx.onPaste(data, event)) === false) {
        return;
      }
    } catch (error: any) {
      console.error(error);
    }
  }

  await insertClipboardContent(ctx, data, filesList, isPlainPaste);

  ctx.setActiveTool(
    { type: ctx.getState().preferredSelectionTool.type },
    true,
  );
  event?.preventDefault();
}

// ---------------------------------------------------------------------------
// 5. addElementsFromPasteOrLibrary (line ~3917) — public
// ---------------------------------------------------------------------------

export function addElementsFromPasteOrLibrary(
  ctx: AppEngineContext,
  opts: {
    elements: readonly ExcalidrawElement[];
    files: BinaryFiles | null;
    position: { clientX: number; clientY: number } | "cursor" | "center";
    retainSeed?: boolean;
    fitToContent?: boolean;
  },
): void {
  const state = ctx.getState();
  const elements = restoreElements(opts.elements, null, {
    deleteInvisibleElements: true,
  });
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);

  const elementsCenterX = distance(minX, maxX) / 2;
  const elementsCenterY = distance(minY, maxY) / 2;

  const clientX =
    typeof opts.position === "object"
      ? opts.position.clientX
      : opts.position === "cursor"
      ? ctx.lastViewportPosition.x
      : state.width / 2 + state.offsetLeft;
  const clientY =
    typeof opts.position === "object"
      ? opts.position.clientY
      : opts.position === "cursor"
      ? ctx.lastViewportPosition.y
      : state.height / 2 + state.offsetTop;

  const { x, y } = viewportCoordsToSceneCoords(
    { clientX, clientY },
    state,
  );

  const dx = x - elementsCenterX;
  const dy = y - elementsCenterY;

  const [gridX, gridY] = getGridPoint(dx, dy, ctx.getEffectiveGridSize());

  const { duplicatedElements } = duplicateElements({
    type: "everything",
    elements: elements.map((element) => {
      return newElementWith(element, {
        x: element.x + gridX - minX,
        y: element.y + gridY - minY,
      });
    }),
    randomizeSeed: !opts.retainSeed,
  });

  const prevElements = ctx.scene.getElementsIncludingDeleted();
  let nextElements = [...prevElements, ...duplicatedElements];

  const mappedNewSceneElements = ctx.onDuplicate?.(
    nextElements,
    prevElements,
  );

  nextElements = mappedNewSceneElements || nextElements;

  syncMovedIndices(nextElements, arrayToMap(duplicatedElements));

  const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({ x, y });

  if (topLayerFrame) {
    const eligibleElements = filterElementsEligibleAsFrameChildren(
      duplicatedElements,
      topLayerFrame,
    );
    addElementsToFrame(
      nextElements,
      eligibleElements,
      topLayerFrame,
      state,
    );
  }

  ctx.scene.replaceAllElements(nextElements);

  duplicatedElements.forEach((newElement) => {
    if (isTextElement(newElement) && isBoundToContainer(newElement)) {
      const container = getContainerElement(
        newElement,
        ctx.scene.getElementsMapIncludingDeleted(),
      );
      redrawTextBoundingBox(newElement, container, ctx.scene);
    }
  });

  // paste event may not fire FontFace loadingdone event in Safari, hence loading font faces manually
  if (isSafari) {
    Fonts.loadElementsFonts(duplicatedElements).then((fontFaces) => {
      ctx.fonts.onLoaded(fontFaces);
    });
  }

  if (opts.files) {
    ctx.addMissingFiles(opts.files);
  }

  const nextElementsToSelect =
    excludeElementsInFramesFromSelection(duplicatedElements);

  ctx.store.scheduleCapture();
  ctx.setState(
    {
      ...state,
      // keep sidebar (presumably the library) open if it's docked and
      // can fit.
      //
      // Note, we should close the sidebar only if we're dropping items
      // from library, not when pasting from clipboard. Alas.
      openSidebar:
        state.openSidebar &&
        ctx.editorInterface.canFitSidebar &&
        editorJotaiStore.get(isSidebarDockedAtom)
          ? state.openSidebar
          : null,
      ...selectGroupsForSelectedElements(
        {
          editingGroupId: null,
          selectedElementIds: nextElementsToSelect.reduce(
            (acc: Record<ExcalidrawElement["id"], true>, element) => {
              if (!isBoundToContainer(element)) {
                acc[element.id] = true;
              }
              return acc;
            },
            {},
          ),
        },
        ctx.scene.getNonDeletedElements(),
        state,
        // Pass null: we don't have the App instance here; the fallback
        // (getSelectedElements) is equivalent for paste operations.
        null,
      ),
    },
    () => {
      if (opts.files) {
        ctx.addNewImagesToImageCache();
      }
    },
  );
  ctx.setActiveTool({ type: state.preferredSelectionTool.type }, true);

  if (opts.fitToContent) {
    ctx.scrollToContent(duplicatedElements, {
      fitToContent: true,
      canvasOffsets: ctx.getEditorUIOffsets(),
    });
  }
}

// ---------------------------------------------------------------------------
// 6. addElementsFromMixedContentPaste (line ~4070) — private async
// ---------------------------------------------------------------------------

export async function addElementsFromMixedContentPaste(
  ctx: AppEngineContext,
  mixedContent: PastedMixedContent,
  {
    isPlainPaste,
    sceneX,
    sceneY,
  }: { isPlainPaste: boolean; sceneX: number; sceneY: number },
): Promise<void> {
  if (
    !isPlainPaste &&
    mixedContent.some((node) => node.type === "imageUrl") &&
    ctx.isToolSupported("image")
  ) {
    const imageURLs = mixedContent
      .filter((node) => node.type === "imageUrl")
      .map((node) => node.value);
    const responses = await Promise.all(
      imageURLs.map(async (url) => {
        try {
          return { file: await ImageURLToFile(url) };
        } catch (error: any) {
          let errorMessage = error.message;
          if (error.cause === "FETCH_ERROR") {
            errorMessage = t("errors.failedToFetchImage");
          } else if (error.cause === "UNSUPPORTED") {
            errorMessage = t("errors.unsupportedFileType");
          }
          return { errorMessage };
        }
      }),
    );

    const imageFiles = responses
      .filter((response): response is { file: File } => !!response.file)
      .map((response) => response.file);
    await ctx.insertImages(imageFiles, sceneX, sceneY);
    const error = responses.find((response) => !!response.errorMessage);
    if (error && error.errorMessage) {
      ctx.setState({ errorMessage: error.errorMessage });
    }
  } else {
    const textNodes = mixedContent.filter((node) => node.type === "text");
    if (textNodes.length) {
      addTextFromPaste(
        ctx,
        textNodes.map((node) => node.value).join("\n\n"),
        isPlainPaste,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 7. addTextFromPaste (line ~4121) — private (canonical: clipboardOps)
// ---------------------------------------------------------------------------

export function addTextFromPaste(
  ctx: AppEngineContext,
  text: string,
  isPlainPaste = false,
): void {
  const state = ctx.getState();
  const { x, y } = viewportCoordsToSceneCoords(
    {
      clientX: ctx.lastViewportPosition.x,
      clientY: ctx.lastViewportPosition.y,
    },
    state,
  );

  const textElementProps = {
    x,
    y,
    strokeColor: state.currentItemStrokeColor,
    backgroundColor: state.currentItemBackgroundColor,
    fillStyle: state.currentItemFillStyle,
    strokeWidth: state.currentItemStrokeWidth,
    strokeStyle: state.currentItemStrokeStyle,
    roundness: null as null,
    roughness: state.currentItemRoughness,
    opacity: state.currentItemOpacity,
    text,
    fontSize: state.currentItemFontSize,
    fontFamily: state.currentItemFontFamily,
    textAlign: DEFAULT_TEXT_ALIGN,
    verticalAlign: DEFAULT_VERTICAL_ALIGN,
    locked: false,
  };
  const fontString = getFontString({
    fontSize: textElementProps.fontSize,
    fontFamily: textElementProps.fontFamily,
  });
  const lineHeight = getLineHeight(textElementProps.fontFamily);
  const [x1, , x2] = getVisibleSceneBounds(state);
  // long texts should not go beyond 800 pixels in width nor should it go below 200 px
  const maxTextWidth = Math.max(Math.min((x2 - x1) * 0.5, 800), 200);
  const LINE_GAP = 10;
  let currentY = y;

  const lines = isPlainPaste ? [text] : text.split("\n");
  const textElements = lines.reduce(
    (acc: ExcalidrawTextElement[], line, idx) => {
      const originalText = normalizeText(line).trim();
      if (originalText.length) {
        const topLayerFrame = ctx.getTopLayerFrameAtSceneCoords({
          x,
          y: currentY,
        });

        let metrics = measureText(originalText, fontString, lineHeight);
        const isTextUnwrapped = metrics.width > maxTextWidth;

        const wrappedText = isTextUnwrapped
          ? wrapText(originalText, fontString, maxTextWidth)
          : originalText;

        metrics = isTextUnwrapped
          ? measureText(wrappedText, fontString, lineHeight)
          : metrics;

        const startX = x - metrics.width / 2;
        const startY = currentY - metrics.height / 2;

        const element = newTextElement({
          ...textElementProps,
          x: startX,
          y: startY,
          text: wrappedText,
          originalText,
          lineHeight,
          autoResize: !isTextUnwrapped,
          frameId: topLayerFrame ? topLayerFrame.id : null,
        });
        acc.push(element);
        currentY += element.height + LINE_GAP;
      } else {
        const prevLine = lines[idx - 1]?.trim();
        // add paragraph only if previous line was not empty, IOW don't add
        // more than one empty line
        if (prevLine) {
          currentY +=
            getLineHeightInPx(textElementProps.fontSize, lineHeight) +
            LINE_GAP;
        }
      }

      return acc;
    },
    [],
  );

  if (textElements.length === 0) {
    return;
  }

  ctx.scene.insertElements(textElements);
  ctx.store.scheduleCapture();
  ctx.setState({
    selectedElementIds: makeNextSelectedElementIds(
      Object.fromEntries(textElements.map((el) => [el.id, true])),
      state,
    ),
  });

  if (
    !isPlainPaste &&
    textElements.length > 1 &&
    ctx.getPlainPasteToastShown() === false &&
    ctx.editorInterface.formFactor !== "phone"
  ) {
    ctx.setToast({
      message: t("toast.pasteAsSingleElement", {
        shortcut: getShortcutKey("CtrlOrCmd+Shift+V"),
      }),
      duration: 5000,
    });
    ctx.setPlainPasteToastShown(true);
  }
}
