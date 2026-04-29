// Scene-mutation helpers used by clipboard/drop, the toolbar frame button,
// and the embed-paste path. Each function:
//   - constructs a scene element (image / iframe / frame)
//   - appends it via scene.replaceAllElements({ skipValidation: true })
//   - calls pushHistory + bumpSceneRepaint
// Image insertion also writes the blob to IndexedDB (fire-and-forget).

// @ts-ignore — upstream
import { newImageElement } from "@excalidraw/element";
// @ts-ignore — upstream
import { randomId, DEFAULT_ELEMENT_PROPS } from "@excalidraw/common";
import { idbGet, idbPut } from "./idb.js";
import { blobToDataURL, loadImage } from "./imageHelpers.js";
import { isEmbeddableUrl } from "./embedUrls.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;
type SceneLike = {
  getElementsIncludingDeleted: () => AnyEl[];
  getNonDeletedElements: () => AnyEl[];
  replaceAllElements: (els: AnyEl[], opts?: { skipValidation?: boolean }) => void;
};

type ImageCacheValue = { image: HTMLImageElement; mimeType: string };

export type SceneInsertsDeps = {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  imageCacheMap: Map<string, ImageCacheValue>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  binaryFiles: Record<string, AnyEl>;
  /** Phase-11 frames Map; read for next-frame naming. */
  getFrameCount: () => number;
  /** Viewport→scene coord mapper for drop events. */
  toSceneCoords: (clientX: number, clientY: number) => { x: number; y: number };
  /** Paste suppression while text WYSIWYG is open. */
  isTextEditing: () => boolean;
};

export type SceneInsertsApi = {
  insertImageFromBlob: (blob: Blob, sceneX?: number, sceneY?: number) => Promise<void>;
  insertEmbed: (url: string, sceneX: number, sceneY: number) => void;
  createFrameAtCenter: () => string | undefined;
  tryRestoreSceneFromPng: (blob: Blob) => Promise<boolean>;
  onContainerPaste: (event: ClipboardEvent) => Promise<void>;
  onContainerDragOver: (event: DragEvent) => void;
  onContainerDrop: (event: DragEvent) => Promise<void>;
  /** Walk image elements + pull binaries from IndexedDB into the cache.
   *  Call on mount after tryLoad() restores the scene. */
  rehydrateImagesFromIdb: () => Promise<void>;
};

export function createSceneInserts(deps: SceneInsertsDeps): SceneInsertsApi {
  const {
    getScene,
    appState,
    pushHistory,
    bumpSceneRepaint,
    imageCacheMap,
    binaryFiles,
    getFrameCount,
    toSceneCoords,
    isTextEditing,
  } = deps;

  const insertImageFromBlob = async (
    blob: Blob,
    sceneX?: number,
    sceneY?: number,
  ): Promise<void> => {
    const scene = getScene();
    if (!scene) return;
    const dataURL = await blobToDataURL(blob);
    const img = await loadImage(dataURL);

    const fileId = randomId();
    const mimeType = blob.type || "image/png";
    imageCacheMap.set(fileId, { image: img, mimeType });
    const record = { id: fileId, mimeType, dataURL, created: Date.now() };
    binaryFiles[fileId] = record;
    // Persist binary to IndexedDB so reload restores the image bytes.
    // Fire-and-forget; failures (quota, private mode) log and move on.
    idbPut(record);

    // Scale down if large — fit within 600px max side at 100% zoom.
    const MAX_SIDE = 600;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (Math.max(w, h) > MAX_SIDE) {
      const k = MAX_SIDE / Math.max(w, h);
      w *= k;
      h *= k;
    }

    const zoomV = appState.zoom?.value || 1;
    const cx = sceneX ?? appState.width / 2 / zoomV - (appState.scrollX ?? 0);
    const cy = sceneY ?? appState.height / 2 / zoomV - (appState.scrollY ?? 0);

    const el = newImageElement({
      type: "image",
      x: cx - w / 2,
      y: cy - h / 2,
      width: w,
      height: h,
      fileId,
      status: "saved",
      strokeColor: DEFAULT_ELEMENT_PROPS.strokeColor,
      backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
      fillStyle: DEFAULT_ELEMENT_PROPS.fillStyle,
      strokeWidth: DEFAULT_ELEMENT_PROPS.strokeWidth,
      strokeStyle: DEFAULT_ELEMENT_PROPS.strokeStyle,
      roughness: DEFAULT_ELEMENT_PROPS.roughness,
      opacity: DEFAULT_ELEMENT_PROPS.opacity,
    } as AnyEl);
    const existing = scene.getElementsIncludingDeleted();
    scene.replaceAllElements([...existing, el], { skipValidation: true });
    appState.selectedElementIds = { [el.id]: true };
    pushHistory();
    bumpSceneRepaint();
  };

  // B1: minimal Frame creation. Upstream's `frame` element type is already
  // handled by the staticScene renderer (draws outline + title bar). We make
  // a scene element of that type and auto-bind any element whose center falls
  // inside the frame rect via element.frameId.
  const createFrameAtCenter = (): string | undefined => {
    const scene = getScene();
    if (!scene) return undefined;
    const zoomV = appState.zoom?.value ?? 1;
    const scX = appState.scrollX ?? 0;
    const scY = appState.scrollY ?? 0;
    const sceneCX = appState.width / 2 / zoomV - scX;
    const sceneCY = appState.height / 2 / zoomV - scY;
    const W = 480;
    const H = 320;
    const frameX = sceneCX - W / 2;
    const frameY = sceneCY - H / 2;
    const frameId = `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const frame: AnyEl = {
      id: frameId, type: "frame",
      x: frameX, y: frameY, width: W, height: H, angle: 0,
      // NOTE: the frame static renderer (renderElement.ts:872-876) hard-codes
      // `FRAME_STYLE.strokeColor` and ignores `element.strokeColor`, so this
      // field is only consulted if the element is ever converted to a non-frame
      // type. Matching the FRAME_STYLE default (#bbb) keeps data consistent
      // with what's visually rendered and what upstream .excalidraw JSON files
      // carry. The real fix for the "frame invisible after insert" report is
      // auto-selecting the new frame below so the interactive canvas adds a
      // dashed selection box around it — that's the visual signal the user
      // was missing, not the stroke color itself.
      strokeColor: "#bbb", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
      roughness: 0, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: null, locked: false, roundness: null,
      // Fractional index — Scene assigns one via syncInvalidIndices, but only
      // when replaceAllElements is called WITHOUT `skipValidation`. This call
      // skips validation (for the bound-elements rewrite), so we must seed
      // a starter value; otherwise the layers panel sorts frames into random
      // positions and subsequent mutations can throw in validateFractionalIndices.
      index: "a0" as AnyEl["index"],
      name: `Frame ${getFrameCount() + 1}`,
    };
    const existing = scene.getNonDeletedElements();
    // Bind any existing element whose center is inside the frame.
    const nextElements = existing.map((el: AnyEl) => {
      if (el.id === frameId) return el;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const insideX = cx >= frameX && cx <= frameX + W;
      const insideY = cy >= frameY && cy <= frameY + H;
      if (insideX && insideY) return { ...el, frameId };
      return el;
    });
    // Frame renders FIRST so it sits behind its children — acting as a
    // container, not an overlay. Array order == z-order.
    scene.replaceAllElements([frame, ...nextElements], { skipValidation: true });
    // Auto-select the new frame so the user sees selection handles + dashed
    // outline immediately (mirrors `insertCapturedSelection` at line 120).
    // Without this, the user clicks "Insert frame" and sees no visible change
    // — the faint grey stroke alone is not enough of a feedback signal.
    appState.selectedElementIds = { [frameId]: true };
    pushHistory();
    bumpSceneRepaint();
    return frameId;
  };

  const insertEmbed = (url: string, sceneX: number, sceneY: number): void => {
    const scene = getScene();
    if (!scene) return;
    const id = `embed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const el: AnyEl = {
      id, type: "iframe",
      x: sceneX, y: sceneY, width: 480, height: 270, angle: 0,
      strokeColor: "#1e1e1e", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid",
      roughness: 0, opacity: 100,
      seed: Math.floor(Math.random() * 2 ** 31),
      versionNonce: 1, version: 1, isDeleted: false,
      groupIds: [], frameId: null, boundElements: null,
      updated: Date.now(), link: url, locked: false, roundness: null,
      customData: { embedUrl: url },
    };
    const existing = scene.getNonDeletedElements();
    scene.replaceAllElements([...existing, el], { skipValidation: true });
    pushHistory();
    bumpSceneRepaint();
  };

  // B4: try to decode the Excalidraw scene metadata embedded in a PNG. Returns
  // true if the scene was restored; false if the PNG is a plain image (caller
  // falls through to insertImageFromBlob). No throws — failure is a soft signal.
  const tryRestoreSceneFromPng = async (blob: Blob): Promise<boolean> => {
    const scene = getScene();
    if (!scene) return false;
    try {
      const { decodePngMetadata } = await import("@excalidraw/excalidraw/data/image");
      const raw = await decodePngMetadata(blob);
      const data = JSON.parse(raw);
      const parsed = Array.isArray(data?.elements) ? data.elements : null;
      if (!parsed || parsed.length === 0) return false;
      scene.replaceAllElements(parsed, { skipValidation: true });
      pushHistory();
      bumpSceneRepaint();
      return true;
    } catch {
      // Plain PNG (no tEXt chunk) or legacy / malformed metadata.
      return false;
    }
  };

  const onContainerPaste = async (event: ClipboardEvent): Promise<void> => {
    if (isTextEditing()) return;
    const items = event.clipboardData?.items;
    if (!items) return;
    // B3: text URL paste → embed element (before image-item path)
    const text = event.clipboardData?.getData("text/plain")?.trim();
    if (text && isEmbeddableUrl(text)) {
      event.preventDefault();
      const sceneX = (appState.scrollX ? -appState.scrollX : 0) + 200;
      const sceneY = (appState.scrollY ? -appState.scrollY : 0) + 200;
      insertEmbed(text, sceneX, sceneY);
      return;
    }
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          // B4: restore embedded Excalidraw scene metadata if present.
          if (blob.type === "image/png") {
            const restored = await tryRestoreSceneFromPng(blob);
            if (restored) return;
          }
          await insertImageFromBlob(blob);
          return;
        }
      }
    }
    // Not an image paste — let browser handle.
  };

  const onContainerDragOver = (event: DragEvent): void => {
    // Must preventDefault or the drop event won't fire.
    if (
      event.dataTransfer &&
      Array.from(event.dataTransfer.items).some((it) => it.kind === "file")
    ) {
      event.preventDefault();
    }
  };

  const onContainerDrop = async (event: DragEvent): Promise<void> => {
    if (!event.dataTransfer) return;
    const files = Array.from(event.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    const { x, y } = toSceneCoords(event.clientX, event.clientY);
    for (const file of files) {
      await insertImageFromBlob(file, x, y);
    }
  };

  const rehydrateImagesFromIdb = async (): Promise<void> => {
    const scene = getScene();
    if (!scene) return;
    const imageEls = scene
      .getNonDeletedElements()
      .filter((el: AnyEl) => el.type === "image" && el.fileId) as AnyEl[];
    if (imageEls.length === 0) return;
    for (const el of imageEls) {
      if (imageCacheMap.has(el.fileId)) continue;
      const record = await idbGet(el.fileId);
      if (!record?.dataURL) continue;
      try {
        const img = await loadImage(record.dataURL);
        imageCacheMap.set(el.fileId, { image: img, mimeType: record.mimeType });
        binaryFiles[el.fileId] = record;
      } catch {
        /* broken dataURL — skip */
      }
    }
    bumpSceneRepaint();
  };

  return {
    insertImageFromBlob,
    insertEmbed,
    createFrameAtCenter,
    tryRestoreSceneFromPng,
    onContainerPaste,
    onContainerDragOver,
    onContainerDrop,
    rehydrateImagesFromIdb,
  };
}
