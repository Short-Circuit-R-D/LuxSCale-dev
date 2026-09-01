export interface RoomDimensionSpan {
  direction: 'length' | 'width' | string;
  meters: number;
}

export interface RoomDimensions {
  length_m: number;
  width_m: number;
  orientation_deg: number;
  method: 'wall_aligned_spans' | 'min_rotated_rectangle' | string;
  source: Array<'computed' | 'parsed_dimension' | string>;
  spans: RoomDimensionSpan[];
}
