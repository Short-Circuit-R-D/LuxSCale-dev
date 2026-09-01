import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import { ApiErrorDto } from './dto/api-error.dto';
import { ApiResponseDto } from './dto/api-response.dto';

const ERROR_MESSAGES: Record<string, string> = {
  UNSUPPORTED_FORMAT: 'This file type is not supported. Upload a DXF or DWG drawing.',
  FILE_TOO_LARGE: 'The file exceeds the 50 MB limit. Choose a smaller drawing.',
  CONVERSION_ERROR: 'The drawing could not be converted. Export as DXF and try again.',
  JOB_NOT_FOUND: 'This analysis session expired. Upload the drawing again.',
  VALIDATION_ERROR: 'The request was not valid. Check the drawing or divider points and try again.',
  CAD_PARSE_ERROR: 'The drawing could not be parsed. Check the file and try again.',
};

export interface CadClientError {
  code: string;
  message: string;
}

export function messageForCode(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? 'Unable to analyze the drawing. Please try again.';
}

export function errorFromHttp(err: unknown): CadClientError {
  if (err instanceof TimeoutError) {
    return {
      code: 'TIMEOUT',
      message: 'Analysis took too long. Try a simpler drawing or try again.',
    };
  }

  if (!(err instanceof HttpErrorResponse)) {
    return {
      code: 'UNKNOWN',
      message: 'Unable to analyze the drawing. Please try again.',
    };
  }

  if (err.status === 0) {
    return {
      code: 'NETWORK',
      message: 'Unable to reach the CAD analysis engine. Confirm the service is running and try again.',
    };
  }

  const body = err.error as ApiResponseDto<unknown> | ApiErrorDto | { detail?: unknown } | null;
  const fromWrapper = isApiResponse(body) ? body.error : undefined;
  const fromDirect = isApiError(body) ? body : undefined;
  const code =
    fromWrapper?.code ??
    fromDirect?.code ??
    codeFromStatus(err.status);
  const detail =
    fromWrapper?.detail ??
    fromDirect?.detail ??
    detailFromFastApi(body) ??
    err.message;

  return { code, message: messageForCode(code, detail) };
}

function codeFromStatus(status: number): string {
  if (status === 413) return 'FILE_TOO_LARGE';
  if (status === 404) return 'JOB_NOT_FOUND';
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 422) return 'CONVERSION_ERROR';
  return 'UNKNOWN';
}

function isApiResponse(value: unknown): value is ApiResponseDto<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

function isApiError(value: unknown): value is ApiErrorDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'detail' in value &&
    typeof (value as ApiErrorDto).code === 'string'
  );
}

function detailFromFastApi(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('detail' in body)) {
    return undefined;
  }
  const detail = (body as { detail: unknown }).detail;
  if (typeof detail === 'string') {
    return detail;
  }
  return undefined;
}
