import { buildPolygonHeatmapPayload } from '../../services/luxscale.service';
import { heatmapPixelBuffer, luxFill, rotatePoint } from './heatmap-render';
import type { PolygonHeatmap } from '../../services/luxscale.service';

function heatmap(partial: Partial<PolygonHeatmap>): PolygonHeatmap {
  return {
    grid_pts: [],
    grid_values: [10, 40],
    grid_x: [0, 1],
    grid_y: [0, 1],
    lux_matrix: [
      [0, 40],
      [10, 40],
    ],
    filled_mask: [
      [false, true],
      [true, true],
    ],
    orientation_rad: 0,
    E_min: 10,
    E_avg: 25,
    E_max: 40,
    U0: 0.4,
    U1: 0,
    points_of_interest: {
      min: { x: 0, y: 0, lux: 10 },
      max: { x: 1, y: 1, lux: 40 },
      median: { x: 0, y: 1, lux: 30 },
    },
    fixture_positions: [[0.5, 0.5]],
    ...partial,
  };
}

describe('heatmapPixelBuffer', () => {
  it('skips unfilled cells and colours from E_min/E_max, not lux_matrix zeros', () => {
    expect(luxFill(10, 10, 40)).toBe('rgb(43, 43, 43)');
    expect(luxFill(40, 10, 40)).toBe('rgb(237, 235, 230)');

    const buffer = heatmapPixelBuffer(heatmap({}));
    expect(buffer).not.toBeNull();
    const data = buffer!.data;
    const pixel = (row: number, col: number) => {
      const offset = (row * buffer!.width + col) * 4;
      return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    };
    expect(pixel(1, 0)[3]).toBe(0);
    expect(pixel(1, 1)).toEqual([237, 235, 230, 255]);
    expect(pixel(0, 0)).toEqual([43, 43, 43, 255]);

    const turned = rotatePoint(1, 0, Math.PI / 2);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(1);
  });
});

describe('buildPolygonHeatmapPayload', () => {
  const vertices = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 4 },
    { x: 0, y: 4 },
  ];
  const row = {
    is_compliant: true,
    Luminaire: 'Panel',
    'Power (W)': 9,
    'Efficacy (lm/W)': 110,
    'Average Lux': 594,
    layout_nx: 6,
    layout_ny: 6,
    fixture_coordinates: [
      [1, 1],
      [3, 1],
    ],
  };

  it('coerces a string height from the CAD response', () => {
    expect(buildPolygonHeatmapPayload(vertices, '3', row)?.height).toBe(3);
  });

  it('returns null when a required row field is missing', () => {
    expect(buildPolygonHeatmapPayload(vertices, 3, { ...row, Luminaire: '' })).toBeNull();
    expect(buildPolygonHeatmapPayload(vertices.slice(0, 2), 3, row)).toBeNull();
  });

  it('fills layout counts from fixture positions when layout_nx is absent', () => {
    expect(
      buildPolygonHeatmapPayload(vertices, 3, {
        is_compliant: true,
        Luminaire: 'Panel',
        'Power (W)': 9,
        'Efficacy (lm/W)': 110,
        'Average Lux': 594,
        fixture_coordinates: [
          [1, 1],
          [3, 1],
        ],
      }),
    ).toEqual({
      polygon: {
        vertices: [
          [0, 0],
          [6, 0],
          [6, 4],
          [0, 4],
        ],
      },
      height: 3,
      Luminaire: 'Panel',
      'Power (W)': 9,
      'Efficacy (lm/W)': 110,
      'Average Lux': 594,
      layout_nx: 2,
      layout_ny: 1,
      fixture_coordinates: [
        [1, 1],
        [3, 1],
      ],
    });
  });

  it('maps the selected row onto the engine payload and clamps resolution', () => {
    expect(buildPolygonHeatmapPayload(vertices, 3, row, { resolution: 128 })).toEqual({
      polygon: {
        vertices: [
          [0, 0],
          [6, 0],
          [6, 4],
          [0, 4],
        ],
      },
      height: 3,
      Luminaire: 'Panel',
      'Power (W)': 9,
      'Efficacy (lm/W)': 110,
      'Average Lux': 594,
      layout_nx: 6,
      layout_ny: 6,
      fixture_coordinates: [
        [1, 1],
        [3, 1],
      ],
      resolution: 128,
    });
    expect(buildPolygonHeatmapPayload(vertices, 3, row, { resolution: 4096 })?.resolution).toBe(256);
  });
});
