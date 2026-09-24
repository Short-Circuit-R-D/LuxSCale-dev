import type { FixtureApplicationDto, PageParamsDto } from '../../common/dtos/common.dto';
import type { VariantResponseDto } from '../../variants/dtos/variants.dto';

/** Body for `POST /fixtures/` (§4.1, §4.6). */
export interface CreateFixtureRequestDto {
  manufacturer_name: string;
  name: string;
  is_main_solution?: boolean;
  applications: FixtureApplicationDto[];
}

/** Body for `PATCH /fixtures/{fixture_id}` (§4.4, §4.6). All fields optional. */
export interface UpdateFixtureRequestDto {
  manufacturer_name?: string;
  name?: string;
  is_main_solution?: boolean | null;
  applications?: FixtureApplicationDto[];
}

/** Fixture without nested variants (§4.6). */
export interface FixtureSummaryResponseDto {
  id: string;
  manufacturer_name: string;
  name: string;
  is_main_solution: boolean;
  applications: FixtureApplicationDto[];
  created_at: string;
  updated_at: string;
}

/** `GET /fixtures/{fixture_id}` payload: summary + nested variants (§4.3, §4.6). */
export interface FixtureResponseDto extends FixtureSummaryResponseDto {
  variants: VariantResponseDto[];
}

/** Query params for `GET /fixtures/` (§4.2). */
export interface ListFixturesParamsDto extends PageParamsDto {
  /** Partial, case-insensitive match on `manufacturer_name` and fixture `name`. */
  q?: string;
  /** Fixture must include this application. */
  application?: FixtureApplicationDto;
  is_main_solution?: boolean;
}
