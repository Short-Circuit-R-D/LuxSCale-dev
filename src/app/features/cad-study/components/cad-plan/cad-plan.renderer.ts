import { bboxFromPoints, openingMark, pointInPolygon, roomPolygon, wallSegment } from '../../cad-geometry';
import { CadLayerVisibility, CadTool } from '../../cad-viewer.store';
import { BoundingBox } from '../../models/bounding-box.model';
import { CadObject } from '../../models/cad-object.model';
import { Face } from '../../models/face.model';
import { Layout } from '../../models/layout.model';
import { Point } from '../../models/point.model';
import { Polygon } from '../../models/polygon.model';
import { Room } from '../../models/room.model';
import { TextLabel } from '../../models/text-label.model';

const BG = '#0a0a0a';
const FIT_PAD_PX = 48;
const ROOM_FILL = 'rgba(108,182,255,0.18)';
const ROOM_FILL_ACTIVE = 'rgba(108,182,255,0.4)';
const ROOM_STROKE = '#6cb6ff';
const PHYSICAL_FILL = 'rgba(232,180,80,0.18)';
const PHYSICAL_FILL_ACTIVE = 'rgba(232,180,80,0.4)';
const PHYSICAL_STROKE = '#e8b450';
const FACE_FILL = 'rgba(255,255,255,0.05)';
const FACE_STROKE = '#8b9aab';
const WALL_STROKE = '#d7dee7';
const DOOR_STROKE = '#ff6b6b';
const WINDOW_STROKE = '#3ecfcf';
const DIVIDER_STROKE = '#c9a227';
const OBJECT_FILL = '#b388ff';
const TEXT_FILL = '#9ad07a';
const LABEL_FILL = '#e8eef4';

export interface CadCamera {
  scale: number;
  ox: number;
  oy: number;
}

interface PreparedLine {
  start: Point;
  end: Point;
}

interface PreparedRoom {
  id: string;
  label: string;
  polygon: Polygon;
  center: Point | null;
}

interface PreparedFace {
  id: string;
  polygon: Polygon;
  bbox: BoundingBox | null;
}

interface PreparedObject {
  position: Point;
}

interface PreparedText {
  text: string;
  position: Point;
}

export interface PreparedScene {
  rooms: PreparedRoom[];
  faces: PreparedFace[];
  walls: PreparedLine[];
  doors: PreparedLine[];
  windows: PreparedLine[];
  dividers: PreparedLine[];
  objects: PreparedObject[];
  texts: PreparedText[];
  physicalRooms: boolean;
}

export interface DrawCadSceneArgs {
  ctx: CanvasRenderingContext2D;
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  camera: CadCamera;
  scene: PreparedScene;
  selectedRoomIds: readonly string[];
  hoverFaceId: string | null;
  hoverRoomId: string | null;
  pendingStart: Point | null;
  previewEnd: Point | null;
}

export function worldToScreen(point: Point, camera: CadCamera): Point {
  return {
    x: point.x * camera.scale + camera.ox,
    y: -point.y * camera.scale + camera.oy,
  };
}

export function screenToWorld(sx: number, sy: number, camera: CadCamera): Point {
  return {
    x: (sx - camera.ox) / camera.scale,
    y: -(sy - camera.oy) / camera.scale,
  };
}

export function fitCamera(bounds: BoundingBox, cssWidth: number, cssHeight: number): CadCamera {
  const width = Math.max(1e-6, bounds.max_x - bounds.min_x);
  const height = Math.max(1e-6, bounds.max_y - bounds.min_y);
  const innerW = Math.max(1, cssWidth - FIT_PAD_PX * 2);
  const innerH = Math.max(1, cssHeight - FIT_PAD_PX * 2);
  const scale = Math.min(innerW / width, innerH / height);
  return {
    scale,
    ox: FIT_PAD_PX - bounds.min_x * scale + (innerW - width * scale) / 2,
    oy: FIT_PAD_PX + bounds.max_y * scale + (innerH - height * scale) / 2,
  };
}

export function panCamera(camera: CadCamera, dx: number, dy: number): CadCamera {
  return { ...camera, ox: camera.ox + dx, oy: camera.oy + dy };
}

export function zoomCamera(camera: CadCamera, sx: number, sy: number, factor: number): CadCamera {
  const before = screenToWorld(sx, sy, camera);
  const scale = camera.scale * factor;
  return {
    scale,
    ox: sx - before.x * scale,
    oy: sy + before.y * scale,
  };
}

export function recenterCamera(
  camera: CadCamera,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number,
): CadCamera {
  if (fromWidth <= 0 || fromHeight <= 0) {
    return camera;
  }
  const center = screenToWorld(fromWidth / 2, fromHeight / 2, camera);
  return {
    scale: camera.scale,
    ox: toWidth / 2 - center.x * camera.scale,
    oy: toHeight / 2 + center.y * camera.scale,
  };
}

export function prepareCadScene(args: {
  layout: Layout | null;
  faces: Face[];
  layers: CadLayerVisibility;
  physicalRoomsOnly: boolean;
  showAllFaces: boolean;
  tool: CadTool;
}): PreparedScene | null {
  const { layout } = args;
  if (!layout) {
    return null;
  }

  const rooms = visibleRooms(layout, args);
  const roomIds = new Set(rooms.map((room) => room.id));
  const faces = visibleFaces(args.faces, args.showAllFaces, args.layers, args.tool).filter(
    (face) => !roomIds.has(face.id),
  );

  return {
    rooms: rooms.map(prepareRoom),
    faces: faces.map(prepareFace),
    walls: args.layers.walls ? wallItems(layout) : [],
    doors: args.layers.doors ? openingItems(layout.doors) : [],
    windows: args.layers.windows ? openingItems(layout.windows) : [],
    dividers: args.layers.virtualDividers ? dividerItems(layout) : [],
    objects: args.layers.objects ? objectItems(layout) : [],
    texts: args.layers.texts ? textItems(layout.texts) : [],
    physicalRooms: args.physicalRoomsOnly,
  };
}

export function hitTestRooms(scene: PreparedScene, world: Point): string | null {
  for (let i = scene.rooms.length - 1; i >= 0; i--) {
    const room = scene.rooms[i];
    if (pointInPolygon(world, room.polygon)) {
      return room.id;
    }
  }
  return null;
}

export function hitTestFaces(scene: PreparedScene, world: Point): string | null {
  for (let i = scene.faces.length - 1; i >= 0; i--) {
    const face = scene.faces[i];
    if (pointInPolygon(world, face.polygon)) {
      return face.id;
    }
  }
  return null;
}

export function drawCadScene(args: DrawCadSceneArgs): void {
  const { ctx, cssWidth, cssHeight, dpr, camera, scene } = args;
  if (cssWidth <= 0 || cssHeight <= 0 || camera.scale <= 0) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  drawFaces(ctx, args);
  drawRooms(ctx, args);
  drawSegments(ctx, scene.walls, camera, WALL_STROKE, 1.6);
  drawSegments(ctx, scene.doors, camera, DOOR_STROKE, 3.5);
  drawSegments(ctx, scene.windows, camera, WINDOW_STROKE, 2.6);
  drawSegments(ctx, scene.dividers, camera, DIVIDER_STROKE, 1.8);
  drawPreview(ctx, args);
  drawObjects(ctx, scene.objects, camera);
  drawTexts(ctx, scene.texts, camera);
  drawLabels(ctx, args);
}

function visibleRooms(
  layout: Layout,
  args: { physicalRoomsOnly: boolean; layers: CadLayerVisibility },
): Room[] {
  if (!args.layers.rooms) {
    return [];
  }
  const rooms = args.physicalRoomsOnly ? layout.physical_rooms : layout.rooms;
  return (rooms ?? []).filter((room) => room.selectable !== false);
}

function visibleFaces(
  faces: Face[],
  showAllFaces: boolean,
  layers: CadLayerVisibility,
  tool: CadTool,
): Face[] {
  if (showAllFaces) {
    return faces;
  }
  if (tool === 'restore' || layers.discardedFaces) {
    return faces.filter((face) => !face.accepted_as_room);
  }
  return [];
}

function prepareRoom(room: Room): PreparedRoom {
  return {
    id: room.id,
    label: room.name || room.kind || room.id.slice(0, 8),
    polygon: roomPolygon(room),
    center: room.center ?? null,
  };
}

function prepareFace(face: Face): PreparedFace {
  const polygon = face.boundary ?? { vertices: [] };
  return {
    id: face.id,
    polygon,
    bbox: bboxFromPoints(polygon.vertices ?? []),
  };
}

function wallItems(layout: Layout): PreparedLine[] {
  const items: PreparedLine[] = [];
  for (const wall of layout.walls ?? []) {
    const line = wallSegment(wall);
    if (line) {
      items.push(line);
    }
  }
  return items;
}

function openingItems(openings: Layout['doors']): PreparedLine[] {
  const items: PreparedLine[] = [];
  for (const opening of openings ?? []) {
    const mark = openingMark(opening);
    if (mark) {
      items.push(mark);
    }
  }
  return items;
}

function dividerItems(layout: Layout): PreparedLine[] {
  const items: PreparedLine[] = [];
  for (const divider of layout.virtual_dividers ?? []) {
    if (divider.active === false) {
      continue;
    }
    items.push({ start: divider.start, end: divider.end });
  }
  return items;
}

function objectItems(layout: Layout): PreparedObject[] {
  const objects = [...(layout.objects ?? []), ...(layout.unassigned_objects ?? [])];
  return objects
    .filter((object: CadObject) => object.position)
    .map((object) => ({ position: object.position }));
}

function textItems(labels: TextLabel[]): PreparedText[] {
  return (labels ?? [])
    .filter((label) => label.position)
    .map((label) => ({ text: label.text, position: label.position }));
}

function drawFaces(ctx: CanvasRenderingContext2D, args: DrawCadSceneArgs): void {
  for (const face of args.scene.faces) {
    if (!isOnCanvas(face.bbox, args.camera, args.cssWidth, args.cssHeight)) {
      continue;
    }
    const active = args.hoverFaceId === face.id;
    fillPolygon(
      ctx,
      face.polygon,
      args.camera,
      active ? 'rgba(255,255,255,0.12)' : FACE_FILL,
      FACE_STROKE,
      [4, 3],
    );
  }
}

function drawRooms(ctx: CanvasRenderingContext2D, args: DrawCadSceneArgs): void {
  const physical = args.scene.physicalRooms;
  for (const room of args.scene.rooms) {
    const active = args.selectedRoomIds.includes(room.id) || args.hoverRoomId === room.id;
    const fill = physical
      ? active
        ? PHYSICAL_FILL_ACTIVE
        : PHYSICAL_FILL
      : active
        ? ROOM_FILL_ACTIVE
        : ROOM_FILL;
    fillPolygon(ctx, room.polygon, args.camera, fill, physical ? PHYSICAL_STROKE : ROOM_STROKE);
  }
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  lines: PreparedLine[],
  camera: CadCamera,
  color: string,
  width: number,
): void {
  if (lines.length === 0) {
    return;
  }
  ctx.beginPath();
  for (const line of lines) {
    const start = worldToScreen(line.start, camera);
    const end = worldToScreen(line.end, camera);
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawPreview(ctx: CanvasRenderingContext2D, args: DrawCadSceneArgs): void {
  const start = args.pendingStart;
  const preview = args.previewEnd;
  if (!start || !preview) {
    return;
  }
  const a = worldToScreen(start, args.camera);
  const b = worldToScreen(preview, args.camera);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = DIVIDER_STROKE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawObjects(ctx: CanvasRenderingContext2D, objects: PreparedObject[], camera: CadCamera): void {
  if (objects.length === 0) {
    return;
  }
  ctx.fillStyle = OBJECT_FILL;
  for (const object of objects) {
    const point = worldToScreen(object.position, camera);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTexts(ctx: CanvasRenderingContext2D, texts: PreparedText[], camera: CadCamera): void {
  if (texts.length === 0) {
    return;
  }
  ctx.fillStyle = TEXT_FILL;
  ctx.font = '11px ui-sans-serif, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const label of texts) {
    const point = worldToScreen(label.position, camera);
    ctx.fillText(label.text, point.x, point.y);
  }
}

function drawLabels(ctx: CanvasRenderingContext2D, args: DrawCadSceneArgs): void {
  ctx.fillStyle = LABEL_FILL;
  ctx.font = '12px ui-sans-serif, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of args.scene.rooms) {
    if (!room.center) {
      continue;
    }
    const point = worldToScreen(room.center, args.camera);
    ctx.fillText(room.label, point.x, point.y);
  }
}

function isOnCanvas(
  bbox: BoundingBox | null,
  camera: CadCamera,
  cssWidth: number,
  cssHeight: number,
): boolean {
  if (!bbox) {
    return true;
  }
  const corners = [
    worldToScreen({ x: bbox.min_x, y: bbox.min_y }, camera),
    worldToScreen({ x: bbox.max_x, y: bbox.min_y }, camera),
    worldToScreen({ x: bbox.min_x, y: bbox.max_y }, camera),
    worldToScreen({ x: bbox.max_x, y: bbox.max_y }, camera),
  ];
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  return !(maxX < 0 || minX > cssWidth || maxY < 0 || minY > cssHeight);
}

function fillPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Polygon,
  camera: CadCamera,
  fill: string,
  stroke: string,
  dash?: number[],
): void {
  const rings = [polygon.vertices ?? [], ...(polygon.holes ?? [])];
  let started = false;
  ctx.beginPath();
  for (const ring of rings) {
    if (ring.length < 3) {
      continue;
    }
    const first = worldToScreen(ring[0], camera);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < ring.length; i++) {
      const point = worldToScreen(ring[i], camera);
      ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    started = true;
  }
  if (!started) {
    return;
  }
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.setLineDash(dash ?? []);
  ctx.stroke();
  ctx.setLineDash([]);
}
