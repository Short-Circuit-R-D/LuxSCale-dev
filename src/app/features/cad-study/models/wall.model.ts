import { Point } from './point.model';
import { Polygon } from './polygon.model';
import { Segment } from './segment.model';

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  centerline: Segment;
  thickness_m: number;
  polygon: Polygon | null;
}
