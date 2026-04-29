import type { SveltedrawTextContainer } from "./types";

export const originalContainerCache: {
  [id: SveltedrawTextContainer["id"]]:
    | {
        height: SveltedrawTextContainer["height"];
      }
    | undefined;
} = {};

export const updateOriginalContainerCache = (
  id: SveltedrawTextContainer["id"],
  height: SveltedrawTextContainer["height"],
) => {
  const data =
    originalContainerCache[id] || (originalContainerCache[id] = { height });
  data.height = height;
  return data;
};

export const resetOriginalContainerCache = (
  id: SveltedrawTextContainer["id"],
) => {
  if (originalContainerCache[id]) {
    delete originalContainerCache[id];
  }
};

export const getOriginalContainerHeightFromCache = (
  id: SveltedrawTextContainer["id"],
) => {
  return originalContainerCache[id]?.height ?? null;
};
