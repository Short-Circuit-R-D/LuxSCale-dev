import { CadObject } from './cad-object.model';
import { LayoutMeta } from './layout-meta.model';
import { Opening } from './opening.model';
import { PhysicalRoom } from './physical-room.model';
import { Room } from './room.model';
import { TextLabel } from './text-label.model';
import { VirtualDivider } from './virtual-divider.model';
import { Wall } from './wall.model';
import { Warning } from './warning.model';

export interface Layout {
  unit: 'm';
  meta: LayoutMeta;
  walls: Wall[];
  rooms: Room[];
  physical_rooms: PhysicalRoom[];
  virtual_dividers: VirtualDivider[];
  objects: CadObject[];
  unassigned_objects: CadObject[];
  doors: Opening[];
  windows: Opening[];
  lights: CadObject[];
  texts: TextLabel[];
  warnings: Warning[];
}
