import { BoundingBox } from './models/bounding-box.model';
import { CadObject } from './models/cad-object.model';
import { Layout } from './models/layout.model';
import { Opening } from './models/opening.model';
import { PhysicalRoom } from './models/physical-room.model';
import { Point } from './models/point.model';
import { Polygon } from './models/polygon.model';
import { Room } from './models/room.model';
import { Segment } from './models/segment.model';
import { VirtualDivider } from './models/virtual-divider.model';
import { Wall } from './models/wall.model';

export const VERTEX_SNAP_M = 0.25;

export function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function roomPolygon(room: Pick<Room, 'polygon' | 'boundary'>): Polygon {
  if (room.polygon?.vertices?.length) {
    return {
      vertices: room.polygon.vertices,
      holes: room.polygon.holes ?? room.boundary?.holes,
    };
  }
  return room.boundary ?? { vertices: [] };
}

export function wallSegment(wall: Wall): Segment | null {
  const start = wall.start ?? wall.centerline?.start;
  const end = wall.end ?? wall.centerline?.end;
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

export function bboxFromPoints(points: Point[]): BoundingBox | null {
  if (points.length === 0) {
    return null;
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { min_x: minX, min_y: minY, max_x: maxX, max_y: maxY };
}

export function expandBbox(target: BoundingBox, extra: BoundingBox): BoundingBox {
  return {
    min_x: Math.min(target.min_x, extra.min_x),
    min_y: Math.min(target.min_y, extra.min_y),
    max_x: Math.max(target.max_x, extra.max_x),
    max_y: Math.max(target.max_y, extra.max_y),
  };
}

export function padBbox(bbox: BoundingBox, fraction = 0.05): BoundingBox {
  const width = Math.max(bbox.max_x - bbox.min_x, 1e-6);
  const height = Math.max(bbox.max_y - bbox.min_y, 1e-6);
  const padX = width * fraction;
  const padY = height * fraction;
  return {
    min_x: bbox.min_x - padX,
    min_y: bbox.min_y - padY,
    max_x: bbox.max_x + padX,
    max_y: bbox.max_y + padY,
  };
}

export function layoutBounds(layout: Layout): BoundingBox | null {
  const wallPoints: Point[] = [];
  for (const wall of layout.walls ?? []) {
    const segment = wallSegment(wall);
    if (segment) {
      wallPoints.push(segment.start, segment.end);
    }
    if (wall.polygon?.vertices?.length) {
      wallPoints.push(...wall.polygon.vertices);
    }
  }
  const fromWalls = bboxFromPoints(wallPoints);
  if (fromWalls) {
    return fromWalls;
  }

  let bounds: BoundingBox | null = null;
  const include = (bbox: BoundingBox | null) => {
    if (!bbox) {
      return;
    }
    bounds = bounds ? expandBbox(bounds, bbox) : bbox;
  };
  for (const room of layout.rooms ?? []) {
    include(room.bbox ?? bboxFromPoints(roomPolygon(room).vertices));
  }
  return bounds;
}

export function largestRoom(layout: Layout): Room | null {
  if (!layout.rooms.length) {
    return null;
  }
  return layout.rooms.reduce((best, room) => (netArea(room) > netArea(best) ? room : best));
}

export function collectRoomVertices(layout: Layout): Point[] {
  const vertices: Point[] = [];
  for (const room of layout.rooms) {
    vertices.push(...roomPolygon(room).vertices);
  }
  return vertices;
}

export function snapToVertices(point: Point, vertices: Point[], radiusM = VERTEX_SNAP_M): Point {
  let nearest: Point | null = null;
  let nearestDist = radiusM;
  for (const vertex of vertices) {
    const dist = distance(point, vertex);
    if (dist <= nearestDist) {
      nearest = vertex;
      nearestDist = dist;
    }
  }
  return nearest ?? point;
}

export function mapY(y: number, worldMaxY: number): number {
  return worldMaxY - y;
}

export function unmapY(svgY: number, worldMaxY: number): number {
  return worldMaxY - svgY;
}

export function mappedPolygonPath(polygon: Polygon | null | undefined, worldMaxY: number): string {
  const vertices = polygon?.vertices ?? [];
  if (vertices.length === 0) {
    return '';
  }
  const rings = [vertices, ...(polygon?.holes ?? [])];
  return rings
    .filter((ring) => ring.length > 0)
    .map((ring) => {
      const [first, ...rest] = ring;
      const head = `M ${first.x} ${mapY(first.y, worldMaxY)}`;
      const lines = rest.map((point) => `L ${point.x} ${mapY(point.y, worldMaxY)}`).join(' ');
      return `${head} ${lines} Z`;
    })
    .join(' ');
}

export function netArea(room: Pick<Room, 'area_net_m2' | 'area_m2'>): number {
  return room.area_net_m2 ?? room.area_m2 ?? 0;
}

export function isApproximateFootprint(room: Pick<Room, 'dimensions' | 'area_net_m2' | 'area_m2'>): boolean {
  const dimensions = room.dimensions;
  if (!dimensions) {
    return false;
  }
  if (dimensions.method === 'min_rotated_rectangle') {
    return true;
  }
  const area = netArea(room);
  if (area <= 0) {
    return true;
  }
  const product = dimensions.length_m * dimensions.width_m;
  return Math.abs(product - area) / area > 0.2;
}

export function hasParsedDimensions(room: Pick<Room, 'dimensions'>): boolean {
  return !!room.dimensions?.source?.some((item) => item === 'parsed_dimension');
}

export function shouldFitLargest(layout: Layout): boolean {
  const union = layoutBounds(layout);
  const room = largestRoom(layout);
  if (!union || !room) {
    return false;
  }
  const bbox = room.bbox ?? bboxFromPoints(roomPolygon(room).vertices);
  if (!bbox) {
    return false;
  }
  const unionSpan = Math.max(union.max_x - union.min_x, union.max_y - union.min_y);
  const roomSpan = Math.max(bbox.max_x - bbox.min_x, bbox.max_y - bbox.min_y);
  return unionSpan > 0 && roomSpan / unionSpan < 0.45;
}

export function hashIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : hash % modulo;
}

export function dividerPayload(dividers: Array<{ start: Point; end: Point }>): Segment[] {
  return dividers.map((divider) => ({
    start: { x: divider.start.x, y: divider.start.y },
    end: { x: divider.end.x, y: divider.end.y },
  }));
}

export function normalizeLayout(raw: Layout): Layout {
  const rooms = (raw.rooms ?? []).map((room, index) => normalizeRoom(room, index));
  return {
    unit: 'm',
    meta: {
      source_file: raw.meta?.source_file ?? '',
      source_unit: raw.meta?.source_unit ?? 'm',
      to_meters_factor: raw.meta?.to_meters_factor ?? 1,
      unit_assumed: !!raw.meta?.unit_assumed,
      room_count: raw.meta?.room_count ?? rooms.length,
      wall_count: raw.meta?.wall_count ?? (raw.walls ?? []).length,
      object_count: raw.meta?.object_count ?? (raw.objects ?? []).length,
    },
    walls: (raw.walls ?? []).map((wall, index) => normalizeWall(wall, index)),
    rooms,
    physical_rooms: (raw.physical_rooms ?? []).map((room, index) => normalizePhysicalRoom(room, index)),
    virtual_dividers: (raw.virtual_dividers ?? []).map((divider, index) => normalizeDivider(divider, index)),
    objects: (raw.objects ?? []).map((object, index) => normalizeObject(object, index)),
    unassigned_objects: (raw.unassigned_objects ?? []).map((object, index) =>
      normalizeObject(object, `unassigned-${index}`),
    ),
    doors: raw.doors ?? [],
    windows: raw.windows ?? [],
    lights: (raw.lights ?? []).map((object, index) => normalizeObject(object, `light-${index}`)),
    texts: raw.texts ?? [],
    warnings: raw.warnings ?? [],
  };
}

function normalizeRoom(room: Room, index: number): Room {
  const polygon = roomPolygon(room);
  const vertices = polygon.vertices;
  const bbox = room.bbox ?? bboxFromPoints(vertices);
  const center = room.center ?? {
    x: bbox ? (bbox.min_x + bbox.max_x) / 2 : 0,
    y: bbox ? (bbox.min_y + bbox.max_y) / 2 : 0,
  };
  const id = room.id || `room-${index + 1}`;
  return {
    ...room,
    id,
    name: room.name ?? null,
    kind: room.kind === 'virtual' ? 'virtual' : 'physical',
    selectable: room.selectable !== false,
    physical_room_id: room.physical_room_id || id,
    parent_room_id: room.parent_room_id ?? null,
    polygon,
    boundary: room.boundary?.vertices?.length ? room.boundary : polygon,
    center,
    area_m2: netArea(room),
    area_net_m2: netArea(room),
    area_gross_m2: room.area_gross_m2 ?? netArea(room),
    dimensions: room.dimensions ?? null,
    perimeter_m: room.perimeter_m ?? 0,
    bbox,
    neighbor_ids: room.neighbor_ids ?? [],
    is_from_virtual_divider: !!room.is_from_virtual_divider || room.kind === 'virtual',
    objects: (room.objects ?? []).map((object, objectIndex) =>
      normalizeObject(object, `${id}-obj-${objectIndex}`),
    ),
    doors: room.doors ?? [],
    windows: room.windows ?? [],
    fixture_count: room.fixture_count ?? (room.objects ?? []).length,
    door_count: room.door_count ?? (room.doors ?? []).length,
    window_count: room.window_count ?? (room.windows ?? []).length,
    wall_length_m: room.wall_length_m ?? 0,
    object_ids: room.object_ids ?? [],
    door_ids: room.door_ids ?? [],
    window_ids: room.window_ids ?? [],
  };
}

function normalizePhysicalRoom(room: PhysicalRoom, index: number): PhysicalRoom {
  return {
    id: room.id || `physical-${index + 1}`,
    name: room.name ?? null,
    polygon: room.polygon ?? { vertices: [] },
    area_m2: room.area_m2 ?? 0,
    kind: 'physical',
  };
}

function normalizeWall(wall: Wall, index: number): Wall {
  const segment = wallSegment(wall) ?? {
    start: { x: 0, y: 0 },
    end: { x: 0, y: 0 },
  };
  return {
    id: wall.id || `wall-${index + 1}`,
    start: segment.start,
    end: segment.end,
    centerline: wall.centerline ?? segment,
    thickness_m: wall.thickness_m ?? 0,
    polygon: wall.polygon ?? null,
  };
}

function normalizeDivider(divider: VirtualDivider, index: number): VirtualDivider {
  return {
    id: divider.id || `divider-${index + 1}`,
    start: divider.start,
    end: divider.end,
    created_by: divider.created_by ?? 'user',
    active: divider.active !== false,
  };
}

function normalizeObject(object: CadObject, fallbackId: string | number): CadObject {
  return {
    id: object.id || `object-${fallbackId}`,
    category: object.category ?? null,
    position: object.position ?? { x: 0, y: 0 },
    rotation_deg: object.rotation_deg ?? 0,
    bounding_box: object.bounding_box ?? {
      min_x: object.position?.x ?? 0,
      min_y: object.position?.y ?? 0,
      max_x: object.position?.x ?? 0,
      max_y: object.position?.y ?? 0,
    },
    block_name: object.block_name ?? null,
    room_id: object.room_id ?? null,
  };
}

export function openingMark(opening: Opening): Segment | null {
  if (opening.portal?.start && opening.portal?.end) {
    return { start: opening.portal.start, end: opening.portal.end };
  }
  if (!opening.position) {
    return null;
  }
  const half = Math.max(opening.width_m || 0.4, 0.2) / 2;
  return {
    start: { x: opening.position.x - half, y: opening.position.y },
    end: { x: opening.position.x + half, y: opening.position.y },
  };
}
