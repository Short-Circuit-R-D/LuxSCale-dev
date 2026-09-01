import { BoundingBox } from './bounding-box.model';
import { Point } from './point.model';

export interface CadObject {
  id: string;
  category: string | null;
  position: Point;
  rotation_deg: number;
  bounding_box: BoundingBox;
  block_name: string | null;
  room_id: string | null;
}
