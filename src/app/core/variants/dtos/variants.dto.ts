import type { AssetResponseDto } from '../../assets/dtos/assets.dto';
import type { ElectricalProtectionDto, FixtureApplicationDto, PageParamsDto } from '../../common/dtos/common.dto';
import type { FixtureSummaryResponseDto } from '../../fixtures/dtos/fixtures.dto';

/** Body for `POST /fixtures/{fixture_id}/variants/` (§5.3, §5.7). */
export interface CreateVariantRequestDto {
  name: string;
  power: number;
  chip: string;
  driver: string;
  /** Decimal `0–1`; send `"0.95"` or `0.95`. */
  power_factor: string | number;
  /** Decimal `>= 0`. */
  cri: string | number;
  efficacy: number;
  mechanical_protections?: string[];
  electrical_protections?: ElectricalProtectionDto[];
  dimension_length?: string | number | null;
  dimension_width?: string | number | null;
  dimension_depth?: string | number | null;
  dimension_radius?: string | number | null;
  model_3d_file_id?: string | null;
  /** Asset id of the IES file. */
  ies_file_id: string;
}

/**
 * Body for `PATCH /fixtures/{fixture_id}/variants/{variant_id}` (§5.5, §5.7).
 * All fields optional **except `ies_file_id`, which stays required** (§1.6):
 * every variant PATCH must include the current (or a new) `ies_file_id`.
 */
export interface UpdateVariantRequestDto {
  name?: string;
  power?: number;
  chip?: string;
  driver?: string;
  power_factor?: string | number;
  cri?: string | number;
  efficacy?: number;
  mechanical_protections?: string[] | null;
  electrical_protections?: ElectricalProtectionDto[] | null;
  dimension_length?: string | number | null;
  dimension_width?: string | number | null;
  dimension_depth?: string | number | null;
  dimension_radius?: string | number | null;
  model_3d_file_id?: string | null;
  ies_file_id: string;
}

/** Stored variant with nested files and images (§5.7). Decimals arrive as strings. */
export interface VariantResponseDto {
  id: string;
  fixture_id: string;
  name: string;
  chip: string;
  driver: string;
  power: number;
  efficacy: number;
  power_factor: string;
  cri: string;
  mechanical_protections: string[];
  electrical_protections: string[];
  dimension_length: string | null;
  dimension_width: string | null;
  dimension_depth: string | null;
  dimension_radius: string | null;
  model_3d_file_id: string | null;
  model_3d_file: AssetResponseDto | null;
  ies_file_id: string;
  ies_file: AssetResponseDto;
  images: VariantImageResponseDto[];
  created_at: string;
  updated_at: string;
}

/** `GET /fixtures/{fixture_id}/variants/{variant_id}` payload (§5.4, §5.7). */
export interface VariantDetailResponseDto extends VariantResponseDto {
  fixture: FixtureSummaryResponseDto;
}

/** Body for `POST /…/images/` (§6.1). */
export interface CreateVariantImageRequestDto {
  /** Must be an existing asset id. */
  image_file_id: string;
}

/** Variant-image record (§6.3). `id` is the record id used for DELETE. */
export interface VariantImageResponseDto {
  id: string;
  variant_id: string;
  image_file_id: string;
  image_file: AssetResponseDto;
}

/** Query params shared by both variant list endpoints (§5.1, §5.2). */
export interface ListVariantsParamsDto extends PageParamsDto {
  /** Partial, case-insensitive match on variant `name` only. */
  q?: string;
  /** Filters by the parent fixture's applications. */
  application?: FixtureApplicationDto;
  /** Filters by the parent fixture's flag. */
  is_main_solution?: boolean;
}

/** Extra query for `GET /fixtures/variants/` (§5.1). Unknown id → `404`. */
export interface ListAllVariantsParamsDto extends ListVariantsParamsDto {
  /** Restrict to one fixture. */
  fixture_id?: string;
}
