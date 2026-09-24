/** Plan point in meters (`automate-api.md` §1). */
export interface AutomatePointDto {
  x: number;
  y: number;
}

/** Explicit grid-spacing range; all values `> 0`, `min ≤ max` (§1). */
export interface AutomateSpacingRangeDto {
  min: number;
  max: number;
  step: number;
}

/** Layout search space (§1). `null` ranges = server auto. */
export interface AutomateSearchDto {
  spacingX: AutomateSpacingRangeDto | null;
  spacingY: AutomateSpacingRangeDto | null;
  offsetFractions: number[];
  rotations: number[];
  maxFixtures: number;
  minWallClearance: number;
  shrMax: number;
}

/**
 * Body for `POST {LUXSCALE_BASE_URL}/automate` (§1).
 * Send `null` (or omit) for every "empty = default" field — never `0`/`""`.
 */
export interface AutomateRequestDto {
  /** Room footprint in meters, 3+ points. Closing vertex optional. */
  polygon: AutomatePointDto[];
  /** Ceiling plane height, meters. Must be `> 0` and `>= mountingHeight`. */
  ceilingHeight: number;
  /** Fixture hang height, meters. Must be `> 0` and `≤ ceilingHeight`. */
  mountingHeight: number;
  /** Standard id key, e.g. `"en12464_1_v2019_6_2_3"`. */
  activityId: string;
  /** Explicit variants, or `null`/`[]` for all main-solution variants. */
  variantIds?: string[] | null;
  workPlaneHeight?: number;
  floorZone?: number | null;
  wallZone?: number | null;
  wallReflectance?: number | null;
  floorReflectance?: number | null;
  ceilingReflectance?: number | null;
  maxOverdesign?: number | null;
  search?: AutomateSearchDto | null;
  topK?: number;
  stageB?: number;
}
