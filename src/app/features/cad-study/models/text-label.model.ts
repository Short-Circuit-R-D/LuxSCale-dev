import { Point } from './point.model';

export interface TextLabel {
  text: string;
  position: Point;
  height_m: number;
  nearest_room_id: string | null;
}
