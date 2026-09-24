interface ImportMetaEnv {
  readonly NG_APP_STANDARDS_BASE_URL: string;
  readonly NG_APP_FIXTURES_BASE_URL: string;
  readonly NG_APP_CAD_ANALYSIS_BASE_URL: string;
  readonly NG_APP_LUXSCALE_BACKEND_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
