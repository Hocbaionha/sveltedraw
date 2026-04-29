// Connector system for Phase 13 — Advanced Drawing Tools

export type RoutingStyle = "straight" | "orthogonal" | "curved" | "bezier";

export interface ConnectionPoint {
  elementId: string;
  pointType: "top" | "bottom" | "left" | "right" | "center";
  x: number;
  y: number;
}

export interface Connector {
  id: string;
  type: "connector";
  fromPoint: ConnectionPoint;
  toPoint: ConnectionPoint;
  routingStyle: RoutingStyle;
  label?: string;
  strokeColor: string;
  strokeWidth: number;
  arrowStart?: "none" | "arrow" | "triangle" | "circle";
  arrowEnd?: "none" | "arrow" | "triangle" | "circle";
  // Cached paths for rendering
  path?: string;
}

export interface Element {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  [key: string]: unknown;
}

/**
 * Calculate connection point on an element
 * Returns x, y coordinates where a connector should attach
 */
export function getConnectionPoint(
  element: Element,
  pointType: "top" | "bottom" | "left" | "right" | "center",
): [number, number] {
  const { x, y, width, height } = element;
  const cx = x + width / 2;
  const cy = y + height / 2;

  switch (pointType) {
    case "top":
      return [cx, y];
    case "bottom":
      return [cx, y + height];
    case "left":
      return [x, cy];
    case "right":
      return [x + width, cy];
    case "center":
      return [cx, cy];
  }
}

/**
 * Generate SVG path for connector based on routing style
 */
export function generateConnectorPath(
  connector: Connector,
  elements: Map<string, Element>,
): string {
  const fromEl = elements.get(connector.fromPoint.elementId);
  const toEl = elements.get(connector.toPoint.elementId);

  if (!fromEl || !toEl) return "";

  const [fromX, fromY] = getConnectionPoint(fromEl, connector.fromPoint.pointType);
  const [toX, toY] = getConnectionPoint(toEl, connector.toPoint.pointType);

  switch (connector.routingStyle) {
    case "straight":
      return generateStraightPath(fromX, fromY, toX, toY);
    case "orthogonal":
      return generateOrthogonalPath(fromX, fromY, toX, toY);
    case "curved":
      return generateCurvedPath(fromX, fromY, toX, toY);
    case "bezier":
      return generateBezierPath(fromX, fromY, toX, toY);
  }
}

function generateStraightPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function generateOrthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

function generateCurvedPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const controlX = x1 + dx * 0.5;
  const controlY = y1;
  return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
}

function generateBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const control1X = x1 + dx * 0.3;
  const control1Y = y1 + dy * 0.1;
  const control2X = x1 + dx * 0.7;
  const control2Y = y1 + dy * 0.9;
  return `M ${x1} ${y1} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${x2} ${y2}`;
}
