import { Injectable, signal } from '@angular/core';

export interface StandardLighting {
  Em_ceiling_lx: number | null;
  Em_r_lx: number | null;
  Em_u_lx: number | null;
  Em_wall_lx: number | null;
  Ez_lx: number | null;
  RUGL: number | null;
  Ra: number | null;
  Uo: number | null;
  category_base: string;
  category_sub: string;
  ref_no: string;
  specific_requirements: string;
  table: string;
  task_or_activity: string;
  tcp_max_K?: number;
  tcp_min_K?: number;
  [key: string]: unknown;
}

export interface ProjectInfo {
  company: string;
  email: string;
  mounting_height: number;
  name: string;
  notes: string;
  phone: string;
  project_name: string;
  standard_category: string;
  standard_lighting: StandardLighting;
  standard_ref_no: string;
  standard_task_or_activity: string;
}

export type CalculationResult = Record<string, any> & {
  is_compliant: boolean;
};

export interface FixtureFamilyShortfall {
  attempts: number;
  best_calculated_u0: number | null;
  issue: string;
  luminaire: string;
  recommendation: string;
  standard_u0: number;
  summary: string;
}

export interface CalculationMeta {
  calc_mode: string;
  capped_at_max: boolean;
  compliant_cap_only: boolean;
  fixture_count_step: number;
  fixture_family_shortfall: FixtureFamilyShortfall[];
  had_non_compliant_closest: boolean;
  interior_height_threshold_m: number;
  max_solutions_cap: number;
  no_compliant_options: boolean;
  prioritized_weatherproof_triproof: boolean;
  total_solutions_returned: number;
  used_closest_non_compliant_fallback: boolean;
  used_uniformity_sweep_fallback: boolean;
}

export interface CeilingHeightBounds {
  exterior_max_m: number;
  interior_max_m: number;
  interior_min_m: number;
}

export interface RoomReflectancePreset {
  id: string;
  label: string;
}

export interface UiSettings {
  ceiling_height_bounds: CeilingHeightBounds;
  maintenance_factor: number;
  results_batch_size: number;
  results_initial_count: number;
  room_reflectance_preset: string;
  room_reflectance_presets: RoomReflectancePreset[];
  show_compliance_margin_fields: boolean;
}

export interface CalculationResponse {
  calculation_meta: CalculationMeta;
  calculation_trace_file: string;
  length: number;
  project_info: ProjectInfo;
  results: CalculationResult[];
  standard_row: StandardLighting;
  status: string;
  ui_settings: UiSettings;
  width: number;
}

const STORAGE_KEY = 'luxscale_calculation_result';

@Injectable({
  providedIn: 'root',
})
export class CalculationResultService {
  readonly result = signal<CalculationResponse | null>(this.loadFromStorage());

  setResult(data: CalculationResponse) {
    this.result.set(data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  }

  clearResult() {
    this.result.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): CalculationResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
