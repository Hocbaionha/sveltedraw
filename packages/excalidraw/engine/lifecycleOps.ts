// Phase 2h.11: lifecycle-adjacent methods extracted from App.tsx.
// Uses ctx.getApp() with `any` cast because these touch App-class internals.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CaptureUpdateAction, isElementLink } from "@excalidraw/element";

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
