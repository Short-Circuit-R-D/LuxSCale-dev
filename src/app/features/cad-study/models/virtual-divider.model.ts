import { Point } from './point.model';

export interface VirtualDivider {
  id: string;
  start: Point;
  end: Point;
  active?: boolean;
}
