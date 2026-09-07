import { Polygon } from './polygon.model';

export interface Face {
  id: string;
  boundary: Polygon;
  area_m2: number;
  predicted_class: string;
  confidence: number;
  decision_source: string;
  accepted_as_room: boolean;
  adjacent_unbounded: boolean;
}
