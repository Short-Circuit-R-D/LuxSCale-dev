export const DEFAULT_OFFSET_M = 0.5;
export const FREE_AXIS_MIN_SPACING_M = 0.8;

export interface PackedAxis {
  n: number;
  coords: number[];
  spacing: number;
  endActual: number;
}

export interface UserGridSpec {
  spacingX: number | null;
  spacingY: number | null;
  offsetStartX: number;
  offsetStartY: number;
  offsetEndMinX: number;
  offsetEndMinY: number;
}

export interface GridPreview {
  nx: number;
  ny: number;
  sx: number;
  sy: number;
  positions: { x: number; y: number }[];
  freeAxis: 'x' | 'y' | null;
  endActualX: number;
  endActualY: number;
  error: string | null;
}

export function resolveOffset(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return DEFAULT_OFFSET_M;
  return value;
}

export function packAxis(
  axisLen: number,
  d0: number,
  spacing: number,
  dendMin: number,
): PackedAxis {
  const L = axisLen;
  if (spacing <= 0) {
    throw new Error('spacing must be > 0 m');
  }
  const remaining = L - d0 - dendMin;
  if (remaining < -1e-12) {
    throw new Error(
      `cannot fit a fixture: start offset ${d0} m + min far offset ${dendMin} m exceeds axis ${L} m`,
    );
  }
  const n = Math.floor(Math.max(0, remaining) / spacing) + 1;
  if (n < 1) {
    throw new Error('cannot fit a fixture on this axis with the given spacing and offsets');
  }
  const coords = Array.from({ length: n }, (_, i) => d0 + i * spacing);
  const last = coords[coords.length - 1];
  if (last > L + 1e-9) {
    throw new Error('last fixture centre would fall outside the room');
  }
  const endActual = L - last;
  if (endActual + 1e-9 < dendMin) {
    throw new Error('last fixture is closer to the far wall than offset_end_min');
  }
  return { n, coords, spacing, endActual };
}

export function stretchAxis(
  axisLen: number,
  d0: number,
  n: number,
  dendMin: number,
): PackedAxis {
  const L = axisLen;
  const count = Math.trunc(n);
  if (count < 1) {
    throw new Error('fixture count on an axis must be >= 1');
  }
  if (L - d0 + 1e-12 < dendMin) {
    throw new Error(
      `cannot fit a fixture: start offset ${d0} m + min far offset ${dendMin} m exceeds axis ${L} m`,
    );
  }
  if (count === 1) {
    return { n: 1, coords: [d0], spacing: 0, endActual: L - d0 };
  }
  const spacing = (L - d0 - dendMin) / (count - 1);
  if (spacing <= 1e-12) {
    throw new Error('stretched spacing is not positive');
  }
  const coords = Array.from({ length: count }, (_, i) => d0 + i * spacing);
  return { n: count, coords, spacing, endActual: L - coords[coords.length - 1] };
}

export function densestFreeN(axisLen: number, d0: number, dendMin: number): number {
  const remaining = axisLen - d0 - dendMin;
  if (remaining < -1e-12) {
    throw new Error(
      `cannot fit a fixture: start offset ${d0} m + min far offset ${dendMin} m exceeds axis ${axisLen} m`,
    );
  }
  return Math.max(1, Math.floor(Math.max(0, remaining) / FREE_AXIS_MIN_SPACING_M) + 1);
}

export function coordsFromCount(d0: number, spacing: number, n: number): number[] {
  if (n < 1) return [];
  if (n === 1 || spacing <= 1e-12) return [d0];
  return Array.from({ length: n }, (_, i) => d0 + i * spacing);
}

export function cartesianPositions(
  xs: number[],
  ys: number[],
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (const x of xs) {
    for (const y of ys) {
      positions.push({ x, y });
    }
  }
  return positions;
}

export function previewUserGrid(
  lengthX: number,
  widthY: number,
  spec: UserGridSpec,
): GridPreview {
  const sx = spec.spacingX;
  const sy = spec.spacingY;
  const hasX = sx != null && sx > 0;
  const hasY = sy != null && sy > 0;

  if (!hasX && !hasY) {
    return emptyPreview('Enter spacing along width, length, or both');
  }

  try {
    if (hasX && hasY) {
      const packedX = packAxis(lengthX, spec.offsetStartX, sx, spec.offsetEndMinX);
      const packedY = packAxis(widthY, spec.offsetStartY, sy, spec.offsetEndMinY);
      return {
        nx: packedX.n,
        ny: packedY.n,
        sx: packedX.spacing,
        sy: packedY.spacing,
        positions: cartesianPositions(packedX.coords, packedY.coords),
        freeAxis: null,
        endActualX: packedX.endActual,
        endActualY: packedY.endActual,
        error: null,
      };
    }

    if (hasX) {
      const packedX = packAxis(lengthX, spec.offsetStartX, sx, spec.offsetEndMinX);
      const ny = densestFreeN(widthY, spec.offsetStartY, spec.offsetEndMinY);
      const stretchedY = stretchAxis(widthY, spec.offsetStartY, ny, spec.offsetEndMinY);
      return {
        nx: packedX.n,
        ny: stretchedY.n,
        sx: packedX.spacing,
        sy: stretchedY.spacing,
        positions: cartesianPositions(packedX.coords, stretchedY.coords),
        freeAxis: 'y',
        endActualX: packedX.endActual,
        endActualY: stretchedY.endActual,
        error: null,
      };
    }

    const packedY = packAxis(widthY, spec.offsetStartY, sy!, spec.offsetEndMinY);
    const nx = densestFreeN(lengthX, spec.offsetStartX, spec.offsetEndMinX);
    const stretchedX = stretchAxis(lengthX, spec.offsetStartX, nx, spec.offsetEndMinX);
    return {
      nx: stretchedX.n,
      ny: packedY.n,
      sx: stretchedX.spacing,
      sy: packedY.spacing,
      positions: cartesianPositions(stretchedX.coords, packedY.coords),
      freeAxis: 'x',
      endActualX: stretchedX.endActual,
      endActualY: packedY.endActual,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid layout';
    return emptyPreview(message);
  }
}

export function positionsFromResultGrid(
  nx: number,
  ny: number,
  sx: number,
  sy: number,
  d0x: number,
  d0y: number,
): { x: number; y: number }[] {
  return cartesianPositions(coordsFromCount(d0x, sx, nx), coordsFromCount(d0y, sy, ny));
}

export function centeredAutoPositions(
  lengthX: number,
  widthY: number,
  nx: number,
  ny: number,
  sx: number,
  sy: number,
): { x: number; y: number }[] {
  const ox = (lengthX - sx * (nx - 1)) / 2;
  const oy = (widthY - sy * (ny - 1)) / 2;
  const xs = Array.from({ length: nx }, (_, i) => ox + i * sx);
  const ys = Array.from({ length: ny }, (_, i) => oy + i * sy);
  return cartesianPositions(xs, ys);
}

export interface LayoutFieldErrors {
  spacing: string | null;
  offsets: string | null;
  fitX: string | null;
  fitY: string | null;
}

export function validateCustomLayout(
  lengthX: number,
  widthY: number,
  spacingX: number | null,
  spacingY: number | null,
  offsetStartX: number | null,
  offsetStartY: number | null,
  offsetEndMinX: number | null,
  offsetEndMinY: number | null,
): LayoutFieldErrors {
  const errors: LayoutFieldErrors = {
    spacing: null,
    offsets: null,
    fitX: null,
    fitY: null,
  };

  const hasX = spacingX != null;
  const hasY = spacingY != null;
  if (!hasX && !hasY) {
    errors.spacing = 'Enter spacing along width (X), length (Y), or both';
  }
  if (hasX && spacingX <= 0) {
    errors.spacing = 'Spacing must be greater than 0 m';
  }
  if (hasY && spacingY <= 0) {
    errors.spacing = 'Spacing must be greater than 0 m';
  }

  const offsets = [offsetStartX, offsetStartY, offsetEndMinX, offsetEndMinY];
  if (offsets.some((v) => v != null && v < 0)) {
    errors.offsets = 'Offsets cannot be negative';
  }

  const d0x = resolveOffset(offsetStartX);
  const d0y = resolveOffset(offsetStartY);
  const dex = resolveOffset(offsetEndMinX);
  const dey = resolveOffset(offsetEndMinY);

  if (lengthX > 0 && d0x + dex > lengthX + 1e-12) {
    errors.fitX = 'Start offset + min far offset must be less than room width (X)';
  }
  if (widthY > 0 && d0y + dey > widthY + 1e-12) {
    errors.fitY = 'Start offset + min far offset must be less than room length (Y)';
  }

  return errors;
}

export function layoutErrorList(errors: LayoutFieldErrors): string[] {
  return [errors.spacing, errors.offsets, errors.fitX, errors.fitY].filter(
    (v): v is string => v != null,
  );
}

function emptyPreview(error: string): GridPreview {
  return {
    nx: 0,
    ny: 0,
    sx: 0,
    sy: 0,
    positions: [],
    freeAxis: null,
    endActualX: 0,
    endActualY: 0,
    error,
  };
}
