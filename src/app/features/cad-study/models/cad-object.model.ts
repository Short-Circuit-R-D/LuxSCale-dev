import { BoundingBox } from './bounding-box.model';
import { Point } from './point.model';

export interface CadObject {
  id: string;
  category: string | null;
  position: Point;
  bounding_box: BoundingBox;
  block_name: string | null;
  room_id: string | null;
  rotation_deg?: number;
}
