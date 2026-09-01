import { Polygon } from './polygon.model';

export interface Warning {
  code?: string;
  message?: string;
  detail?: string;
  boundary?: Polygon;
}
