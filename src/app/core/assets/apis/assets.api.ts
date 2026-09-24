import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AdminEnvelopeDto } from '../../common/dtos/common.dto';
import type { AssetResponseDto, ListAssetsParamsDto } from '../dtos/assets.dto';
import { FIXTURES_BASE_URL } from '../../common/tokens';

/** Admin Assets API (`admin-api-contract.md` §2). Served from the fixtures base URL. */
@Injectable({
  providedIn: 'root',
})
export class AssetsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(FIXTURES_BASE_URL);

  /** `GET /assets/` — paginated asset records with optional filename search (§2.2). */
  listAssets(params?: ListAssetsParamsDto): Observable<AdminEnvelopeDto<AssetResponseDto[]>> {
    let httpParams = new HttpParams();
    if (params?.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params?.name != null) {
      httpParams = httpParams.set('name', params.name);
    }
    return this.http.get<AdminEnvelopeDto<AssetResponseDto[]>>(`${this.baseUrl}/assets/`, {
      params: httpParams,
    });
  }

  /**
   * `GET /assets/{asset_id}` — raw file bytes, no JSON envelope (§2.3).
   * Unknown id (or missing file on disk) → `404`.
   */
  downloadAsset(assetId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/assets/${encodeURIComponent(assetId)}`, {
      responseType: 'blob',
    });
  }

  /** Direct download URL for `<img>` / `<a>` tags (same endpoint as `downloadAsset`). */
  assetUrl(assetId: string): string {
    return `${this.baseUrl}/assets/${encodeURIComponent(assetId)}`;
  }
}
