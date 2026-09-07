import { Point } from './point.model';

export type PortalKind = 'door' | 'window' | 'opening' | 'unknown';

export interface Opening {
  id: string;
  kind: PortalKind;
  start: Point;
  end: Point;
}
