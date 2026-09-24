/**
 * Admin + CAD + LuxScale API origins (each includes any version prefix, no trailing slash).
 * Values come from `.env` (`NG_APP_*`) at build time via `@ngx-env/builder`.
 */
export const environment = {
  standardsBaseUrl: import.meta.env.NG_APP_STANDARDS_BASE_URL ?? '/api/v1',
  fixturesBaseUrl: import.meta.env.NG_APP_FIXTURES_BASE_URL ?? '/api/v1',
  cadBaseUrl: import.meta.env.NG_APP_CAD_ANALYSIS_BASE_URL ?? '/api/v1',
  luxscaleBackendBaseUrl: import.meta.env.NG_APP_LUXSCALE_BACKEND_BASE_URL ?? '',
};
