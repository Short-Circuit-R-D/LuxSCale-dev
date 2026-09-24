import { PolygonHeatmap } from '../../services/luxscale.service';
import { type Point } from './room-polygon';

const FILL_LOW = { r: 0x2b, g: 0x2b, b: 0x2b };
const FILL_HIGH = { r: 0xed, g: 0xeb, b: 0xe6 };

export const HEATMAP_RESOLUTIONS = [32, 64, 128, 256] as const;
export const DEFAULT_HEATMAP_RESOLUTION = 128;
export const HEATMAP_RESOLUTION_MIN = 8;
export const HEATMAP_RESOLUTION_MAX = 256;

export function clampHeatmapResolution(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return DEFAULT_HEATMAP_RESOLUTION;
  }
  return Math.min(HEATMAP_RESOLUTION_MAX, Math.max(HEATMAP_RESOLUTION_MIN, Math.round(n)));
}

export function rotatePoint(x: number, y: number, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function luxFillRgb(lux: number, min: number, max: number): [number, number, number] {
  const t = max <= min ? 0.5 : Math.min(1, Math.max(0, (lux - min) / (max - min)));
  return [
    Math.round(FILL_LOW.r + t * (FILL_HIGH.r - FILL_LOW.r)),
    Math.round(FILL_LOW.g + t * (FILL_HIGH.g - FILL_LOW.g)),
    Math.round(FILL_LOW.b + t * (FILL_HIGH.b - FILL_LOW.b)),
  ];
}

export function luxFill(lux: number, min: number, max: number): string {
  const [r, g, b] = luxFillRgb(lux, min, max);
  return `rgb(${r}, ${g}, ${b})`;
}

export interface HeatmapImageBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function heatmapImageBox(heatmap: PolygonHeatmap): HeatmapImageBox | null {
  const gridX = heatmap.grid_x;
  const gridY = heatmap.grid_y;
  if (!Array.isArray(gridX) || !Array.isArray(gridY) || gridX.length < 1 || gridY.length < 1) {
    return null;
  }
  const minX = Math.min(...gridX);
  const maxX = Math.max(...gridX);
  const minY = Math.min(...gridY);
  const maxY = Math.max(...gridY);
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    return null;
  }
  const dx = gridX.length > 1 ? Math.abs(gridX[1] - gridX[0]) : Math.max(maxX - minX, 0.01);
  const dy = gridY.length > 1 ? Math.abs(gridY[1] - gridY[0]) : Math.max(maxY - minY, 0.01);
  return {
    x: minX - dx / 2,
    y: minY - dy / 2,
    w: Math.max(maxX - minX + dx, 0.01),
    h: Math.max(maxY - minY + dy, 0.01),
  };
}

/** One display pixel per lux_matrix cell. Unfilled cells are transparent. Colour from E_min/E_max. */
export function heatmapPixelBuffer(
  heatmap: PolygonHeatmap,
): { width: number; height: number; data: Uint8ClampedArray } | null {
  const matrix = heatmap.lux_matrix;
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
    return null;
  }
  const rows = matrix.length;
  const cols = matrix[0].length;
  const mask = heatmap.filled_mask;
  const min = heatmap.E_min;
  const max = heatmap.E_max;
  const gridY = heatmap.grid_y;
  const flipRows =
    Array.isArray(gridY) && gridY.length >= 2 && Number.isFinite(gridY[0]) && Number.isFinite(gridY[gridY.length - 1])
      ? gridY[0] < gridY[gridY.length - 1]
      : true;
  const data = new Uint8ClampedArray(rows * cols * 4);
  for (let j = 0; j < rows; j++) {
    const values = matrix[j];
    if (!Array.isArray(values)) {
      continue;
    }
    const destJ = flipRows ? rows - 1 - j : j;
    for (let i = 0; i < cols; i++) {
      const offset = (destJ * cols + i) * 4;
      if (mask?.[j]?.[i] === false) {
        continue;
      }
      const lux = values[i];
      if (!Number.isFinite(lux)) {
        continue;
      }
      const [r, g, b] = luxFillRgb(lux, min, max);
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }
  return { width: cols, height: rows, data };
}

export function heatmapDataUrl(heatmap: PolygonHeatmap): string | null {
  const buffer = heatmapPixelBuffer(heatmap);
  if (!buffer || typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = buffer.width;
  canvas.height = buffer.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const image = ctx.createImageData(buffer.width, buffer.height);
  image.data.set(buffer.data);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function heatmapImageMatrix(
  box: HeatmapImageBox,
  orientationRad: number,
  flipMaxY: number,
): string {
  const theta = Number.isFinite(orientationRad) ? orientationRad : 0;
  const nw = toSvg(box.x, box.y + box.h, theta, flipMaxY);
  const ne = toSvg(box.x + box.w, box.y + box.h, theta, flipMaxY);
  const sw = toSvg(box.x, box.y, theta, flipMaxY);
  const a = (ne.x - nw.x) / box.w;
  const b = (ne.y - nw.y) / box.w;
  const c = (sw.x - nw.x) / box.h;
  const d = (sw.y - nw.y) / box.h;
  return `matrix(${a} ${b} ${c} ${d} ${nw.x} ${nw.y})`;
}

function toSvg(u: number, v: number, theta: number, maxY: number): Point {
  const world = rotatePoint(u, v, theta);
  return { x: world.x, y: maxY - world.y };
}
