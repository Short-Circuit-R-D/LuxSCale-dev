export type UnitSource = 'explicit' | 'cad_metadata' | 'fallback';

export interface LayoutMeta {
  job_id: string;
  unit: string;
  unit_source: UnitSource;
  scale_factor: number;
  layout_rev: number;
  engine_sha: string;
  pipeline_version: string;
  created_at: string;
}
