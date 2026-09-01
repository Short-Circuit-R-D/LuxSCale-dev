import { Polygon } from './polygon.model';

export interface PhysicalRoom {
  id: string;
  name: string | null;
  polygon: Polygon;
  area_m2: number;
  kind: 'physical';
}
