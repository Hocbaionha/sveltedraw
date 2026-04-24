// Phase 16 Feature 3 — presentation mode handlers (start/exit + nav).
// Pre-renders each slide to an SVG string so PresentationMode displays the
// drawing content, not just a title card.

// @ts-ignore — upstream
import { exportToSvg } from "@excalidraw/utils/export";
import {
  createPresentationSlide,
  type PresentationConfig,
  type PresentationSlide,
} from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;
type SceneLike = { getNonDeletedElements: () => AnyEl[] };

type FrameLike = {
  name: string;
  elementIds: Set<string>;
};

export type PresentationDeps = {
  getScene: () => SceneLike | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: any;
  /** binaryFiles is declared later in the host script; pass a getter so the
   *  factory can be created at top level without hitting a TDZ. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getBinaryFiles: () => Record<string, AnyEl>;
  /** Phase-11 frames Map; iterated to slice scene into per-frame slides. */
  getFrames: () => Map<string, FrameLike>;
  presentationConfig: PresentationConfig;
  // Reactive state mutators (App owns the $state vars for panel binding).
  setSlides: (slides: PresentationSlide[]) => void;
  setSlideSvgs: (svgs: string[]) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setActive: (active: boolean) => void;
  getSlides: () => PresentationSlide[];
  getCurrentIndex: () => number;
  getIsPlaying: () => boolean;
};

export type PresentationHandlers = {
  start: () => Promise<void>;
  next: () => void;
  prev: () => void;
  togglePlayPause: () => void;
  exit: () => void;
  jumpToSlide: (index: number) => void;
};

export function createPresentationHandlers(
  deps: PresentationDeps,
): PresentationHandlers {
  const start = async () => {
    const scene = deps.getScene();
    if (!scene) return;
    const allElements = scene.getNonDeletedElements();
    if (allElements.length === 0) {
      window.alert("Draw something first, then start the presentation.");
      return;
    }

    const frameList = Array.from(deps.getFrames().values());
    let slides: PresentationSlide[];
    if (frameList.length > 0) {
      slides = frameList.map((frame, i) => {
        const frameElements = allElements.filter((el: AnyEl) =>
          frame.elementIds.has(el.id),
        );
        return createPresentationSlide(
          frame.name,
          frameElements,
          i,
          `${frameElements.length} element${frameElements.length === 1 ? "" : "s"}`,
        );
      });
    } else {
      slides = [
        createPresentationSlide(
          "Drawing",
          allElements,
          0,
          `${allElements.length} element${allElements.length === 1 ? "" : "s"}`,
        ),
      ];
    }

    // Pre-render each slide to an SVG string. Strip width/height so the SVG
    // scales to fit the presentation container.
    const svgs = await Promise.all(
      slides.map(async (slide) => {
        if (slide.elements.length === 0) return "";
        try {
          const svg = await exportToSvg({
            elements: slide.elements,
            appState: deps.appState,
            files: deps.getBinaryFiles(),
            exportPadding: 40,
          });
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          svg.setAttribute(
            "style",
            "max-width: 100%; max-height: 100%; width: auto; height: auto; display: block; margin: 0 auto;",
          );
          return svg.outerHTML;
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("sveltedraw: slide svg failed", err);
          return "";
        }
      }),
    );

    deps.setSlides(slides);
    deps.setSlideSvgs(svgs);
    deps.setCurrentIndex(0);
    deps.setIsPlaying(false);
    deps.setActive(true);
  };

  const next = () => {
    const idx = deps.getCurrentIndex();
    const slides = deps.getSlides();
    if (idx < slides.length - 1) {
      deps.setCurrentIndex(idx + 1);
    } else if (deps.presentationConfig.loopOnEnd) {
      deps.setCurrentIndex(0);
    }
  };

  const prev = () => {
    const idx = deps.getCurrentIndex();
    if (idx > 0) deps.setCurrentIndex(idx - 1);
  };

  const togglePlayPause = () => {
    deps.setIsPlaying(!deps.getIsPlaying());
  };

  const exit = () => {
    deps.setActive(false);
    deps.setIsPlaying(false);
    deps.setCurrentIndex(0);
  };

  const jumpToSlide = (index: number) => {
    const slides = deps.getSlides();
    if (index >= 0 && index < slides.length) {
      deps.setCurrentIndex(index);
    }
  };

  return { start, next, prev, togglePlayPause, exit, jumpToSlide };
}
