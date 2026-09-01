import { BoundingBox } from './bounding-box.model';
import { CadObject } from './cad-object.model';
import { Opening } from './opening.model';
import { Point } from './point.model';
import { Polygon } from './polygon.model';
import { RoomDimensions } from './room-dimensions.model';

export type RoomKind = 'physical' | 'virtual';

export interface Room {
  id: string;
  name: string | null;
  kind: RoomKind;
  selectable: boolean;
  physical_room_id: string;
  parent_room_id: string | null;
  is_from_virtual_divider: boolean;
  polygon: Polygon;
  boundary: Polygon;
  center: Point;
  area_m2: number;
  area_net_m2: number;
  area_gross_m2: number;
  dimensions: RoomDimensions | null;
  perimeter_m: number;
  bbox: BoundingBox | null;
  neighbor_ids: string[];
  objects: CadObject[];
  doors: Opening[];
  windows: Opening[];
  fixture_count: number;
  door_count: number;
  window_count: number;
  wall_length_m: number;
  object_ids: string[];
  door_ids: string[];
  window_ids: string[];
}
