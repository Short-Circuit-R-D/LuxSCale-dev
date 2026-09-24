import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Admin Standards API prefix including `/api/v1`. Maps from `.env` `NG_APP_STANDARDS_BASE_URL`. */
export const STANDARDS_BASE_URL = new InjectionToken<string>('standards_base_url', {
  providedIn: 'root',
  factory: () => environment.standardsBaseUrl.replace(/\/$/, ''),
});

/**
 * Admin Fixtures/Variants/Assets API prefix including `/api/v1`.
 * Maps from `.env` `NG_APP_FIXTURES_BASE_URL`.
 */
export const FIXTURES_BASE_URL = new InjectionToken<string>('fixtures_base_url', {
  providedIn: 'root',
  factory: () => environment.fixturesBaseUrl.replace(/\/$/, ''),
});

/**
 * LuxScale backend origin for `POST /automate`.
 * Maps from `.env` `NG_APP_LUXSCALE_BACKEND_BASE_URL`.
 */
export const LUXSCALE_BACKEND_BASE_URL = new InjectionToken<string>(
  'luxscale_backend_base_url',
  {
    providedIn: 'root',
    factory: () => environment.luxscaleBackendBaseUrl.replace(/\/$/, ''),
  },
);
