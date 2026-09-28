import type { Vec3Dto } from './calculate-request.dto';

export interface FixtureDto {
  id: string;
  position: Vec3Dto;
  aimDirection: Vec3Dto;
  rotation: number;
  length: number;
  width: number;
  height: number;
  corners: Vec3Dto[];
  elements: Vec3Dto[];
  variantId?: string | null;
  iesRef?: string | null;
}

export interface PatchDto {
  id: string;
  center: Vec3Dto;
  normal: Vec3Dto;
  size: number;
  area: number;
}

export interface MatrixDto {
  values: number[];
  metadata: Record<string, unknown>;
}

export interface EvaluationDto {
  average: number;
  minimum: number;
  maximum: number;
  uniformity: number;
  minPoint: Vec3Dto;
  maxPoint: Vec3Dto;
  nx: number;
  ny: number;
  spacingX: number;
  spacingY: number;
}

export interface ComplianceResultDto {
  compliant: boolean;
  targetLux: number;
  targetUniformity: number;
  luxGap: number;
  uniformityGap: number;
  overdesign: number;
}

export interface VariantResultDto {
  variantId: string;
  evaluation: EvaluationDto;
  compliance: ComplianceResultDto | null;
  powerW: number | null;
  powerDensity: number | null;
  totalFloorIlluminance: MatrixDto;
  fixtures: FixtureDto[];
  directFloorMatrices?: Record<string, MatrixDto>;
  indirectFloorMatrices?: Record<string, MatrixDto>;
}

export interface CalculateResponse {
  fixtures: FixtureDto[];
  floorPatches: PatchDto[];
  wallPatches: Record<string, PatchDto[]>;
  ceilingPatches: PatchDto[];
  totalFloorIlluminance: MatrixDto;
  directFloorMatrices: Record<string, MatrixDto>;
  indirectFloorMatrices: Record<string, MatrixDto>;
  totalWallIlluminance: Record<string, MatrixDto>;
  directWallMatrices: Record<string, Record<string, MatrixDto>>;
  indirectWallMatrices: Record<string, Record<string, MatrixDto>>;
  totalCeilingIlluminance: MatrixDto | null;
  directCeilingMatrices: Record<string, MatrixDto>;
  indirectCeilingMatrices: Record<string, MatrixDto>;
  evaluation: EvaluationDto;
  wallEvaluations: Record<string, EvaluationDto>;
  ceilingEvaluation: EvaluationDto | null;
  compliance: ComplianceResultDto | null;
  powerW?: number | null;
  powerDensity?: number | null;
  results?: VariantResultDto[];
  bounces: number;
  wallReflectance: number;
  floorReflectance: number;
  ceilingReflectance: number;
  ceilingHeight: number;
  mountingHeight: number;
}

export interface CalculateErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; issue: string }>;
    requestId?: string;
  };
}
