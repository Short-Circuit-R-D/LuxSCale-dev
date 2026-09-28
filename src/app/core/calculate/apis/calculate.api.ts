import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { LUXSCALE_BACKEND_BASE_URL } from '../../common/tokens';
import type { CalculateRequest } from '../dtos/calculate-request.dto';
import type { CalculateResponse } from '../dtos/calculate-response.dto';

const CALCULATE_TIMEOUT_MS = 120_000;

export interface CalculateResult {
  data: CalculateResponse;
  requestId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class CalculateApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(LUXSCALE_BACKEND_BASE_URL);

  calculate(req: CalculateRequest): Observable<CalculateResult> {
    return this.http
      .post<CalculateResponse>(`${this.baseUrl}/calculate`, req, { observe: 'response' })
      .pipe(
        timeout(CALCULATE_TIMEOUT_MS),
        map((res: HttpResponse<CalculateResponse>) => ({
          data: res.body as CalculateResponse,
          requestId: res.headers.get('X-Request-ID'),
        })),
      );
  }

  calculateMultipart(
    req: CalculateRequest,
    iesFile: File | Blob,
    extraIes: File[] = [],
  ): Observable<CalculateResult> {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(req));
    formData.append('iesFile', iesFile);
    for (const file of extraIes) {
      formData.append('iesFiles', file, file.name);
    }

    return this.http
      .post<CalculateResponse>(`${this.baseUrl}/calculate`, formData, { observe: 'response' })
      .pipe(
        timeout(CALCULATE_TIMEOUT_MS),
        map((res: HttpResponse<CalculateResponse>) => ({
          data: res.body as CalculateResponse,
          requestId: res.headers.get('X-Request-ID'),
        })),
      );
  }
}
