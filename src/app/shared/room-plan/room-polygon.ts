export interface RoomRect {
  lengthX: number;
  widthY: number;
  width1: number;
  length1: number;
  width2: number;
  length2: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Engine bounding rectangle from the four form sides.
 * sides = [width1, length1, width2, length2]
 * X = max(width1, width2), Y = max(length1, length2)
 */
export function roomRectFromSides(
  width1: number,
  length1: number,
  width2: number,
  length2: number,
): RoomRect {
  return {
    lengthX: Math.max(width1, width2),
    widthY: Math.max(length1, length2),
    width1,
    length1,
    width2,
    length2,
  };
}

/** Calculate response: length is X, width is Y. */
export function roomRectFromEngine(length: number, width: number): RoomRect {
  return {
    lengthX: length,
    widthY: width,
    width1: length,
    length1: width,
    width2: length,
    length2: width,
  };
}

export function roomRectFromPayloadSides(sides: number[] | null | undefined): RoomRect | null {
  if (!sides || sides.length < 4) return null;
  const [width1, length1, width2, length2] = sides;
  if ([width1, length1, width2, length2].some((v) => v == null || v <= 0)) {
    return null;
  }
  return roomRectFromSides(width1, length1, width2, length2);
}

export function formatMeters(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

const RING_EPS = 1e-9;
/** ponytail: 5cm hides CAD wall tessellation; drop if a real jog under 5cm must stay. */
const COLLINEAR_M = 0.05;

export interface EdgeLengthLabel {
  x: number;
  y: number;
  text: string;
}

/** Drop a closing vertex that repeats the first so a ring is open. */
export function dropClosedDuplicate(vertices: readonly Point[], epsilon = RING_EPS): Point[] {
  if (vertices.length < 2) {
    return vertices.map((point) => ({ x: point.x, y: point.y }));
  }
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const closed =
    Math.abs(first.x - last.x) < epsilon && Math.abs(first.y - last.y) < epsilon;
  const ring = closed ? vertices.slice(0, -1) : vertices;
  return ring.map((point) => ({ x: point.x, y: point.y }));
}

function bboxBottomLeft(vertices: readonly Point[]): Point | null {
  if (vertices.length === 0) {
    return null;
  }
  let minX = vertices[0].x;
  let minY = vertices[0].y;
  for (const point of vertices) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
  }
  return { x: minX, y: minY };
}

/**
 * Translate a ring (and holes) so the axis-aligned bottom-left corner is (0, 0).
 * Y-up meters; every vertex then has x >= 0 and y >= 0.
 */
export function localMeterPolygon(
  vertices: readonly Point[],
  holes: readonly Point[][] = [],
): { vertices: Point[]; holes: Point[][] } {
  const ring = dropClosedDuplicate(vertices);
  const origin = bboxBottomLeft(ring);
  if (!origin) {
    return { vertices: [], holes: [] };
  }
  const shift = (point: Point): Point => ({ x: point.x - origin.x, y: point.y - origin.y });
  return {
    vertices: ring.map(shift),
    holes: holes.map((hole) => dropClosedDuplicate(hole).map(shift)),
  };
}

function pointLineDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < RING_EPS) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  return Math.abs((point.x - a.x) * dy - (point.y - a.y) * dx) / length;
}

/** Drop vertices that lie on a neighbor chord so one CAD wall is one side. */
export function collapseColinearRing(
  vertices: readonly Point[],
  epsilon = COLLINEAR_M,
): Point[] {
  let ring = dropClosedDuplicate(vertices);
  let changed = true;
  while (changed && ring.length > 3) {
    changed = false;
    const next: Point[] = [];
    for (let i = 0; i < ring.length; i++) {
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const point = ring[i];
      const following = ring[(i + 1) % ring.length];
      if (pointLineDistance(point, prev, following) < epsilon) {
        changed = true;
        continue;
      }
      next.push(point);
    }
    if (next.length < 3) {
      break;
    }
    ring = next;
  }
  return ring;
}

function signedArea(vertices: readonly Point[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** Mid-edge length labels in Y-up space, offset outward by `margin`. */
export function outwardEdgeLabels(vertices: readonly Point[], margin: number): EdgeLengthLabel[] {
  if (vertices.length < 2 || margin < 0) {
    return [];
  }
  const outwardSign = signedArea(vertices) >= 0 ? 1 : -1;
  const labels: EdgeLengthLabel[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < RING_EPS) {
      continue;
    }
    const nx = (outwardSign * dy) / length;
    const ny = (outwardSign * -dx) / length;
    labels.push({
      x: (a.x + b.x) / 2 + nx * margin,
      y: (a.y + b.y) / 2 + ny * margin,
      text: `${formatMeters(length)} m`,
    });
  }
  return labels;
}

/** Vertex coordinates, offset toward the ring centroid so they sit inside the room. */
export function vertexCoordinateLabels(vertices: readonly Point[], margin: number): EdgeLengthLabel[] {
  if (vertices.length === 0) {
    return [];
  }
  let cx = 0;
  let cy = 0;
  for (const point of vertices) {
    cx += point.x;
    cy += point.y;
  }
  cx /= vertices.length;
  cy /= vertices.length;
  return vertices
    .filter((point) => Math.hypot(point.x, point.y) >= RING_EPS)
    .map((point) => {
      const vx = cx - point.x;
      const vy = cy - point.y;
      const length = Math.hypot(vx, vy);
      const ux = length < RING_EPS ? 0 : vx / length;
      const uy = length < RING_EPS ? 0 : vy / length;
      return {
        x: point.x + ux * margin,
        y: point.y + uy * margin,
        text: `(${formatMeters(point.x)}, ${formatMeters(point.y)})`,
      };
    });
}

export function svgPathFromRings(
  vertices: readonly Point[],
  holes: readonly Point[][],
  flipY: (y: number) => number,
): string {
  const ringPath = (ring: readonly Point[]): string => {
    if (ring.length < 2) {
      return '';
    }
    const commands = ring.map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command}${point.x} ${flipY(point.y)}`;
    });
    return `${commands.join(' ')} Z`;
  };
  return [ringPath(vertices), ...holes.map(ringPath)].filter(Boolean).join(' ');
}
