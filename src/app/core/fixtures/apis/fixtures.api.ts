import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AdminEnvelopeDto } from '../../common/dtos/common.dto';
import type {
  FixtureResponseDto,
  FixtureSummaryResponseDto,
  ListFixturesParamsDto,
} from '../dtos/fixtures.dto';
import { FIXTURES_BASE_URL } from '../../common/tokens';

/** Admin Fixtures API (`admin-api-contract.md` §4). Grouped reads incl. nested variants. */
@Injectable({
  providedIn: 'root',
})
export class FixturesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(FIXTURES_BASE_URL);

  /** `GET /fixtures/` — paginated summaries, no variants nested (§4.2). */
  listFixtures(
    params?: ListFixturesParamsDto,
  ): Observable<AdminEnvelopeDto<FixtureSummaryResponseDto[]>> {
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
    return this.http.get<AdminEnvelopeDto<FixtureSummaryResponseDto[]>>(
      `${this.baseUrl}/fixtures/`,
      { params: httpParams },
    );
  }

  /** `GET /fixtures/{fixture_id}` — summary plus nested `variants` (§4.3). */
  getFixture(fixtureId: string): Observable<AdminEnvelopeDto<FixtureResponseDto>> {
    return this.http.get<AdminEnvelopeDto<FixtureResponseDto>>(
      `${this.baseUrl}/fixtures/${encodeURIComponent(fixtureId)}`,
    );
  }
}
