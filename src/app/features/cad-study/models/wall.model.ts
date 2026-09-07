import { Point } from './point.model';
import { Polygon } from './polygon.model';

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  polygon?: Polygon | null;
}
