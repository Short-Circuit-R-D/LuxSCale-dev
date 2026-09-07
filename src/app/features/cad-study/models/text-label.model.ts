import { Point } from './point.model';

export interface TextLabel {
  id: string;
  text: string;
  position: Point;
  height_m: number;
  room_id: string | null;
}
