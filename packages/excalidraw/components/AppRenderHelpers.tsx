// Phase 2h.10: JSX render helpers extracted from App.tsx.
// These were private class methods returning JSX. They now take `app: any`
// (the App instance) so the implementation is unchanged except `this` → `app`.
/* eslint-disable @typescript-eslint/no-explicit-any */

import clsx from "clsx";
import React from "react";

import {
  CLASSES,
  COLOR_PALETTE,
  CURSOR_TYPE,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  FRAME_STYLE,
  KEYS,
  POINTER_EVENTS,
  THEME,
  applyDarkModeFilter,
  sceneCoordsToViewportCoords,
  toValidURL,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  createSrcDoc,
  getContainingFrame,
  getCornerRadius,
  getEmbedLink,
  getFrameLikeTitle,
  getRenderOpacity,
  isElementCompletelyInViewport,
  isElementInViewport,
  isEmbeddableElement,
  isFrameLikeElement,
  isIframeElement,
} from "@excalidraw/element";

import type {
  ExcalidrawIframeLikeElement,
  IframeData,
  MagicGenerationData,
  NonDeleted,
  Ordered,
} from "@excalidraw/element/types";

import { t } from "../i18n";

type AppLike = any;

export function renderEmbeddables(app: AppLike) {
    const scale = app.state.zoom.value;
    const normalizedWidth = app.state.width;
    const normalizedHeight = app.state.height;

    const embeddableElements = app.scene
      .getNonDeletedElements()
      .filter(
        (el: any): el is Ordered<NonDeleted<ExcalidrawIframeLikeElement>> =>
          (isEmbeddableElement(el) &&
            app.embedsValidationStatus.get(el.id) === true) ||
          isIframeElement(el),
      );

    return (
      <>
        {embeddableElements.map((el: any) => {
          const { x, y } = sceneCoordsToViewportCoords(
            { sceneX: el.x, sceneY: el.y },
            app.state,
          );

          const isVisible = isElementInViewport(
            el,
            normalizedWidth,
            normalizedHeight,
            app.state,
            app.scene.getNonDeletedElementsMap(),
          );
          const hasBeenInitialized = app.initializedEmbeds.has(el.id);

          if (isVisible && !hasBeenInitialized) {
            app.initializedEmbeds.add(el.id);
          }
          const shouldRender = isVisible || hasBeenInitialized;

          if (!shouldRender) {
            return null;
          }

          let src: IframeData | null;

          if (isIframeElement(el)) {
            src = null;

            const data: MagicGenerationData = (el.customData?.generationData ??
              app.magicGenerations.get(el.id)) || {
              status: "error",
              message: "No generation data",
              code: "ERR_NO_GENERATION_DATA",
            };

            if (data.status === "done") {
              const html = data.html;
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return html;
                },
              } as const;
            } else if (data.status === "pending") {
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                      html, body {
                        width: 100%;
                        height: 100%;
                        color: ${
                          app.state.theme === THEME.DARK ? "white" : "black"
                        };
                      }
                      body {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-direction: column;
                        gap: 1rem;
                      }

                      .Spinner {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-left: auto;
                        margin-right: auto;
                      }

                      .Spinner svg {
                        animation: rotate 1.6s linear infinite;
                        transform-origin: center center;
                        width: 40px;
                        height: 40px;
                      }

                      .Spinner circle {
                        stroke: currentColor;
                        animation: dash 1.6s linear 0s infinite;
                        stroke-linecap: round;
                      }

                      @keyframes rotate {
                        100% {
                          transform: rotate(360deg);
                        }
                      }

                      @keyframes dash {
                        0% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: 0;
                        }
                        50% {
                          stroke-dasharray: 150, 300;
                          stroke-dashoffset: -200;
                        }
                        100% {
                          stroke-dasharray: 1, 300;
                          stroke-dashoffset: -280;
                        }
                      }
                    </style>
                    <div class="Spinner">
                      <svg
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="46"
                          stroke-width="8"
                          fill="none"
                          stroke-miter-limit="10"
                        />
                      </svg>
                    </div>
                    <div>Generating...</div>
                  `);
                },
              } as const;
            } else {
              let message: string;
              if (data.code === "ERR_GENERATION_INTERRUPTED") {
                message = "Generation was interrupted...";
              } else {
                message = data.message || "Generation failed";
              }
              src = {
                intrinsicSize: { w: el.width, h: el.height },
                type: "document",
                srcdoc: () => {
                  return createSrcDoc(`
                    <style>
                    html, body {
                      height: 100%;
                    }
                      body {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        color: ${COLOR_PALETTE.red[3]};
                      }
                      h1, h3 {
                        margin-top: 0;
                        margin-bottom: 0.5rem;
                      }
                    </style>
                    <h1>Error!</h1>
                    <h3>${message}</h3>
                  `);
                },
              } as const;
            }
          } else {
            src = getEmbedLink(toValidURL(el.link || ""));
          }

          const isActive =
            app.state.activeEmbeddable?.element === el &&
            app.state.activeEmbeddable?.state === "active";
          const isHovered =
            app.state.activeEmbeddable?.element === el &&
            app.state.activeEmbeddable?.state === "hover";

          return (
            <div
              key={el.id}
              className={clsx("excalidraw__embeddable-container", {
                "is-hovered": isHovered,
              })}
              style={{
                transform: isVisible
                  ? `translate(${x - app.state.offsetLeft}px, ${
                      y - app.state.offsetTop
                    }px) scale(${scale})`
                  : "none",
                display: isVisible ? "block" : "none",
                opacity: getRenderOpacity(
                  el,
                  getContainingFrame(el, app.scene.getNonDeletedElementsMap()),
                  app.elementsPendingErasure,
                  null,
                  app.state.openDialog?.name === "elementLinkSelector"
                    ? DEFAULT_REDUCED_GLOBAL_ALPHA
                    : 1,
                ),
                ["--embeddable-radius" as string]: `${getCornerRadius(
                  Math.min(el.width, el.height),
                  el,
                )}px`,
              }}
            >
              <div
                //this is a hack that addresses isse with embedded excalidraw.com embeddable
                //https://github.com/excalidraw/excalidraw/pull/6691#issuecomment-1607383938
                /*ref={(ref) => {
                  if (!app.excalidrawContainerRef.current) {
                    return;
                  }
                  const container = app.excalidrawContainerRef.current;
                  const sh = container.scrollHeight;
                  const ch = container.clientHeight;
                  if (sh !== ch) {
                    container.style.height = `${sh}px`;
                    setTimeout(() => {
                      container.style.height = `100%`;
                    });
                  }
                }}*/
                className="excalidraw__embeddable-container__inner"
                style={{
                  width: isVisible ? `${el.width}px` : 0,
                  height: isVisible ? `${el.height}px` : 0,
                  transform: isVisible ? `rotate(${el.angle}rad)` : "none",
                  pointerEvents: isActive
                    ? POINTER_EVENTS.enabled
                    : POINTER_EVENTS.disabled,
                }}
              >
                {isHovered && (
                  <div className="excalidraw__embeddable-hint">
                    {t("buttons.embeddableInteractionButton")}
                  </div>
                )}
                <div
                  className="excalidraw__embeddable__outer"
                  style={{
                    padding: `${el.strokeWidth}px`,
                  }}
                >
                  {(isEmbeddableElement(el)
                    ? app.props.renderEmbeddable?.(el, app.state)
                    : null) ?? (
                    <iframe
                      ref={(ref) => app.cacheEmbeddableRef(el, ref)}
                      className="excalidraw__embeddable"
                      srcDoc={
                        src?.type === "document"
                          ? src.srcdoc(app.state.theme)
                          : undefined
                      }
                      src={
                        src?.type !== "document" ? src?.link ?? "" : undefined
                      }
                      // https://stackoverflow.com/q/18470015
                      scrolling="no"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Excalidraw Embedded Content"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen={true}
                      sandbox={`${
                        src?.sandbox?.allowSameOrigin ? "allow-same-origin" : ""
                      } allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads`}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
}

export function renderFrameNames(app: AppLike) {
    if (!app.state.frameRendering.enabled || !app.state.frameRendering.name) {
      if (app.state.editingFrame) {
        app.resetEditingFrame(null);
      }
      return null;
    }

    const isDarkTheme = app.state.theme === THEME.DARK;
    const nonDeletedFramesLikes = app.scene.getNonDeletedFramesLikes();

    const focusedSearchMatch =
      nonDeletedFramesLikes.length > 0
        ? app.state.searchMatches?.focusedId &&
          isFrameLikeElement(
            app.scene.getElement(app.state.searchMatches.focusedId),
          )
          ? app.state.searchMatches.matches.find((sm: any) => sm.focus)
          : null
        : null;

    return nonDeletedFramesLikes.map((f: any) => {
      if (
        !isElementInViewport(
          f,
          app.canvas.width / window.devicePixelRatio,
          app.canvas.height / window.devicePixelRatio,
          {
            offsetLeft: app.state.offsetLeft,
            offsetTop: app.state.offsetTop,
            scrollX: app.state.scrollX,
            scrollY: app.state.scrollY,
            zoom: app.state.zoom,
          },
          app.scene.getNonDeletedElementsMap(),
        )
      ) {
        if (app.state.editingFrame === f.id) {
          app.resetEditingFrame(f);
        }
        // if frame not visible, don't render its name
        return null;
      }

      const { x: x1, y: y1 } = sceneCoordsToViewportCoords(
        { sceneX: f.x, sceneY: f.y },
        app.state,
      );

      const FRAME_NAME_EDIT_PADDING = 6;

      let frameNameJSX;

      const frameName = getFrameLikeTitle(f);

      if (f.id === app.state.editingFrame) {
        const frameNameInEdit = frameName;

        frameNameJSX = (
          <input
            autoFocus
            value={frameNameInEdit}
            onChange={(e) => {
              app.scene.mutateElement(f, {
                name: e.target.value,
              });
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => app.resetEditingFrame(f)}
            onKeyDown={(event) => {
              // for some inexplicable reason, `onBlur` triggered on ESC
              // does not reset `state.editingFrame` despite being called,
              // and we need to reset it here as well
              if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
                app.resetEditingFrame(f);
              }
            }}
            style={{
              background: isDarkTheme
                ? applyDarkModeFilter(app.state.viewBackgroundColor)
                : app.state.viewBackgroundColor,
              zIndex: 2,
              border: "none",
              display: "block",
              padding: `${FRAME_NAME_EDIT_PADDING}px`,
              borderRadius: 4,
              boxShadow: "inset 0 0 0 1px var(--color-primary)",
              fontFamily: "Assistant",
              fontSize: `${FRAME_STYLE.nameFontSize}px`,
              transform: `translate(-${FRAME_NAME_EDIT_PADDING}px, ${FRAME_NAME_EDIT_PADDING}px)`,
              color: isDarkTheme
                ? FRAME_STYLE.nameColorDarkTheme
                : FRAME_STYLE.nameColorLightTheme,
              overflow: "hidden",
              maxWidth: `${
                document.body.clientWidth - x1 - FRAME_NAME_EDIT_PADDING
              }px`,
            }}
            size={frameNameInEdit.length + 1 || 1}
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
          />
        );
      } else {
        frameNameJSX = frameName;
      }

      return (
        <div
          id={app.getFrameNameDOMId(f)}
          className={CLASSES.FRAME_NAME}
          key={f.id}
          style={{
            position: "absolute",
            // Positioning from bottom so that we don't to either
            // calculate text height or adjust using transform (which)
            // messes up input position when editing the frame name.
            // This makes the positioning deterministic and we can calculate
            // the same position when rendering to canvas / svg.
            bottom: `${
              app.state.height +
              FRAME_STYLE.nameOffsetY -
              y1 +
              app.state.offsetTop
            }px`,
            left: `${x1 - app.state.offsetLeft}px`,
            zIndex: 2,
            fontSize: FRAME_STYLE.nameFontSize,
            color: isDarkTheme
              ? FRAME_STYLE.nameColorDarkTheme
              : FRAME_STYLE.nameColorLightTheme,
            lineHeight: FRAME_STYLE.nameLineHeight,
            width: "max-content",
            maxWidth:
              focusedSearchMatch?.id === f.id && focusedSearchMatch?.focus
                ? "none"
                : `${f.width * app.state.zoom.value}px`,
            overflow: f.id === app.state.editingFrame ? "visible" : "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            cursor: CURSOR_TYPE.MOVE,
            pointerEvents: app.state.viewModeEnabled
              ? POINTER_EVENTS.disabled
              : POINTER_EVENTS.enabled,
          }}
          onPointerDown={(event) => app.handleCanvasPointerDown(event)}
          onWheel={(event) => app.handleWheel(event)}
          onContextMenu={app.handleCanvasContextMenu}
          onDoubleClick={() => {
            app.setState({
              editingFrame: f.id,
            });
          }}
        >
          {frameNameJSX}
        </div>
      );
    });
}
