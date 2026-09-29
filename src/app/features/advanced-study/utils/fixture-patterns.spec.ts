import { describe, expect, it } from 'vitest';
import {
  generateOrthogonalGrid,
  generatePerimeterLayout,
  generateStaggeredGrid,
  pointInPolygon,
  type GridPatternParams,
  type PerimeterPatternParams,
  type Point2D,
} from './fixture-patterns';

describe('fixture-patterns', () => {
  const rectPoly: Point2D[] = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 6 },
    { x: 0, y: 6 },
  ];

  const defaultMeta = {
    mountingHeight: 2.8,
    rotation: 0,
    tiltAngle: 0,
    variantId: 'var-panel-1',
  };

  it('pointInPolygon correctly determines interior points', () => {
    expect(pointInPolygon({ x: 4, y: 3 }, rectPoly)).toBe(true);
    expect(pointInPolygon({ x: -1, y: 3 }, rectPoly)).toBe(false);
    expect(pointInPolygon({ x: 9, y: 3 }, rectPoly)).toBe(false);
    expect(pointInPolygon({ x: 4, y: 7 }, rectPoly)).toBe(false);
  });

  it('generates orthogonal grid by count', () => {
    const params: GridPatternParams = {
      gridType: 'count',
      countX: 3,
      countY: 2,
      offsetFraction: 0.5,
      spacingX: 2.5,
      spacingY: 2.5,
      autoCenter: true,
    };

    const fixtures = generateOrthogonalGrid(rectPoly, params, defaultMeta);
    expect(fixtures.length).toBe(6);
    expect(fixtures[0].id).toBe('F1');
    expect(fixtures[0].z).toBe(2.8);
    expect(fixtures[0].variantId).toBe('var-panel-1');

    // Symmetric half-spacing in 8x6 room:
    // Sx = 8 / (3 - 1 + 2*0.5) = 8 / 3 ≈ 2.67m, dx = 1.33m
    // Sy = 6 / (2 - 1 + 2*0.5) = 6 / 2 = 3.0m, dy = 1.5m
    expect(fixtures[0].x).toBeCloseTo(1.33, 1);
    expect(fixtures[0].y).toBeCloseTo(1.5, 1);
  });

  it('generates staggered grid with horizontal shift on alternating rows', () => {
    const params: GridPatternParams = {
      gridType: 'count',
      countX: 3,
      countY: 2,
      offsetFraction: 0.5,
      spacingX: 2.5,
      spacingY: 2.5,
      autoCenter: true,
    };

    const fixtures = generateStaggeredGrid(rectPoly, params, defaultMeta);
    expect(fixtures.length).toBeGreaterThan(0);

    // Row 0 vs Row 1: Row 1 should be shifted by Sx/2
    const row0 = fixtures.filter((f) => Math.abs(f.y - fixtures[0].y) < 0.1);
    const row1 = fixtures.filter((f) => Math.abs(f.y - fixtures[0].y) >= 0.1);

    expect(row0.length).toBeGreaterThan(0);
    expect(row1.length).toBeGreaterThan(0);
    const shift = (8 / 3) / 2; // ≈ 1.33m
    expect(row1[0].x - row0[0].x).toBeCloseTo(shift, 1);
  });

  it('generates perimeter layout along walls with tangent rotation', () => {
    const params: PerimeterPatternParams = {
      wallOffset: 0.8,
      perimeterSpacing: 2.0,
    };

    const fixtures = generatePerimeterLayout(rectPoly, params, defaultMeta);
    expect(fixtures.length).toBeGreaterThan(4);

    // Verify all fixtures are inset from the walls
    for (const f of fixtures) {
      expect(f.x).toBeGreaterThanOrEqual(0.7);
      expect(f.x).toBeLessThanOrEqual(7.3);
      expect(f.y).toBeGreaterThanOrEqual(0.7);
      expect(f.y).toBeLessThanOrEqual(5.3);
    }

    // Verify rotation aligns with wall tangents:
    // Bottom wall (y ≈ 0.8) should have rotation ≈ 0°
    // Right wall (x ≈ 7.2) should have rotation ≈ 90°
    // Top wall (y ≈ 5.2) should have rotation ≈ 180°
    // Left wall (x ≈ 0.8) should have rotation ≈ 270°
    const bottomFixtures = fixtures.filter((f) => Math.abs(f.y - 0.8) < 0.05 && f.x > 1.0 && f.x < 7.0);
    const rightFixtures = fixtures.filter((f) => Math.abs(f.x - 7.2) < 0.05 && f.y > 1.0 && f.y < 5.0);

    expect(bottomFixtures.length).toBeGreaterThan(0);
    expect(bottomFixtures[0].rotation).toBe(0);

    expect(rightFixtures.length).toBeGreaterThan(0);
    expect(rightFixtures[0].rotation).toBe(90);
  });
});
