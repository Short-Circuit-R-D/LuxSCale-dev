import { type Point } from './room-polygon';

const FILL_LOW = { r: 0x2b, g: 0x2b, b: 0x2b };
const FILL_HIGH = { r: 0xed, g: 0xeb, b: 0xe6 };

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

export type HeatmapPalette = 'false-color' | 'brand';

const FALSE_COLOR_STOPS = [
  { t: 0.0, r: 11, g: 28, b: 51 }, // Deep Navy (#0b1c33)
  { t: 0.33, r: 31, g: 111, b: 235 }, // Royal Blue (#1f6feb)
  { t: 0.66, r: 240, g: 162, b: 2 }, // Amber Gold (#f0a202)
  { t: 1.0, r: 255, g: 247, b: 204 }, // Soft White (#fff7cc)
];

const BRAND_STOPS = [
  { t: 0.0, r: 17, g: 17, b: 17 }, // #111111 Surface
  { t: 0.35, r: 43, g: 43, b: 43 }, // #2B2B2B Border
  { t: 0.65, r: 184, g: 184, b: 184 }, // #B8B8B8 Muted
  { t: 0.88, r: 244, g: 183, b: 64 }, // #F4B740 Amber
  { t: 1.0, r: 255, g: 255, b: 255 }, // #FFFFFF White
];

function interpolateStops(
  t: number,
  stops: readonly { t: number; r: number; g: number; b: number }[],
): string {
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].t < clamped) i++;
  const s0 = stops[i];
  const s1 = stops[i + 1] ?? s0;
  const span = s1.t - s0.t;
  const factor = span > 0 ? (clamped - s0.t) / span : 0;
  const r = Math.round(s0.r + factor * (s1.r - s0.r));
  const g = Math.round(s0.g + factor * (s1.g - s0.g));
  const b = Math.round(s0.b + factor * (s1.b - s0.b));
  return `rgb(${r}, ${g}, ${b})`;
}

export function luxFillWithPalette(
  lux: number,
  min: number,
  max: number,
  palette: HeatmapPalette = 'false-color',
): string {
  const t = max <= min ? 0.5 : (lux - min) / (max - min);
  const stops = palette === 'brand' ? BRAND_STOPS : FALSE_COLOR_STOPS;
  return interpolateStops(t, stops);
}

