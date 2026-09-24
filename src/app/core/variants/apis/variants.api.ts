import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { AdminEnvelopeDto, FixtureApplicationDto } from '../../common/dtos/common.dto';
import type {
  ListAllVariantsParamsDto,
  ListVariantsParamsDto,
  VariantDetailResponseDto,
} from '../dtos/variants.dto';
import { FIXTURES_BASE_URL } from '../../common/tokens';

/** Admin Variants API nested under fixtures (`admin-api-contract.md` §5). */
@Injectable({
  providedIn: 'root',
})
export class VariantsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(FIXTURES_BASE_URL);

  /** `GET /fixtures/variants/` — all variants across fixtures, paginated (§5.1). */
  listAllVariants(
    params?: ListAllVariantsParamsDto,
  ): Observable<AdminEnvelopeDto<VariantDetailResponseDto[]>> {
    return this.http.get<AdminEnvelopeDto<VariantDetailResponseDto[]>>(
      `${this.baseUrl}/fixtures/variants/`,
      { params: this.variantParams(params) },
    );
  }

  /** `GET /fixtures/{fixture_id}/variants/` — one fixture's variants, paginated (§5.2). */
  listFixtureVariants(
    fixtureId: string,
    params?: ListVariantsParamsDto,
  ): Observable<AdminEnvelopeDto<VariantDetailResponseDto[]>> {
    return this.http.get<AdminEnvelopeDto<VariantDetailResponseDto[]>>(
      `${this.baseUrl}/fixtures/${encodeURIComponent(fixtureId)}/variants/`,
      { params: this.variantParams(params) },
    );
  }

  /** `GET /fixtures/{fixture_id}/variants/{variant_id}` — variant + parent summary (§5.4). */
  getVariant(
    fixtureId: string,
    variantId: string,
  ): Observable<AdminEnvelopeDto<VariantDetailResponseDto>> {
    return this.http.get<AdminEnvelopeDto<VariantDetailResponseDto>>(
      `${this.baseUrl}/fixtures/${encodeURIComponent(fixtureId)}/variants/${encodeURIComponent(variantId)}`,
    );
  }

  /**
   * Card headers for automate solutions, which carry only `variantId`
   * (`automate-api.md` §5). There is no `GET /variants/{id}` — list + match by id.
   */
  getVariantHeaders(
    application: FixtureApplicationDto,
  ): Observable<Map<string, VariantDetailResponseDto>> {
    return this.listAllVariants({ application, is_main_solution: true, limit: 100 }).pipe(
      map((res) => new Map(res.data.map((variant) => [variant.id, variant] as const))),
    );
  }

  private variantParams(params?: ListAllVariantsParamsDto): HttpParams {
    let httpParams = new HttpParams();
    if (params?.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit != null) {
      httpParams = httpParams.set('limit', String(params.limit));
    }
    if (params?.q != null) {
      httpParams = httpParams.set('q', params.q);
    }
    if (params?.application != null) {
      httpParams = httpParams.set('application', params.application);
    }
    if (params?.is_main_solution != null) {
      httpParams = httpParams.set('is_main_solution', String(params.is_main_solution));
    }
    if (params?.fixture_id != null) {
      httpParams = httpParams.set('fixture_id', params.fixture_id);
    }
    return httpParams;
  }
}
