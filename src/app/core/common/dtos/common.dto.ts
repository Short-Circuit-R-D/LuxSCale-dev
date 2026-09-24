/** Shared wire types for the admin API (`admin-api-contract.md` §1). */

export type FixtureApplicationDto = 'interior' | 'industrial';

export type ElectricalProtectionDto = 'OV' | 'OC' | 'OT';

export type StandardsMatchModeDto = 'any' | 'all';

/** Pagination envelope on list endpoints (§1.1). `null` on single-object endpoints. */
export interface PaginationDto {
  total_count: number;
  page_size: number;
  current_page: number;
  total_pages: number;
}

/** Success envelope wrapping every JSON response body with content (§1.1). */
export interface AdminEnvelopeDto<T> {
  success: true;
  data: T;
  pagination: PaginationDto | null;
}

/** Pagination query params shared by all list endpoints (§1.2). */
export interface PageParamsDto {
  page?: number;
  limit?: number;
}
