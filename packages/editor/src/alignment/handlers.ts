// Smart alignment / distribution / autolayout / guide handlers.
// Each handler shares the same pattern: extract a {id, x, y, w, h, angle}
// snapshot of the selection, run the geometry function, write the new x/y
// back into the live scene elements, then pushHistory + bumpSceneRepaint.

import {
  alignElements,
  distributeElements,
  calculateAlignmentGuides,
  type AlignmentType,
  type AlignmentGuide,
  type DistributionType,
} from "./types.js";
import {
  calculateLayout,
  applyLayout,
  type LayoutConfig,
} from "../autolayout/types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEl = any;

export type AlignmentDeps = {
  getScene: () => unknown | null;
  getSelectedElements: () => AnyEl[];
  pushHistory: () => void;
  bumpSceneRepaint: () => void;
  setAlignmentGuides: (guides: AlignmentGuide[]) => void;
};

export type AlignmentHandlers = {
  handleAlign: (type: AlignmentType) => void;
  handleDistribute: (type: DistributionType) => void;
  updateAlignmentGuides: () => void;
  handleAutoLayout: (config: LayoutConfig) => void;
};

const snapshot = (els: AnyEl[]) =>
  els.map((el) => ({
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    angle: el.angle,
  }));

export function createAlignmentHandlers(deps: AlignmentDeps): AlignmentHandlers {
  const {
    getScene,
    getSelectedElements,
    pushHistory,
    bumpSceneRepaint,
    setAlignmentGuides,
  } = deps;

  const writeBack = (selected: AnyEl[], updated: { id: string; x: number; y: number }[]) => {
    for (const el of selected) {
      const u = updated.find((a) => a.id === el.id);
      if (u) {
        el.x = u.x;
        el.y = u.y;
      }
    }
  };

  const handleAlign = (type: AlignmentType) => {
    if (!getScene()) return;
    const selected = getSelectedElements();
    if (selected.length < 2) return;
    const aligned = alignElements(snapshot(selected), type);
    writeBack(selected, aligned);
    pushHistory();
    bumpSceneRepaint();
  };

  const handleDistribute = (type: DistributionType) => {
    if (!getScene()) return;
    const selected = getSelectedElements();
    if (selected.length < 3) return;
    const distributed = distributeElements(snapshot(selected), type);
    writeBack(selected, distributed);
    pushHistory();
    bumpSceneRepaint();
  };

  const updateAlignmentGuides = () => {
    const selected = getSelectedElements();
    if (selected.length < 2) {
      setAlignmentGuides([]);
      return;
    }
    setAlignmentGuides(calculateAlignmentGuides(snapshot(selected)));
  };

  const handleAutoLayout = (config: LayoutConfig) => {
    if (!getScene()) return;
    const selected = getSelectedElements();
    if (selected.length < 2) return;
    const els = snapshot(selected);
    const layoutResults = calculateLayout(els, config);
    const newElements = applyLayout(els, layoutResults);
    writeBack(selected, newElements);
    pushHistory();
    bumpSceneRepaint();
  };

  return { handleAlign, handleDistribute, updateAlignmentGuides, handleAutoLayout };
}
