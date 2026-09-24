import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AdminEnvelopeDto } from '../../common/dtos/common.dto';
import type {
  ListStandardCategoriesParamsDto,
  ListStandardsParamsDto,
  StandardCategoryResponseDto,
  StandardResponseDto,
} from '../dtos/standards.dto';
import { STANDARDS_BASE_URL } from '../../common/tokens';

/** Admin Standards API (`admin-api-contract.md` §3). All reads; writes land here later. */
@Injectable({
  providedIn: 'root',
})
export class StandardsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(STANDARDS_BASE_URL);

  /** `GET /standards/` — paginated list with server-side filters (§3.3). */
  listStandards(
    params?: ListStandardsParamsDto,
  ): Observable<AdminEnvelopeDto<StandardResponseDto[]>> {
    let httpParams = new HttpParams();
    if (params?.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params?.standard_code != null) {
      httpParams = httpParams.set('standard_code', params.standard_code);
    }
    if (params?.version_year != null) {
      httpParams = httpParams.set('version_year', params.version_year);
    }
    if (params?.is_latest != null) {
      httpParams = httpParams.set('is_latest', String(params.is_latest));
    }
    if (params?.category_table_number != null) {
      httpParams = httpParams.set('category_table_number', params.category_table_number);
    }
    if (params?.activity != null) {
      httpParams = httpParams.set('activity', params.activity);
    }
    for (const keyword of params?.keywords ?? []) {
      httpParams = httpParams.append('keywords', keyword);
    }
    if (params?.match_mode != null) {
      httpParams = httpParams.set('match_mode', params.match_mode);
    }
    return this.http.get<AdminEnvelopeDto<StandardResponseDto[]>>(`${this.baseUrl}/standards/`, {
      params: httpParams,
    });
  }

  /** `GET /standards/categories` — distinct categories, no pagination (§3.4). */
  listCategories(
    params?: ListStandardCategoriesParamsDto,
  ): Observable<AdminEnvelopeDto<StandardCategoryResponseDto[]>> {
    let httpParams = new HttpParams();
    if (params?.standard_code != null) {
      httpParams = httpParams.set('standard_code', params.standard_code);
    }
    if (params?.version_year != null) {
      httpParams = httpParams.set('version_year', params.version_year);
    }
    if (params?.is_latest != null) {
      httpParams = httpParams.set('is_latest', String(params.is_latest));
    }
    return this.http.get<AdminEnvelopeDto<StandardCategoryResponseDto[]>>(
      `${this.baseUrl}/standards/categories`,
      { params: httpParams },
    );
  }

  /** `GET /standards/{standard_id}` (§3.5). Unknown id → `404`. */
  getStandard(standardId: string): Observable<AdminEnvelopeDto<StandardResponseDto>> {
    return this.http.get<AdminEnvelopeDto<StandardResponseDto>>(
      `${this.baseUrl}/standards/${encodeURIComponent(standardId)}`,
    );
  }
}
