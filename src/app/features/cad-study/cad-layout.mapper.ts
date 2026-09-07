import { bboxFromPoints } from './cad-geometry';
import { BoundingBox } from './models/bounding-box.model';
import { CadObject } from './models/cad-object.model';
import { Face } from './models/face.model';
import { Layout } from './models/layout.model';
import { LayoutMeta, UnitSource } from './models/layout-meta.model';
import { Opening, PortalKind } from './models/opening.model';
import { Point } from './models/point.model';
import { Polygon } from './models/polygon.model';
import { Room, RoomKind } from './models/room.model';
import { RoomDimensions } from './models/room-dimensions.model';
import { TextLabel } from './models/text-label.model';
import { VirtualDivider } from './models/virtual-divider.model';
import { Wall } from './models/wall.model';
import { Warning, WarningSeverity } from './models/warning.model';

type Raw = Record<string, unknown>;

const UNIT_SOURCES: UnitSource[] = ['explicit', 'cad_metadata', 'fallback'];
const PORTAL_KINDS: PortalKind[] = ['door', 'window', 'opening', 'unknown'];
const SEVERITIES: WarningSeverity[] = ['info', 'warning', 'error'];

/** Maps an engine `LayoutDto` into the viewer model. Returns null when the payload is not a layout. */
export function layoutFromEngine(value: unknown): Layout | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const hasRooms = Array.isArray(raw['rooms']);
  const hasWalls = Array.isArray(raw['walls']);
  const hasMeta = asRecord(raw['meta']) !== null;
  if (!hasRooms && !hasWalls && !hasMeta) {
    return null;
  }

  const meta = metaFrom(raw['meta']);
  const objects = list(raw['objects']).map((item, index) => objectFrom(item, `object-${index + 1}`));
  const unassigned = list(raw['unassigned_objects']).map((item, index) =>
    objectFrom(item, `unassigned-${index + 1}`),
  );
  const doors = list(raw['doors']).map((item, index) => openingFrom(item, `door-${index + 1}`, 'door'));
  const windows = list(raw['windows']).map((item, index) =>
    openingFrom(item, `window-${index + 1}`, 'window'),
  );

  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));
  const lookups = {
    objects: byId([...objects, ...unassigned]),
    doors: byId(doors),
    windows: byId(windows),
  };

  return {
    unit: 'm',
    meta,
    walls: list(raw['walls']).map((item, index) => wallFrom(item, index)),
    rooms: list(raw['rooms']).map((item, index) => roomFrom(item, index, lookups)),
    physical_rooms: list(raw['physical_rooms']).map((item, index) => roomFrom(item, index, lookups)),
    virtual_dividers: list(raw['virtual_dividers']).map((item, index) => dividerFrom(item, index)),
    objects,
    unassigned_objects: unassigned,
    doors,
    windows,
    lights: list(raw['lights']).map((item, index) => lightFrom(item, `light-${index + 1}`)),
    texts: list(raw['texts']).map((item, index) => textFrom(item, index)),
    warnings: list(raw['warnings']).map(warningFrom),
  };
}

/** Maps an engine `FaceListDto` (or a bare face array) into viewer faces. */
export function facesFromEngine(value: unknown): Face[] {
  const raw = asRecord(value);
  const source = Array.isArray(value) ? value : list(raw?.['faces']);
  return source.map((item, index) => faceFrom(item, index));
}

function metaFrom(value: unknown): LayoutMeta {
  const raw = asRecord(value) ?? {};
  return {
    job_id: text(raw['job_id']),
    unit: text(raw['unit']) || 'm',
    unit_source: UNIT_SOURCES.includes(raw['unit_source'] as UnitSource)
      ? (raw['unit_source'] as UnitSource)
      : 'fallback',
    scale_factor: num(raw['scale_factor'], 1),
    layout_rev: num(raw['layout_rev'], 0),
    engine_sha: text(raw['engine_sha']),
    pipeline_version: text(raw['pipeline_version']),
    created_at: text(raw['created_at']),
  };
}

function roomFrom(
  value: unknown,
  index: number,
  lookups: {
    objects: Map<string, CadObject>;
    doors: Map<string, Opening>;
    windows: Map<string, Opening>;
  },
): Room {
  const raw = asRecord(value) ?? {};
  const id = text(raw['id']) || `room-${index + 1}`;
  const polygon = polygonFrom(raw['boundary'] ?? raw['polygon']);
  const bbox = bboxFrom(raw['bbox']) ?? bboxFromPoints(polygon.vertices);
  const areaNet = num(raw['area_net_m2'], num(raw['area_m2'], 0));
  const objectIds = strings(raw['object_ids']);
  const doorIds = strings(raw['door_ids']);
  const windowIds = strings(raw['window_ids']);

  return {
    id,
    name: text(raw['name']) || null,
    kind: (text(raw['kind']) === 'virtual' ? 'virtual' : 'physical') as RoomKind,
    selectable: raw['selectable'] !== false,
    confidence: num(raw['confidence'], 1),
    physical_room_id: text(raw['physical_room_id']) || id,
    parent_room_id: text(raw['parent_room_id']) || null,
    polygon,
    center: pointFrom(raw['center']) ?? centerOf(bbox),
    area_m2: num(raw['area_m2'], areaNet),
    area_net_m2: areaNet,
    area_gross_m2: num(raw['area_gross_m2'], areaNet),
    dimensions: dimensionsFrom(raw['dimensions']),
    perimeter_m: num(raw['perimeter_m'], 0),
    bbox,
    neighbor_ids: strings(raw['neighbor_ids']),
    objects: resolve(objectIds, lookups.objects),
    doors: resolve(doorIds, lookups.doors),
    windows: resolve(windowIds, lookups.windows),
    object_ids: objectIds,
    door_ids: doorIds,
    window_ids: windowIds,
  };
}

function faceFrom(value: unknown, index: number): Face {
  const raw = asRecord(value) ?? {};
  return {
    id: text(raw['id']) || `face-${index + 1}`,
    boundary: polygonFrom(raw['boundary']),
    area_m2: num(raw['area_m2'], 0),
    predicted_class: text(raw['predicted_class']) || 'unknown',
    confidence: num(raw['confidence'], 0),
    decision_source: text(raw['decision_source']),
    accepted_as_room: raw['accepted_as_room'] === true,
    adjacent_unbounded: raw['adjacent_unbounded'] === true,
  };
}

function wallFrom(value: unknown, index: number): Wall {
  const raw = asRecord(value) ?? {};
  const polygon = polygonFrom(raw['polygon']);
  return {
    id: text(raw['id']) || `wall-${index + 1}`,
    start: pointFrom(raw['start']) ?? { x: 0, y: 0 },
    end: pointFrom(raw['end']) ?? { x: 0, y: 0 },
    polygon: polygon.vertices.length ? polygon : null,
  };
}

function openingFrom(value: unknown, fallbackId: string, fallbackKind: PortalKind): Opening {
  const raw = asRecord(value) ?? {};
  const kind = text(raw['kind']) as PortalKind;
  return {
    id: text(raw['id']) || fallbackId,
    kind: PORTAL_KINDS.includes(kind) ? kind : fallbackKind,
    start: pointFrom(raw['start']) ?? { x: 0, y: 0 },
    end: pointFrom(raw['end']) ?? { x: 0, y: 0 },
  };
}

function objectFrom(value: unknown, fallbackId: string): CadObject {
  const raw = asRecord(value) ?? {};
  const position = pointFrom(raw['center']) ?? pointFrom(raw['position']) ?? { x: 0, y: 0 };
  const rotation = raw['rotation_deg'];
  return {
    id: text(raw['id']) || fallbackId,
    category: text(raw['kind']) || text(raw['category']) || null,
    position,
    bounding_box: bboxFrom(raw['bbox']) ?? pointBox(position),
    block_name: text(raw['block_name']) || null,
    room_id: text(raw['room_id']) || null,
    rotation_deg: typeof rotation === 'number' && Number.isFinite(rotation) ? rotation : 0,
  };
}

function lightFrom(value: unknown, fallbackId: string): CadObject {
  const raw = asRecord(value) ?? {};
  const position = pointFrom(raw['position']) ?? { x: 0, y: 0 };
  return {
    id: text(raw['id']) || fallbackId,
    category: 'light',
    position,
    bounding_box: pointBox(position),
    block_name: null,
    room_id: text(raw['room_id']) || null,
  };
}

function textFrom(value: unknown, index: number): TextLabel {
  const raw = asRecord(value) ?? {};
  const bbox = bboxFrom(raw['bbox']);
  return {
    id: text(raw['id']) || `text-${index + 1}`,
    text: text(raw['content']) || text(raw['text']),
    position: pointFrom(raw['position']) ?? { x: 0, y: 0 },
    height_m: bbox ? Math.max(bbox.max_y - bbox.min_y, 0) : 0,
    room_id: text(raw['room_id']) || null,
  };
}

function dividerFrom(value: unknown, index: number): VirtualDivider {
  const raw = asRecord(value) ?? {};
  return {
    id: text(raw['id']) || `divider-${index + 1}`,
    start: pointFrom(raw['start']) ?? { x: 0, y: 0 },
    end: pointFrom(raw['end']) ?? { x: 0, y: 0 },
    active: raw['active'] !== false,
  };
}

function warningFrom(value: unknown): Warning {
  const raw = asRecord(value) ?? {};
  const severity = text(raw['severity']) as WarningSeverity;
  return {
    code: text(raw['code']),
    severity: SEVERITIES.includes(severity) ? severity : 'info',
    message: text(raw['message']),
    target_ids: strings(raw['target_ids']),
  };
}

function dimensionsFrom(value: unknown): RoomDimensions | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const length = raw['length_m'];
  const width = raw['width_m'];
  if (typeof length !== 'number' || typeof width !== 'number') {
    return null;
  }
  const orientation = raw['orientation_deg'];
  const method = raw['method'];
  const source = strings(raw['source']);
  return {
    length_m: length,
    width_m: width,
    orientation_deg: typeof orientation === 'number' && Number.isFinite(orientation) ? orientation : undefined,
    method: typeof method === 'string' ? method : undefined,
    source: source.length ? source : undefined,
  };
}

function polygonFrom(value: unknown): Polygon {
  if (Array.isArray(value)) {
    return { vertices: pointsFrom(value) };
  }
  const raw = asRecord(value);
  if (!raw) {
    return { vertices: [] };
  }
  const holes = Array.isArray(raw['holes'])
    ? (raw['holes'] as unknown[]).map(pointsFrom).filter((ring) => ring.length > 0)
    : undefined;
  return { vertices: pointsFrom(raw['vertices']), holes };
}

function pointsFrom(value: unknown): Point[] {
  return list(value)
    .map(pointFrom)
    .filter((point): point is Point => point !== null);
}

function pointFrom(value: unknown): Point | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const { x, y } = raw;
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}

function bboxFrom(value: unknown): BoundingBox | null {
  const raw = asRecord(value);
  if (!raw) {
    return null;
  }
  const keys = ['min_x', 'min_y', 'max_x', 'max_y'] as const;
  if (keys.some((key) => typeof raw[key] !== 'number')) {
    return null;
  }
  return {
    min_x: raw['min_x'] as number,
    min_y: raw['min_y'] as number,
    max_x: raw['max_x'] as number,
    max_y: raw['max_y'] as number,
  };
}

function pointBox(point: Point): BoundingBox {
  return { min_x: point.x, min_y: point.y, max_x: point.x, max_y: point.y };
}

function centerOf(bbox: BoundingBox | null): Point {
  if (!bbox) {
    return { x: 0, y: 0 };
  }
  return { x: (bbox.min_x + bbox.max_x) / 2, y: (bbox.min_y + bbox.max_y) / 2 };
}

function resolve<T>(ids: string[], lookup: Map<string, T>): T[] {
  return ids.map((id) => lookup.get(id)).filter((item): item is T => item !== undefined);
}

function asRecord(value: unknown): Raw | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Raw)
    : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strings(value: unknown): string[] {
  return list(value).filter((item): item is string => typeof item === 'string');
}
