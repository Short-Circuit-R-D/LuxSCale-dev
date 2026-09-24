import { describe, expect, it } from 'vitest';
import {
  measureSplit,
  roomContainingPoint,
  segmentAcrossBbox,
  snapSplitSegment,
} from './cad-geometry';
import type { Room } from './models/room.model';

function room(partial: Partial<Room> = {}): Room {
  return {
    id: 'room-1',
    name: 'Kitchen',
    kind: 'physical',
    selectable: true,
    confidence: 1,
    physical_room_id: 'room-1',
    parent_room_id: null,
    polygon: {
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 0, y: 4 },
      ],
    },
    center: { x: 2.5, y: 2 },
    area_m2: 20,
    area_net_m2: 20,
    area_gross_m2: 20,
    dimensions: null,
    perimeter_m: 18,
    bbox: { min_x: 0, min_y: 0, max_x: 5, max_y: 4 },
    neighbor_ids: [],
    objects: [],
    doors: [],
    windows: [],
    object_ids: [],
    door_ids: [],
    window_ids: [],
    ...partial,
  };
}

describe('snapSplitSegment', () => {
  it('locks to horizontal on dominant x delta', () => {
    expect(snapSplitSegment({ x: 1, y: 1 }, { x: 4, y: 1.2 })).toEqual({
      start: { x: 1, y: 1 },
      end: { x: 4, y: 1 },
      axis: 'horizontal',
    });
  });

  it('locks to vertical on dominant y delta', () => {
    expect(snapSplitSegment({ x: 1, y: 1 }, { x: 1.2, y: 4 })).toEqual({
      start: { x: 1, y: 1 },
      end: { x: 1, y: 4 },
      axis: 'vertical',
    });
  });

  it('breaks ties toward horizontal', () => {
    expect(snapSplitSegment({ x: 0, y: 0 }, { x: 2, y: 2 }).axis).toBe('horizontal');
  });
});

describe('roomContainingPoint', () => {
  it('returns the smallest room containing the point', () => {
    const big = room({ id: 'big', area_m2: 100, area_net_m2: 100 });
    const small = room({ id: 'small', area_m2: 5, area_net_m2: 5 });
    expect(roomContainingPoint([big, small], { x: 2, y: 2 })?.id).toBe('small');
  });

  it('returns null outside every room', () => {
    expect(roomContainingPoint([room()], { x: 9, y: 9 })).toBeNull();
  });
});

describe('measureSplit', () => {
  it('measures a horizontal cut from both bbox edges', () => {
    const measure = measureSplit(room(), { x: 0, y: 1 }, { x: 5, y: 1.4 });
    expect(measure).toMatchObject({
      roomId: 'room-1',
      axis: 'horizontal',
      cutLength: 5,
      fromMin: 1,
      toMax: 3,
      span: 4,
    });
  });

  it('measures a vertical cut from both bbox edges', () => {
    const measure = measureSplit(room(), { x: 2, y: 0 }, { x: 2.1, y: 4 });
    expect(measure).toMatchObject({
      axis: 'vertical',
      fromMin: 2,
      toMax: 3,
      span: 5,
    });
  });
});

describe('segmentAcrossBbox', () => {
  const bbox = { min_x: 0, min_y: 0, max_x: 5, max_y: 4 };

  it('spans wall to wall at an exact offset from the min edge', () => {
    expect(segmentAcrossBbox(bbox, 'horizontal', 'min', 1)).toEqual({
      start: { x: 0, y: 1 },
      end: { x: 5, y: 1 },
    });
    expect(segmentAcrossBbox(bbox, 'vertical', 'max', 2)).toEqual({
      start: { x: 3, y: 0 },
      end: { x: 3, y: 4 },
    });
  });

  it('rejects out-of-range offsets', () => {
    expect(segmentAcrossBbox(bbox, 'horizontal', 'min', 0)).toBeNull();
    expect(segmentAcrossBbox(bbox, 'horizontal', 'min', 4)).toBeNull();
    expect(segmentAcrossBbox(bbox, 'vertical', 'max', -1)).toBeNull();
    expect(segmentAcrossBbox(bbox, 'vertical', 'min', Number.NaN)).toBeNull();
  });
});
