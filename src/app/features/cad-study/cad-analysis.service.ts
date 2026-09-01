import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { CAD_BASE_URL } from './cad-base-url';
import { AnalyzeR2RequestDto } from './dto/analyze-r2-request.dto';
import { AnalyzeUploadRequestDto } from './dto/analyze-upload-request.dto';
import { AnalyzeUploadResponseDto } from './dto/analyze-upload-response.dto';
import { ApiResponseDto } from './dto/api-response.dto';
import { ApplyDividersRequestDto } from './dto/apply-dividers-request.dto';
import { ApplyDividersResponseDto } from './dto/apply-dividers-response.dto';
import { HealthResponseDto } from './dto/health-response.dto';

const ANALYZE_TIMEOUT_MS = 180_000;

@Injectable({
  providedIn: 'root',
})
export class CadAnalysisService {
  private readonly http = inject(HttpClient);
  private readonly cadBaseUrl = inject(CAD_BASE_URL);

  health(): Observable<ApiResponseDto<HealthResponseDto>> {
    return this.http
      .get<ApiResponseDto<HealthResponseDto> | HealthResponseDto>(`${this.cadBaseUrl}/health`, {
        observe: 'body',
      })
      .pipe(map((body) => this.asApiResponse(body, isHealth)));
  }

  upload(req: AnalyzeUploadRequestDto): Observable<ApiResponseDto<AnalyzeUploadResponseDto>> {
    const form = new FormData();
    form.append('file', req.file);
    const params = req.unit ? new HttpParams().set('unit', req.unit) : undefined;

    return this.http
      .post<ApiResponseDto<AnalyzeUploadResponseDto> | AnalyzeUploadResponseDto>(
        `${this.cadBaseUrl}/analyze/upload`,
        form,
        { params, observe: 'body' },
      )
      .pipe(
        timeout(ANALYZE_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isJobLayout)),
      );
  }

  uploadFromR2(req: AnalyzeR2RequestDto): Observable<ApiResponseDto<AnalyzeUploadResponseDto>> {
    const form = new FormData();
    form.append('r2_url', req.r2_url);
    const params = req.unit ? new HttpParams().set('unit', req.unit) : undefined;

    return this.http
      .post<ApiResponseDto<AnalyzeUploadResponseDto> | AnalyzeUploadResponseDto>(
        `${this.cadBaseUrl}/analyze/r2`,
        form,
        { params, observe: 'body' },
      )
      .pipe(
        timeout(ANALYZE_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isJobLayout)),
      );
  }

  getLayout(jobId: string): Observable<ApiResponseDto<AnalyzeUploadResponseDto>> {
    return this.http
      .get<ApiResponseDto<AnalyzeUploadResponseDto> | AnalyzeUploadResponseDto>(
        `${this.cadBaseUrl}/analyze/${jobId}`,
        { observe: 'body' },
      )
      .pipe(
        timeout(ANALYZE_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isJobLayout)),
      );
  }

  applyDividers(
    jobId: string,
    req: ApplyDividersRequestDto,
  ): Observable<ApiResponseDto<ApplyDividersResponseDto>> {
    return this.http
      .post<ApiResponseDto<ApplyDividersResponseDto> | ApplyDividersResponseDto>(
        `${this.cadBaseUrl}/analyze/${jobId}/dividers`,
        req,
        { observe: 'body' },
      )
      .pipe(
        timeout(ANALYZE_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isLayoutOnly)),
      );
  }

  clearDividers(jobId: string): Observable<ApiResponseDto<ApplyDividersResponseDto>> {
    return this.http
      .delete<ApiResponseDto<ApplyDividersResponseDto> | ApplyDividersResponseDto>(
        `${this.cadBaseUrl}/analyze/${jobId}/dividers`,
        { observe: 'body' },
      )
      .pipe(
        timeout(ANALYZE_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isLayoutOnly)),
      );
  }

  private asApiResponse<T>(
    body: ApiResponseDto<T> | T,
    isData: (value: unknown) => value is T,
  ): ApiResponseDto<T> {
    if (isWrapped(body)) {
      return body;
    }
    if (isData(body)) {
      return { success: true, data: body, message: '' };
    }
    return {
      success: false,
      data: body as T,
      message: 'Unexpected response from the CAD analysis engine.',
    };
  }
}

function isWrapped<T>(value: unknown): value is ApiResponseDto<T> {
  return typeof value === 'object' && value !== null && 'success' in value && 'data' in value;
}

function isHealth(value: unknown): value is HealthResponseDto {
  return typeof value === 'object' && value !== null && 'status' in value;
}

function isJobLayout(value: unknown): value is AnalyzeUploadResponseDto {
  return typeof value === 'object' && value !== null && 'job_id' in value && 'layout' in value;
}

function isLayoutOnly(value: unknown): value is ApplyDividersResponseDto {
  return typeof value === 'object' && value !== null && 'layout' in value;
}
