import type { FreeFixtureDto } from '../../../core/calculate/dtos/calculate-request.dto';

export interface Point2D {
  x: number;
  y: number;
}

export interface GridPatternParams {
  gridType: 'count' | 'spacing';
  countX: number;
  countY: number;
  offsetFraction: number;
  spacingX: number;
  spacingY: number;
  autoCenter: boolean;
}

export interface PerimeterPatternParams {
  wallOffset: number;
  perimeterSpacing: number;
}

export interface FixtureMeta {
  mountingHeight: number;
  rotation: number;
  tiltAngle?: number;
  variantId?: string | null;
  iesRef?: string | null;
}

/**
 * Standard ray-casting point-in-polygon containment test.
 */
export function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes axis-aligned bounding box of a polygon.
 */
export function polygonBoundingBox(poly: Point2D[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  spanX: number;
  spanY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    spanX: Math.max(0.01, maxX - minX),
    spanY: Math.max(0.01, maxY - minY),
  };
}

/**
 * Generates an orthogonal grid of luminaires bounded by the room polygon.
 */
export function generateOrthogonalGrid(
  poly: Point2D[],
  params: GridPatternParams,
  meta: FixtureMeta,
): FreeFixtureDto[] {
  const { minX, spanX, minY, spanY } = polygonBoundingBox(poly);
  let xs: number[] = [];
  let ys: number[] = [];

  if (params.gridType === 'count') {
    const cx = Math.max(1, Math.round(params.countX));
    const cy = Math.max(1, Math.round(params.countY));
    const frac = Math.max(0, Math.min(1, params.offsetFraction));

    const denomX = cx > 1 ? cx - 1 + 2 * frac : 2 * frac || 1;
    const sx = spanX / denomX;
    const dx = sx * frac;
    xs = Array.from({ length: cx }, (_, i) => minX + dx + i * sx);

    const denomY = cy > 1 ? cy - 1 + 2 * frac : 2 * frac || 1;
    const sy = spanY / denomY;
    const dy = sy * frac;
    ys = Array.from({ length: cy }, (_, j) => minY + dy + j * sy);
  } else {
    const sx = Math.max(0.2, params.spacingX);
    const sy = Math.max(0.2, params.spacingY);
    const countX = Math.max(1, Math.floor(spanX / sx));
    const countY = Math.max(1, Math.floor(spanY / sy));

    const dx = params.autoCenter ? (spanX - (countX - 1) * sx) / 2 : sx / 2;
    const dy = params.autoCenter ? (spanY - (countY - 1) * sy) / 2 : sy / 2;

    xs = Array.from({ length: countX }, (_, i) => minX + dx + i * sx);
    ys = Array.from({ length: countY }, (_, j) => minY + dy + j * sy);
  }

  const fixtures: FreeFixtureDto[] = [];
  let index = 1;

  for (const y of ys) {
    for (const x of xs) {
      const cleanX = Math.round(x * 100) / 100;
      const cleanY = Math.round(y * 100) / 100;
      if (pointInPolygon({ x: cleanX, y: cleanY }, poly)) {
        fixtures.push({
          id: `F${index++}`,
          x: cleanX,
          y: cleanY,
          z: meta.mountingHeight,
          rotation: meta.rotation,
          tiltAngle: meta.tiltAngle ?? 0,
          variantId: meta.variantId ?? null,
          iesRef: meta.iesRef ?? null,
        });
      }
    }
  }

  return fixtures;
}

/**
 * Generates a staggered / honeycomb row grid.
 * Odd rows are horizontally shifted by half the column spacing (Sx / 2).
 */
export function generateStaggeredGrid(
  poly: Point2D[],
  params: GridPatternParams,
  meta: FixtureMeta,
): FreeFixtureDto[] {
  const { minX, spanX, minY, spanY } = polygonBoundingBox(poly);
  let xs: number[] = [];
  let ys: number[] = [];
  let spacingX = 0;

  if (params.gridType === 'count') {
    const cx = Math.max(1, Math.round(params.countX));
    const cy = Math.max(1, Math.round(params.countY));
    const frac = Math.max(0, Math.min(1, params.offsetFraction));

    const denomX = cx > 1 ? cx - 1 + 2 * frac : 2 * frac || 1;
    spacingX = spanX / denomX;
    const dx = spacingX * frac;
    xs = Array.from({ length: cx }, (_, i) => minX + dx + i * spacingX);

    const denomY = cy > 1 ? cy - 1 + 2 * frac : 2 * frac || 1;
    const sy = spanY / denomY;
    const dy = sy * frac;
    ys = Array.from({ length: cy }, (_, j) => minY + dy + j * sy);
  } else {
    spacingX = Math.max(0.2, params.spacingX);
    const sy = Math.max(0.2, params.spacingY);
    const countX = Math.max(1, Math.floor(spanX / spacingX));
    const countY = Math.max(1, Math.floor(spanY / sy));

    const dx = params.autoCenter ? (spanX - (countX - 1) * spacingX) / 2 : spacingX / 2;
    const dy = params.autoCenter ? (spanY - (countY - 1) * sy) / 2 : sy / 2;

    xs = Array.from({ length: countX }, (_, i) => minX + dx + i * spacingX);
    ys = Array.from({ length: countY }, (_, j) => minY + dy + j * sy);
  }

  const shift = spacingX / 2;
  const fixtures: FreeFixtureDto[] = [];
  let index = 1;

  ys.forEach((y, rowIndex) => {
    const rowShift = rowIndex % 2 === 1 ? shift : 0;
    for (const baseX of xs) {
      let x = baseX + rowShift;
      // If shifted point exceeds right bound, try wrapping back if room permits
      if (rowShift > 0 && x > spanX + minX - 0.1) {
        x -= spanX;
      }

      const cleanX = Math.round(x * 100) / 100;
      const cleanY = Math.round(y * 100) / 100;
      if (pointInPolygon({ x: cleanX, y: cleanY }, poly)) {
        fixtures.push({
          id: `F${index++}`,
          x: cleanX,
          y: cleanY,
          z: meta.mountingHeight,
          rotation: meta.rotation,
          tiltAngle: meta.tiltAngle ?? 0,
          variantId: meta.variantId ?? null,
          iesRef: meta.iesRef ?? null,
        });
      }
    }
  });

  return fixtures;
}

/**
 * Generates luminaires arranged along the perimeter walls with wall inset offset
 * and perimeter spacing, orienting each fixture parallel to its adjacent wall.
 */
export function generatePerimeterLayout(
  poly: Point2D[],
  params: PerimeterPatternParams,
  meta: FixtureMeta,
): FreeFixtureDto[] {
  if (poly.length < 3) return [];
  const offset = Math.max(0.1, params.wallOffset);
  const spacing = Math.max(0.5, params.perimeterSpacing);

  const rawFixtures: Array<{ x: number; y: number; rotation: number }> = [];

  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.2) continue;

    const tx = dx / len;
    const ty = dy / len;

    // Normal pointing inward (left of tangent for CCW polygon)
    let nx = -ty;
    let ny = tx;

    // Test a midpoint step into room to guarantee inward orientation
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    if (!pointInPolygon({ x: midX + nx * 0.1, y: midY + ny * 0.1 }, poly)) {
      nx = -nx;
      ny = -ny;
    }

    // Luminaire rotation parallel to the wall tangent
    let wallRot = Math.round(Math.atan2(dy, dx) * (180 / Math.PI));
    if (wallRot < 0) wallRot += 360;

    const startX = p1.x + nx * offset + tx * offset;
    const startY = p1.y + ny * offset + ty * offset;
    const insetSpan = Math.max(0, len - 2 * offset);

    if (insetSpan < 0.2) {
      const fx = Math.round((midX + nx * offset) * 100) / 100;
      const fy = Math.round((midY + ny * offset) * 100) / 100;
      if (pointInPolygon({ x: fx, y: fy }, poly)) {
        rawFixtures.push({ x: fx, y: fy, rotation: wallRot });
      }
    } else {
      const count = Math.max(1, Math.round(insetSpan / spacing)) + 1;
      const step = count > 1 ? insetSpan / (count - 1) : 0;
      for (let m = 0; m < count; m++) {
        const fx = Math.round((startX + tx * (m * step)) * 100) / 100;
        const fy = Math.round((startY + ty * (m * step)) * 100) / 100;
        if (pointInPolygon({ x: fx, y: fy }, poly)) {
          rawFixtures.push({ x: fx, y: fy, rotation: wallRot });
        }
      }
    }
  }

  // Deduplicate adjacent corner points closer than 0.35m
  const deduped: Array<{ x: number; y: number; rotation: number }> = [];
  for (const f of rawFixtures) {
    if (!deduped.some((d) => Math.hypot(f.x - d.x, f.y - d.y) < 0.35)) {
      deduped.push(f);
    }
  }

  return deduped.map((f, i) => ({
    id: `F${i + 1}`,
    x: f.x,
    y: f.y,
    z: meta.mountingHeight,
    rotation: f.rotation,
    tiltAngle: meta.tiltAngle ?? 0,
    variantId: meta.variantId ?? null,
    iesRef: meta.iesRef ?? null,
  }));
}
