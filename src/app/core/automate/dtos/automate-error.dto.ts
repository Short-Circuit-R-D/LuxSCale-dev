/** Error codes from `POST /automate` (§6). */
export type AutomateErrorCodeDto =
  | 'VALIDATION_ERROR'
  | 'GEOMETRY_INVALID'
  | 'NO_FIXTURES'
  | 'IES_PARSE'
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR'
  | string;

export interface AutomateErrorDetailDto {
  field: string;
  issue: string;
  [key: string]: unknown;
}

/** Error envelope: `{ "error": { "code", "message", "details", "requestId" } }` (§6). */
export interface AutomateErrorBodyDto {
  error: {
    code: AutomateErrorCodeDto;
    message: string;
    details: AutomateErrorDetailDto[];
    requestId: string;
  };
}

/** Narrow an unknown HTTP error body to the automate error envelope. */
export function asAutomateErrorBody(body: unknown): AutomateErrorBodyDto | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return null;
  }
  const error = (body as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== 'string' || typeof message !== 'string') {
    return null;
  }
  return body as AutomateErrorBodyDto;
}
