import { collapseColinearRing, localMeterPolygon } from './room-polygon';

describe('localMeterPolygon', () => {
  it('shifts the bounding-box bottom-left to the origin and keeps fractional meters', () => {
    const result = localMeterPolygon([
      { x: 10.25, y: 4.5 },
      { x: 12.25, y: 4.5 },
      { x: 12.25, y: 7 },
      { x: 10.25, y: 7 },
    ]);
    expect(result.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2.5 },
      { x: 0, y: 2.5 },
    ]);
  });

  it('pins (0, 0) to the box corner even when no vertex sits there', () => {
    const result = localMeterPolygon([
      { x: 5, y: 1 },
      { x: 6, y: 2 },
      { x: 5, y: 3 },
      { x: 3, y: 2 },
    ]);
    expect(result.vertices.every((point) => point.x >= 0 && point.y >= 0)).toBe(true);
    expect(result.vertices).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 1 },
    ]);
  });

  it('drops a closing duplicate vertex', () => {
    const result = localMeterPolygon([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ]);
    expect(result.vertices).toHaveLength(4);
    expect(result.vertices[0]).toEqual({ x: 0, y: 0 });
  });
});

describe('collapseColinearRing', () => {
  it('merges tessellated wall samples into one side per wall', () => {
    const ring = collapseColinearRing([
      { x: 0, y: 0 },
      { x: 0.27, y: 0 },
      { x: 0.54, y: 0 },
      { x: 5.3, y: 0 },
      { x: 5.3, y: 1.2 },
      { x: 5.3, y: 2.4 },
      { x: 5.3, y: 4 },
      { x: 0, y: 4 },
    ]);
    expect(ring).toEqual([
      { x: 0, y: 0 },
      { x: 5.3, y: 0 },
      { x: 5.3, y: 4 },
      { x: 0, y: 4 },
    ]);
  });
});
