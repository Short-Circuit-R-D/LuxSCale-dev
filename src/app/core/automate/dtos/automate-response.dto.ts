import type { FixtureApplicationDto } from '../../common/dtos/common.dto';

/** Resolved target actually used (§2). */
export interface AutomateTargetDto {
  avgLux: number;
  uniformity: number;
  maxOverdesign: number;
}

/** Layouts discarded before physics + reason (§2). */
export interface AutomatePrunedDto {
  shr: number;
  clearance: number;
  outside: number;
  count: number;
  lumen: number;
}

/** Fixture placement in world frame: X/Y plan meters, Z = mounting height (§2). */
export interface AutomatePlacementDto {
  id: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  tiltAngle: number;
}

export interface AutomateVec3Dto {
  x: number;
  y: number;
  z: number;
}

/** Engine-resolved geometry for drawing (§2). Top view = ignore z. */
export interface AutomateFixtureGeometryDto {
  id: string;
  position: AutomateVec3Dto;
  rotation: number;
  tiltAngle: number;
  length: number;
  width: number;
  height: number;
  corners: [AutomateVec3Dto, AutomateVec3Dto, AutomateVec3Dto, AutomateVec3Dto];
  elements: AutomateVec3Dto[];
}

/** Winning layout hint (§2). */
export interface AutomateGridHintDto {
  spacingX: number;
  spacingY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export type AutomateMissReasonDto = 'under_target' | 'over_cap' | 'uniformity';

/** Maintained total floor lux, 1:1 with `floorPatches` (§2, §4). */
export interface AutomateTotalFloorDto {
  values: number[];
  metadata: Record<string, unknown>;
}

/** One designed layout (§2). */
export interface AutomateSolutionDto {
  variantId: string;
  fixtureCount: number;
  placements: AutomatePlacementDto[];
  fixtures: AutomateFixtureGeometryDto[];
  grid: AutomateGridHintDto;
  average: number;
  minimum: number;
  maximum: number;
  uniformity: number;
  /** `average / target − 1` (0.719 = +71.9%). */
  overdesign: number;
  powerW: number | null;
  powerDensity: number | null;
  /** First failing check; `null` on recommended solutions. */
  missReason: AutomateMissReasonDto | null;
  /** `false` = over the overdesign cap: shown for reference, not a passing design. */
  recommended: boolean;
  /** `null` on the closest miss. */
  totalFloor: AutomateTotalFloorDto | null;
}

/** Shared EN 12464 floor grid cell (§4). Draw one rect per patch at `center` with `size`. */
export interface AutomateFloorPatchDto {
  center: AutomatePointLikeDto;
  size: number;
  [key: string]: unknown;
}

export interface AutomatePointLikeDto {
  x: number;
  y: number;
  [key: string]: unknown;
}

/** Floor grid shape (§2). */
export interface AutomateFloorMetaDto {
  spacing: number;
  nx: number;
  ny: number;
  dx?: number;
  dy?: number;
  border: number;
  workPlaneHeight: number;
  [key: string]: unknown;
}

export interface AutomateSpacingAppliedDto {
  min: number;
  max: number;
  step: number;
}

/** `200` response for `POST /automate` (§2). */
export interface AutomateResponseDto {
  target: AutomateTargetDto;
  application: FixtureApplicationDto;
  solutions: AutomateSolutionDto[];
  evaluatedA: number;
  evaluatedB: number;
  pruned: AutomatePrunedDto;
  closestMiss: AutomateSolutionDto | null;
  appliedSpacingX: AutomateSpacingAppliedDto;
  appliedSpacingY: AutomateSpacingAppliedDto;
  floorPatches: AutomateFloorPatchDto[];
  floorMeta: AutomateFloorMetaDto;
}
