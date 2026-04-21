// Phase 2h.11: lifecycle-adjacent methods extracted from App.tsx.
// Uses ctx.getApp() with `any` cast because these touch App-class internals.
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  EVENT,
  THEME,
  addEventListener,
  getNearestScrollableContainer,
  updateActiveTool,
} from "@excalidraw/common";

import { CaptureUpdateAction, isElementLink } from "@excalidraw/element";

import {
  ShapeCache,
  isSomeElementSelected,
  selectGroupsForSelectedElements,
} from "@excalidraw/element";

import { isEraserActive } from "../appState";
import { setEraserCursor } from "../cursor";
import { actionFinalize } from "../actions";
import { Fonts } from "../fonts";
import { Renderer } from "../scene/Renderer";
import { Scene } from "@excalidraw/element";
import { SnapCache } from "../snapping";

import { appGlobals } from "./appGlobals";

import type { AppState, AppProps } from "../types";

import { restoreAppState, restoreElements } from "../data/restore";
import { calculateScrollCenter } from "../scene";

import type { AppEngineContext } from "./AppEngineContext";

export async function initializeScene(ctx: AppEngineContext): Promise<void> {
  const app = ctx.getApp() as any;

  if ("launchQueue" in window && "LaunchParams" in window) {
    (window as any).launchQueue.setConsumer(
      async (launchParams: { files: any[] }) => {
        if (!launchParams.files.length) {
          return;
        }
        const fileHandle = launchParams.files[0];
        const blob: Blob = await fileHandle.getFile();
        app.loadFileToCanvas(
          new File([blob], blob.name || "", { type: blob.type }),
          fileHandle,
        );
      },
    );
  }

  if (app.props.theme) {
    app.setState({ theme: app.props.theme });
  }
  if (!app.state.isLoading) {
    app.setState({ isLoading: true });
  }
  let initialData = null;
  try {
    if (typeof app.props.initialData === "function") {
      initialData = (await app.props.initialData()) || null;
    } else {
      initialData = (await app.props.initialData) || null;
    }
    if (initialData?.libraryItems) {
      app.library
        .updateLibrary({
          libraryItems: initialData.libraryItems,
          merge: true,
        })
        .catch((error: any) => {
          console.error(error);
        });
    }
  } catch (error: any) {
    console.error(error);
    initialData = {
      appState: {
        errorMessage:
          error.message ||
          "Encountered an error during importing or restoring scene data",
      },
    };
  }
  const restoredElements = restoreElements(initialData?.elements, null, {
    repairBindings: true,
    deleteInvisibleElements: true,
  });
  let restoredAppState = restoreAppState(initialData?.appState, null);
  const activeTool = restoredAppState.activeTool;

  if (!restoredAppState.preferredSelectionTool.initialized) {
    restoredAppState.preferredSelectionTool = {
      type:
        app.editorInterface.formFactor === "phone" ? "lasso" : "selection",
      initialized: true,
    };
  }

  restoredAppState = {
    ...restoredAppState,
    theme: app.props.theme || restoredAppState.theme,
    openSidebar: restoredAppState?.openSidebar || app.state.openSidebar,
    activeTool:
      activeTool.type === "image" ||
      activeTool.type === "lasso" ||
      activeTool.type === "selection"
        ? {
            ...activeTool,
            type: restoredAppState.preferredSelectionTool.type,
          }
        : restoredAppState.activeTool,
    isLoading: false,
    toast: app.state.toast,
  };

  if (initialData?.scrollToContent) {
    restoredAppState = {
      ...restoredAppState,
      ...calculateScrollCenter(restoredElements, {
        ...restoredAppState,
        width: app.state.width,
        height: app.state.height,
        offsetTop: app.state.offsetTop,
        offsetLeft: app.state.offsetLeft,
      }),
    };
  }

  app.resetStore();
  app.resetHistory();
  app.syncActionResult({
    elements: restoredElements,
    appState: restoredAppState,
    files: initialData?.files,
    captureUpdate: CaptureUpdateAction.NEVER,
  });

  app.clearImageShapeCache();

  app.fonts.loadSceneFonts().then((fontFaces: any) => {
    app.fonts.onLoaded(fontFaces);
  });

  if (isElementLink(window.location.href)) {
    app.scrollToContent(window.location.href, { animate: false });
  }
}

export function removeEventListeners(ctx: AppEngineContext): void {
  const app = ctx.getApp() as any;
  app.onRemoveEventListenersEmitter.trigger();
}

export function addEventListeners(ctx: AppEngineContext): void {
  const app = ctx.getApp() as any;
  removeEventListeners(ctx);

  if (app.props.handleKeyboardGlobally) {
    app.onRemoveEventListenersEmitter.once(
      addEventListener(document, EVENT.KEYDOWN, app.onKeyDown, false),
    );
  }

  app.onRemoveEventListenersEmitter.once(
    addEventListener(
      app.excalidrawContainerRef.current,
      EVENT.WHEEL,
      app.handleWheel,
      { passive: false },
    ),
    addEventListener(window, EVENT.MESSAGE, app.onWindowMessage, false),
    addEventListener(document, EVENT.POINTER_UP, app.removePointer, {
      passive: false,
    }),
    addEventListener(document, EVENT.COPY, app.onCopy, { passive: false }),
    addEventListener(document, EVENT.KEYUP, app.onKeyUp, { passive: true }),
    addEventListener(
      document,
      EVENT.POINTER_MOVE,
      app.updateCurrentCursorPosition,
      { passive: false },
    ),
    addEventListener(
      document.fonts,
      "loadingdone",
      (event: any) => {
        const fontFaces = (event as FontFaceSetLoadEvent).fontfaces;
        app.fonts.onLoaded(fontFaces);
      },
      { passive: false },
    ),
    addEventListener(
      document,
      EVENT.GESTURE_START,
      app.onGestureStart as any,
      false,
    ),
    addEventListener(
      document,
      EVENT.GESTURE_CHANGE,
      app.onGestureChange as any,
      false,
    ),
    addEventListener(
      document,
      EVENT.GESTURE_END,
      app.onGestureEnd as any,
      false,
    ),
    addEventListener(
      window,
      EVENT.FOCUS,
      () => {
        app.maybeCleanupAfterMissingPointerUp(null);
        app.triggerRender(true);
      },
      { passive: false },
    ),
  );

  if (app.state.viewModeEnabled) {
    return;
  }

  app.onRemoveEventListenersEmitter.once(
    addEventListener(
      document,
      EVENT.FULLSCREENCHANGE,
      app.onFullscreenChange,
      { passive: false },
    ),
    addEventListener(document, EVENT.PASTE, app.pasteFromClipboard, {
      passive: false,
    }),
    addEventListener(document, EVENT.CUT, app.onCut, { passive: false }),
    addEventListener(window, EVENT.RESIZE, app.onResize, false),
    addEventListener(window, EVENT.UNLOAD, app.onUnload, false),
    addEventListener(window, EVENT.BLUR, app.onBlur, false),
    addEventListener(
      app.excalidrawContainerRef.current,
      EVENT.WHEEL,
      app.handleWheel,
      { passive: false },
    ),
    addEventListener(
      app.excalidrawContainerRef.current,
      EVENT.DRAG_OVER,
      app.disableEvent,
      false,
    ),
    addEventListener(
      app.excalidrawContainerRef.current,
      EVENT.DROP,
      app.disableEvent,
      false,
    ),
  );

  if (app.props.detectScroll) {
    app.onRemoveEventListenersEmitter.once(
      addEventListener(
        getNearestScrollableContainer(app.excalidrawContainerRef.current!),
        EVENT.SCROLL,
        app.onScroll,
        { passive: false },
      ),
    );
  }
}

export function componentDidUpdate(
  ctx: AppEngineContext,
  prevProps: AppProps,
  prevState: AppState,
): void {
  const app = ctx.getApp() as any;

  if (!app._initialized && !app.state.isLoading) {
    app._initialized = true;
    app.editorLifecycleEvents.emit("editor:initialize", app.api);
    app.props.onInitialize?.(app.api);
  }

  app.appStateObserver.flush(prevState);

  app.updateEmbeddables();
  const elements = app.scene.getElementsIncludingDeleted();
  const elementsMap = app.scene.getElementsMapIncludingDeleted();

  const shouldExportWithDarkMode =
    (app.sessionExportThemeOverride ?? app.state.theme) === THEME.DARK;

  if (app.state.exportWithDarkMode !== shouldExportWithDarkMode) {
    app.setState({ exportWithDarkMode: shouldExportWithDarkMode });
  }

  if (!app.state.showWelcomeScreen && !elements.length) {
    app.setState({ showWelcomeScreen: true });
  }

  const hasFollowedPersonLeft =
    prevState.userToFollow &&
    !app.state.collaborators.has(prevState.userToFollow.socketId);

  if (hasFollowedPersonLeft) {
    app.maybeUnfollowRemoteUser();
  }

  if (
    prevState.zoom.value !== app.state.zoom.value ||
    prevState.scrollX !== app.state.scrollX ||
    prevState.scrollY !== app.state.scrollY
  ) {
    app.props?.onScrollChange?.(
      app.state.scrollX,
      app.state.scrollY,
      app.state.zoom,
    );
    app.onScrollChangeEmitter.trigger(
      app.state.scrollX,
      app.state.scrollY,
      app.state.zoom,
    );
  }

  if (prevState.userToFollow !== app.state.userToFollow) {
    if (prevState.userToFollow) {
      app.onUserFollowEmitter.trigger({
        userToFollow: prevState.userToFollow,
        action: "UNFOLLOW",
      });
    }

    if (app.state.userToFollow) {
      app.onUserFollowEmitter.trigger({
        userToFollow: app.state.userToFollow,
        action: "FOLLOW",
      });
    }
  }

  if (
    Object.keys(app.state.selectedElementIds).length &&
    isEraserActive(app.state)
  ) {
    app.setState({
      activeTool: updateActiveTool(app.state, { type: "selection" }),
    });
  }
  if (
    app.state.activeTool.type === "eraser" &&
    prevState.theme !== app.state.theme
  ) {
    setEraserCursor(app.interactiveCanvas, app.state.theme);
  }

  if (
    prevState.activeTool.type === "selection" &&
    app.state.activeTool.type !== "selection" &&
    app.state.showHyperlinkPopup
  ) {
    app.setState({ showHyperlinkPopup: false });
  }
  if (prevProps.langCode !== app.props.langCode) {
    app.updateLanguage();
  }

  if (isEraserActive(prevState) && !isEraserActive(app.state)) {
    app.eraserTrail.endPath();
  }

  if (prevProps.viewModeEnabled !== app.props.viewModeEnabled) {
    app.setState({ viewModeEnabled: !!app.props.viewModeEnabled });
  }

  if (prevState.viewModeEnabled !== app.state.viewModeEnabled) {
    app.addEventListeners();
    app.deselectElements();
  }

  if (
    (prevState.openDialog?.name === "elementLinkSelector" ||
      app.state.openDialog?.name === "elementLinkSelector") &&
    prevState.openDialog?.name !== app.state.openDialog?.name
  ) {
    app.deselectElements();
    app.setState({
      hoveredElementIds: {},
    });
  }

  if (prevProps.zenModeEnabled !== app.props.zenModeEnabled) {
    app.setState({ zenModeEnabled: !!app.props.zenModeEnabled });
  }

  if (prevProps.theme !== app.props.theme && app.props.theme) {
    app.setState({ theme: app.props.theme });
  }

  app.excalidrawContainerRef.current?.classList.toggle(
    "theme--dark",
    app.state.theme === THEME.DARK,
  );

  if (
    app.state.selectedLinearElement?.isEditing &&
    !app.state.selectedElementIds[app.state.selectedLinearElement.elementId]
  ) {
    setTimeout(() => {
      app.state.selectedLinearElement?.isEditing &&
        app.actionManager.executeAction(actionFinalize);
    });
  }

  if (app.state.editingTextElement?.isDeleted) {
    app.setState({ editingTextElement: null });
  }

  app.store.commit(elementsMap, app.state);

  if (!app.state.isLoading) {
    app.props.onChange?.(elements, app.state, app.files);
    app.onChangeEmitter.trigger(elements, app.state, app.files);
  }
}

export function componentWillUnmount(ctx: AppEngineContext): void {
  const app = ctx.getApp() as any;

  app.api = { ...app.api, isDestroyed: true };

  for (const key of Object.keys(app.api)) {
    if (
      (key.startsWith("get") ||
        key === "onStateChange" ||
        key === "onEvent") &&
      typeof app.api[key] === "function"
    ) {
      app.api[key] = () => {
        throw new Error(
          "ExcalidrawAPI is no longer usable after the editor has been unmounted and will return invalid/empty data. You should check for `ExcalidrawAPI.isDestroyed` before calling get* methods on subscribing to state/event changes.",
        );
      };
    }
  }

  app.editorLifecycleEvents.emit("editor:unmount");
  app.props.onUnmount?.();
  app.props.onExcalidrawAPI?.(null);

  (window as any).launchQueue?.setConsumer(() => {});

  app.renderer.destroy();
  app.scene.destroy();
  app.scene = new Scene();
  app.fonts = new Fonts(app.scene);
  app.renderer = new Renderer(app.scene);
  app.files = {};
  app.imageCache.clear();
  app.resizeObserver?.disconnect();
  app.unmounted = true;
  app.removeEventListeners();
  app.library.destroy();
  app.laserTrails.stop();
  app.eraserTrail.stop();
  app.onChangeEmitter.clear();
  app.store.onStoreIncrementEmitter.clear();
  app.store.onDurableIncrementEmitter.clear();
  app.appStateObserver.clear();
  app.editorLifecycleEvents.clear();
  ShapeCache.destroy();
  SnapCache.destroy();
  clearTimeout(appGlobals.touchTimeout);
  isSomeElementSelected.clearCache();
  selectGroupsForSelectedElements.clearCache();
  appGlobals.touchTimeout = 0;
  document.documentElement.style.overscrollBehaviorX = "";
}
