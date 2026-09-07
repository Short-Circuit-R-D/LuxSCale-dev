import { HttpClient, HttpParams, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, filter, map, switchMap, timeout, timer } from 'rxjs';
import { CAD_BASE_URL } from './cad-base-url';
import { facesFromEngine, layoutFromEngine } from './cad-layout.mapper';
import { AnalyzeUploadRequestDto } from './dto/analyze-upload-request.dto';
import { AnalyzeUploadResponseDto } from './dto/analyze-upload-response.dto';
import { ApiResponseDto } from './dto/api-response.dto';
import { CreateJobResponseDto } from './dto/create-job-response.dto';
import { DividerRequestDto } from './dto/divider-request.dto';
import { FeedbackEventRequestDto } from './dto/feedback-event-request.dto';
import { HealthResponseDto } from './dto/health-response.dto';
import { Face } from './models/face.model';
import { Layout } from './models/layout.model';

const REQUEST_TIMEOUT_MS = 180_000;
const FACES_TIMEOUT_MS = 10_000;
const LAYOUT_POLL_INTERVAL_MS = 60_000;

export type LayoutFetch =
  { pending: true } | { pending: false; response: ApiResponseDto<AnalyzeUploadResponseDto> };

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

  upload(req: AnalyzeUploadRequestDto): Observable<ApiResponseDto<CreateJobResponseDto>> {
    const form = new FormData();
    form.append('file', req.file);
    form.append('unit', req.unit ?? '');
    const params = req.unit ? new HttpParams().set('unit', req.unit) : undefined;

    return this.http
      .post<ApiResponseDto<CreateJobResponseDto> | CreateJobResponseDto>(
        `${this.cadBaseUrl}/jobs`,
        form,
        { params, observe: 'body' },
      )
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((body) => this.asApiResponse(body, isCreateJob)),
        map((res) => this.normalizeCreateJob(res)),
      );
  }

  pollLayout(jobId: string): Observable<ApiResponseDto<AnalyzeUploadResponseDto>> {
    return this.layoutStatus(jobId).pipe(
      expand((result) =>
        result.pending
          ? timer(LAYOUT_POLL_INTERVAL_MS).pipe(switchMap(() => this.layoutStatus(jobId)))
          : EMPTY,
      ),
      filter(
        (
          result,
        ): result is { pending: false; response: ApiResponseDto<AnalyzeUploadResponseDto> } =>
          !result.pending,
      ),
      map((result) => result.response),
    );
  }

  layoutStatus(jobId: string): Observable<LayoutFetch> {
    return this.http
      .get(`${this.cadBaseUrl}/jobs/${jobId}/layout`, {
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((res) => this.layoutFetchFromResponse(res, jobId)),
      );
  }

  getFaces(jobId: string): Observable<Face[]> {
    return this.http
      .get(`${this.cadBaseUrl}/jobs/${jobId}/faces`, {
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        timeout(FACES_TIMEOUT_MS),
        map((res) => this.parseFaces(res)),
      );
  }

  createDivider(jobId: string, req: DividerRequestDto): Observable<void> {
    return this.http
      .post<unknown>(`${this.cadBaseUrl}/jobs/${jobId}/dividers`, req, { observe: 'body' })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map(() => undefined),
      );
  }

  clearDividers(jobId: string): Observable<void> {
    return this.http
      .delete<unknown>(`${this.cadBaseUrl}/jobs/${jobId}/dividers`, { observe: 'body' })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map(() => undefined),
      );
  }

  postEvent(jobId: string, req: FeedbackEventRequestDto): Observable<void> {
    return this.http
      .post<unknown>(`${this.cadBaseUrl}/jobs/${jobId}/events`, req, { observe: 'body' })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map(() => undefined),
      );
  }

  resetJob(jobId: string): Observable<ApiResponseDto<AnalyzeUploadResponseDto>> {
    return this.http
      .post<unknown>(`${this.cadBaseUrl}/jobs/${jobId}/reset`, null, { observe: 'body' })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((body) => this.toJobLayout(body, jobId)),
      );
  }

  private parseFaces(res: HttpResponse<string>): Face[] {
    if (res.status === HttpStatusCode.Accepted || !res.body?.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(res.body) as unknown;
      return facesFromEngine(isWrapped(parsed) ? parsed.data : parsed);
    } catch {
      return [];
    }
  }

  private layoutFetchFromResponse(res: HttpResponse<string>, jobId: string): LayoutFetch {
    if (res.status === HttpStatusCode.Accepted) {
      return { pending: true };
    }
    return {
      pending: false,
      response: this.parseJobLayout(res.body, jobId),
    };
  }

  private parseJobLayout(
    body: string | null,
    fallbackJobId: string,
  ): ApiResponseDto<AnalyzeUploadResponseDto> {
    if (!body?.trim()) {
      return unexpectedJobLayout();
    }
    try {
      return this.toJobLayout(JSON.parse(body) as unknown, fallbackJobId);
    } catch {
      return unexpectedJobLayout();
    }
  }

  private toJobLayout(
    parsed: unknown,
    fallbackJobId: string,
  ): ApiResponseDto<AnalyzeUploadResponseDto> {
    if (isWrapped(parsed) && parsed.success === false) {
      return {
        success: false,
        data: parsed.data as AnalyzeUploadResponseDto,
        message: parsed.message,
        error: parsed.error,
      };
    }

    const payload = isWrapped(parsed) ? parsed.data : parsed;
    const layout = layoutFromEngine(payload);
    if (!layout) {
      return unexpectedJobLayout(isWrapped(parsed) ? parsed.message : undefined);
    }

    const jobId = layout.meta.job_id || fallbackJobId;
    return {
      success: true,
      data: { job_id: jobId, layout },
      message: isWrapped(parsed) ? parsed.message : '',
    };
  }

  private normalizeCreateJob(
    res: ApiResponseDto<CreateJobResponseDto>,
  ): ApiResponseDto<CreateJobResponseDto> {
    if (!res.success) {
      return res;
    }
    const payload = res.data as CreateJobResponseDto | Layout | null | undefined;
    const layout = layoutFromEngine(payload);
    const jobId =
      (payload && typeof payload === 'object' && 'job_id' in payload
        ? (payload as { job_id?: unknown }).job_id
        : undefined) ?? layout?.meta.job_id;
    if (typeof jobId !== 'string' || !jobId) {
      return {
        success: false,
        data: res.data,
        message: res.message || 'Unexpected response from the CAD analysis engine.',
        error: res.error,
      };
    }
    return {
      success: true,
      data: { job_id: jobId, layout: layout ?? null },
      message: res.message,
      error: res.error,
    };
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

function isCreateJob(value: unknown): value is CreateJobResponseDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'job_id' in value &&
    typeof (value as { job_id: unknown }).job_id === 'string'
  );
}

function unexpectedJobLayout(message?: string): ApiResponseDto<AnalyzeUploadResponseDto> {
  return {
    success: false,
    data: {} as AnalyzeUploadResponseDto,
    message: message || 'Unexpected response from the CAD analysis engine.',
  };
}
