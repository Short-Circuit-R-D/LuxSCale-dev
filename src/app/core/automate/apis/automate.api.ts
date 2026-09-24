import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { LUXSCALE_BACKEND_BASE_URL } from '../../common/tokens';
import type { AutomateRequestDto } from '../dtos/automate-request.dto';
import type { AutomateResponseDto } from '../dtos/automate-response.dto';

/**
 * Synchronous but slow (10–90 s): HTTP timeout `≥ 180 s` with a progress state.
 * Never auto-retry on timeout — runs are expensive, the user re-submits.
 */
const AUTOMATE_TIMEOUT_MS = 180_000;

export interface AutomateResult {
  data: AutomateResponseDto;
  /** `X-Request-ID` header — include it in bug reports (§6). */
  requestId: string | null;
}

/** LuxScale automate API (`automate-api.md`): one endpoint designing a room layout. */
@Injectable({
  providedIn: 'root',
})
export class AutomateApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(LUXSCALE_BACKEND_BASE_URL);

  /** `POST {LUXSCALE_BASE_URL}/automate` → `200` with the designed layout. */
  automate(req: AutomateRequestDto): Observable<AutomateResult> {
    return this.http
      .post<AutomateResponseDto>(`${this.baseUrl}/automate`, req, { observe: 'response' })
      .pipe(
        timeout(AUTOMATE_TIMEOUT_MS),
        map((res: HttpResponse<AutomateResponseDto>) => ({
          data: res.body as AutomateResponseDto,
          requestId: res.headers.get('X-Request-ID'),
        })),
      );
  }
}
