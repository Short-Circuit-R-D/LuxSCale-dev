import type { PageParamsDto, StandardsMatchModeDto } from '../../common/dtos/common.dto';

/** `StandardMetadataDTO` — all required (§3.8). */
export interface StandardMetadataDto {
  standard_code: string;
  version_year: string;
  is_latest: boolean;
}

/** `StandardHierarchyDTO` — all required (§3.8). */
export interface StandardHierarchyDto {
  category_table_number: string;
  category_title: string;
  ref_number: string;
  page: number;
}

/**
 * `StandardParametersDTO` — all optional/nullable, numbers `>= 0`
 * (`uo` also `<= 1`, `ra` also `<= 100`). Decimals arrive as strings (§1.4).
 */
export interface StandardParametersDto {
  em_r_lx?: number | null;
  em_u_lx?: number | null;
  uo?: number | null;
  ra?: number | null;
  ugr_rugl?: number | null;
  ez_lx?: number | null;
  em_wall_lx?: number | null;
  em_ceiling_lx?: number | null;
}

/** Body for `POST /standards/` (§3.1, §3.8). `id` alias is also accepted for `_id`. */
export interface CreateStandardRequestDto {
  _id: string;
  id?: string;
  standard_metadata: StandardMetadataDto;
  hierarchy: StandardHierarchyDto;
  activity: string;
  parameters: StandardParametersDto;
  specific_requirements?: string | null;
  searchable_text: string;
}

/** Body for `POST /standards/bulk` (§3.2). */
export interface CreateManyStandardsRequestDto {
  items: CreateStandardRequestDto[];
}

/** Immediate `202` payload for bulk ingest (§3.2). */
export interface CreateManyStandardsAcceptedResponseDto {
  status: 'accepted';
  item_count: number;
}

/** Body for `PATCH /standards/{standard_id}` (§3.6, §3.8). Identity fields are immutable. */
export interface UpdateStandardRequestDto {
  standard_metadata?: { is_latest?: boolean };
  hierarchy?: { category_title?: string; page?: number };
  activity?: string;
  /** When sent, replaces the whole parameters object. */
  parameters?: StandardParametersDto;
  specific_requirements?: string | null;
  searchable_text?: string;
}

/** Stored standard shape (§3.8). */
export interface StandardResponseDto {
  id: string;
  qdrant_point_id: string;
  standard_metadata: StandardMetadataDto;
  hierarchy: StandardHierarchyDto;
  activity: string;
  parameters: StandardParametersDto;
  specific_requirements: string | null;
  searchable_text: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

/** Distinct-category row for `GET /standards/categories` (§3.4, §3.8). */
export interface StandardCategoryResponseDto {
  standard_metadata: StandardMetadataDto;
  category_table_number: string;
  category_title: string;
}

/** Query params for `GET /standards/` (§3.3). */
export interface ListStandardsParamsDto extends PageParamsDto {
  standard_code?: string;
  version_year?: string;
  is_latest?: boolean;
  category_table_number?: string;
  /** Partial, case-insensitive match on `activity`. */
  activity?: string;
  /** Repeat param; partial, case-insensitive matches against searchable text. */
  keywords?: string[];
  /** Default `"any"`; `"all"` = every keyword must match. */
  match_mode?: StandardsMatchModeDto;
}

/** Query params for `GET /standards/categories` (§3.4). */
export interface ListStandardCategoriesParamsDto {
  standard_code?: string;
  version_year?: string;
  is_latest?: boolean;
}
