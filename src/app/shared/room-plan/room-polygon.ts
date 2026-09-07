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
