import { luxFill, rotatePoint } from './heatmap-render';

describe('luxFill', () => {
  it('colours from min/max, not absolute lux', () => {
    expect(luxFill(10, 10, 40)).toBe('rgb(43, 43, 43)');
    expect(luxFill(40, 10, 40)).toBe('rgb(237, 235, 230)');
    expect(luxFill(25, 10, 40)).toBe('rgb(140, 139, 137)');
  });

  it('supports false-color and brand palettes', () => {
    import('./heatmap-render').then(({ luxFillWithPalette }) => {
      expect(luxFillWithPalette(0, 0, 100, 'false-color')).toBe('rgb(11, 28, 51)');
      expect(luxFillWithPalette(100, 0, 100, 'false-color')).toBe('rgb(255, 247, 204)');
      expect(luxFillWithPalette(0, 0, 100, 'brand')).toBe('rgb(17, 17, 17)');
      expect(luxFillWithPalette(100, 0, 100, 'brand')).toBe('rgb(255, 255, 255)');
    });
  });
});


describe('rotatePoint', () => {
  it('rotates a point around the origin', () => {
    const turned = rotatePoint(1, 0, Math.PI / 2);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(1);
  });
});
