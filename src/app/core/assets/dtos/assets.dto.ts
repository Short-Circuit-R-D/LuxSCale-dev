import type { PageParamsDto } from '../../common/dtos/common.dto';

/** File record returned by the assets module (`admin-api-contract.md` §2.4). */
export interface AssetResponseDto {
  id: string;
  relative_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

/** Query params for `GET /assets/` (§2.2). */
export interface ListAssetsParamsDto extends PageParamsDto {
  /** Partial, case-insensitive match on `original_filename`. */
  name?: string;
}
