export interface Point2D {
  x: number;
  y: number;
}

export interface Vec3Dto {
  x: number;
  y: number;
  z: number;
}

export interface CountGridDto {
  countX: number;
  countY: number;
  offsetFraction?: number;
}

export interface SpacingGridDto {
  spacingX: number;
  spacingY: number;
  autoCenter?: boolean;
  offsetX?: number | null;
  offsetY?: number | null;
}

export interface AxisStepDto {
  spacing: number;
  offsetBeginning: number;
  offsetEnding: number;
}

export interface AxisGridDto {
  x: AxisStepDto;
  y: AxisStepDto;
}

export interface GridPlacementDto {
  count?: CountGridDto;
  spacing?: SpacingGridDto;
  x?: AxisStepDto;
  y?: AxisStepDto;
}

export interface FreeFixtureDto {
  id?: string | null;
  x: number;
  y: number;
  z?: number | null;
  rotation?: number | null;
  tiltAngle?: number | null;
  aimDirection?: Vec3Dto | null;
  variantId?: string | null;
  iesRef?: string | null;
}

export interface ComplianceTargetDto {
  activityId?: string;
  targetLux?: number;
  targetUniformity?: number;
  maxOverdesign?: number;
}

export interface CalculateRequest {
  polygon: Point2D[];
  ceilingHeight: number;
  mountingHeight: number;
  workPlaneHeight?: number;
  floorZone?: number | null;
  wallZone?: number | null;
  luminaireRotation?: number;
  wallReflectance?: number | null;
  floorReflectance?: number | null;
  ceilingReflectance?: number | null;
  maintenanceFactor?: number | null;
  bounces?: number | null;
  includeWallCeilingMatrices?: boolean;
  grid?: GridPlacementDto;
  fixtures?: FreeFixtureDto[];
  variantId?: string | null;
  variantIds?: string[] | null;
  compliance?: ComplianceTargetDto | null;
}
