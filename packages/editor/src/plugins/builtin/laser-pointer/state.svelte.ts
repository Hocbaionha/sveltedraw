// Laser pointer state. Active flag + trail samples + a frame counter
// the overlay uses to re-evaluate opacity even when the user's pointer
// is stationary (otherwise stale opacity persists between samples).

export type LaserPoint = { x: number; y: number; t: number };

export type LaserState = {
  active: boolean;
  trail: LaserPoint[];
  frame: number;
};

export function createState(): LaserState {
  const s: LaserState = $state({ active: false, trail: [], frame: 0 });
  return s;
}
