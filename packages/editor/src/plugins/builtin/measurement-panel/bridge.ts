import type { MeasurementConfig } from "../../../measurements/types.js";

export const MEASUREMENT_BRIDGE_KEY: unique symbol =
  Symbol("measurementPanelBridge");

export type MeasurementSelectedElement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MeasurementBridge = {
  /** Reactive: current selection projected to dim summary. */
  readonly selectedElements: readonly MeasurementSelectedElement[];
  /** Reactive: measurement config snapshot. */
  readonly config: MeasurementConfig;
  setConfig(next: MeasurementConfig): void;
};
