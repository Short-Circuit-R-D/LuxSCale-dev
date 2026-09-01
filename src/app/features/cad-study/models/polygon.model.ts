import { Point } from './point.model';

export interface Polygon {
  vertices: Point[];
  holes?: Point[][];
}
