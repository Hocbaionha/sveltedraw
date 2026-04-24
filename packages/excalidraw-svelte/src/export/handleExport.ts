// Phase 16 Feature 4 — multi-format export pipeline.
// Handles JSON / SVG / PNG / PDF with shared geometry/scale options.
//
// Test hook: when `window.__sveltedrawDownloadHook` is set, the helper hands
// the blob + filename to the hook instead of initiating a download. Lets
// puppeteer verify byte output without fighting headless Chrome's download
// handler.

// @ts-ignore — upstream, resolved via Vite alias
import { exportToBlob, exportToSvg } from "@excalidraw/utils/export";
import type { ExportOptions } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;
type SceneLike = { getNonDeletedElements: () => AnyEl[] };

const downloadFile = (blob: Blob, fileName: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hook = (window as any).__sveltedrawDownloadHook;
  if (typeof hook === "function") {
    try {
      hook(blob, fileName);
      return;
    } catch {
      /* fall through to native download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const handleExport = async (
  options: ExportOptions,
  ctx: {
    scene: SceneLike | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appState: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    binaryFiles: Record<string, AnyEl>;
    onComplete: () => void;
  },
): Promise<void> => {
  const { scene, appState, binaryFiles, onComplete } = ctx;
  if (!scene) return;

  const elements = scene.getNonDeletedElements();
  const padding = options.includeBorder ? options.borderWidth : 10;

  const buildAppState = () => ({
    ...appState,
    exportScale: options.scale,
    exportBackground: options.includeBackground,
  });

  try {
    switch (options.format) {
      case "json": {
        const json = JSON.stringify(
          {
            type: "excalidraw",
            version: 2,
            source: window.location.origin,
            elements,
            appState: { viewBackgroundColor: appState.viewBackgroundColor },
            files: binaryFiles,
          },
          null,
          2,
        );
        const blob = new Blob([json], { type: "application/json" });
        downloadFile(blob, options.fileName + ".json");
        break;
      }

      case "svg": {
        const svg = await exportToSvg({
          elements,
          appState: buildAppState(),
          files: binaryFiles,
          exportPadding: padding,
        });
        // Force target width/height attributes on the SVG root. The viewBox
        // (set by upstream from the content bbox) stays, so vectors scale.
        svg.setAttribute("width", String(options.width * options.scale));
        svg.setAttribute("height", String(options.height * options.scale));
        if (options.includeBorder) {
          const vb = (svg.getAttribute("viewBox") ?? "0 0 0 0")
            .split(/\s+/)
            .map(Number);
          if (vb.length === 4 && vb.every(Number.isFinite)) {
            const [vx, vy, vw, vh] = vb;
            const bw = options.borderWidth;
            const ns = "http://www.w3.org/2000/svg";
            const rect = document.createElementNS(ns, "rect");
            rect.setAttribute("x", String(vx + bw / 2));
            rect.setAttribute("y", String(vy + bw / 2));
            rect.setAttribute("width", String(Math.max(0, vw - bw)));
            rect.setAttribute("height", String(Math.max(0, vh - bw)));
            rect.setAttribute("fill", "none");
            rect.setAttribute("stroke", options.borderColor);
            rect.setAttribute("stroke-width", String(bw));
            svg.appendChild(rect);
          }
        }
        const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
        downloadFile(blob, options.fileName + ".svg");
        break;
      }

      case "png": {
        const targetW = Math.max(1, options.width);
        const targetH = Math.max(1, options.height);
        const densityScale = Math.max(0.01, options.scale);
        const blob = await exportToBlob({
          elements,
          appState: buildAppState(),
          files: binaryFiles,
          mimeType: "image/png",
          quality: options.quality,
          exportPadding: padding,
          // Fit natural bbox into target w×h with preserved aspect, then apply
          // densityScale as a pixel-density multiplier. Canvas ends up exactly
          // (targetW * scale) × (targetH * scale) pixels.
          getDimensions: (naturalW: number, naturalH: number) => {
            const fit = Math.min(targetW / naturalW, targetH / naturalH);
            return {
              width: Math.round(targetW * densityScale),
              height: Math.round(targetH * densityScale),
              scale: fit * densityScale,
            };
          },
        });
        downloadFile(blob, options.fileName + ".png");
        break;
      }

      case "pdf": {
        // A7: render scene to PNG via the PNG pipeline, then embed into a
        // single-page PDF. jspdf is lazy-loaded so its ~350KB only hits the
        // user's bundle when they actually ask for a PDF.
        const targetW = Math.max(1, options.width);
        const targetH = Math.max(1, options.height);
        const densityScale = Math.max(0.01, options.scale);
        const pngBlob = await exportToBlob({
          elements,
          appState: buildAppState(),
          files: binaryFiles,
          mimeType: "image/png",
          quality: options.quality,
          exportPadding: padding,
          getDimensions: (naturalW: number, naturalH: number) => {
            const fit = Math.min(targetW / naturalW, targetH / naturalH);
            return {
              width: Math.round(targetW * densityScale),
              height: Math.round(targetH * densityScale),
              scale: fit * densityScale,
            };
          },
        });
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(pngBlob);
        });
        const { jsPDF } = await import("jspdf");
        // Page size = target canvas size in px (we pass pixels as "pt" so the
        // page matches the drawing's pixel dimensions). Opens at 100% zoom in
        // all PDF viewers.
        const doc = new jsPDF({
          orientation: targetW >= targetH ? "landscape" : "portrait",
          unit: "pt",
          format: [targetW, targetH],
          compress: true,
        });
        doc.addImage(dataUrl, "PNG", 0, 0, targetW, targetH);
        const pdfBlob = doc.output("blob");
        downloadFile(pdfBlob as Blob, options.fileName + ".pdf");
        break;
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("sveltedraw: export failed", err);
    window.alert(`Export failed: ${(err as Error).message ?? err}`);
    return;
  }

  onComplete();
};
