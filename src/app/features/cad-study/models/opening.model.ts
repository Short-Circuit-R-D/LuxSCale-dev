import { Point } from './point.model';
import { Segment } from './segment.model';

export interface Opening {
  id: string;
  kind?: string;
  position: Point;
  width_m: number;
  portal?: Segment | null;
  wall_id?: string;
  connects_room_ids?: string[];
}
