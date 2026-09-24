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
