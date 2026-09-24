import { Injectable, signal } from '@angular/core';
import type { AutomateRequestDto } from '../core/automate/dtos/automate-request.dto';
import type { AutomateResponseDto } from '../core/automate/dtos/automate-response.dto';
import type { StandardResponseDto } from '../core/standards/dtos/standards.dto';
import type { VariantDetailResponseDto } from '../core/variants/dtos/variants.dto';

/**
 * @deprecated Legacy catalog fixture shape from the pre-admin Railway API.
 * Kept only so `pdf-report.service.ts` (rewired in a follow-up) still compiles.
 * Do not use in new code — use `VariantDetailResponseDto`.
 */
export interface LegacyProductSpecs {
  beam_angle: string;
  cct: string;
  chip: string;
  driver: string;
  frequency: string;
  input_voltage: string;
  lifetime: string;
  luminous_efficacy: string;
  oc_protection: boolean;
  ot_protection: boolean;
  ov_protection: boolean;
  pcb: string;
  power: string;
  power_factor: string;
  protection: string;
  warranty: string;
}

/** @deprecated See `LegacyProductSpecs`. */
export interface LegacyProduct {
  category: string;
  id: string;
  images: string[];
  name: string;
  series: string;
  specs: LegacyProductSpecs;
  title: string;
  type: string;
  url: string;
}

/** @deprecated See `LegacyProductSpecs`. */
export interface Fixture {
  api_luminaire_name: string;
  ies_available: boolean;
  ies_file: string;
  power_w: number;
  product: LegacyProduct;
  relative_ies: string;
}

/** @deprecated See `LegacyProductSpecs`. */
export interface FixtureKey {
  luminaire: string;
  power: number;
}

/** @deprecated See `LegacyProductSpecs`. */
export interface FixtureResult {
  key: FixtureKey;
  fixtures: Fixture[];
}

/**
 * @deprecated Legacy engine row shape. Kept only so `pdf-report.service.ts`
 * (rewired in a follow-up) still compiles. Do not use in new code.
 */
export type CalculationResult = Record<string, any> & {
  is_compliant: boolean;
};

/**
 * @deprecated Legacy engine response shape. Kept only so `pdf-report.service.ts`
 * (rewired in a follow-up) still compiles. Do not use in new code.
 */
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

/** @deprecated See `CalculationResult`. */
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

/** @deprecated See `CalculationResult`. */
export interface FixtureFamilyShortfall {
  attempts: number;
  best_calculated_u0: number | null;
  issue: string;
  luminaire: string;
  recommendation: string;
  standard_u0: number;
  summary: string;
}

/** @deprecated See `CalculationResult`. */
export interface UserGridMeta {
  spacing_x_m: number | null;
  spacing_y_m: number | null;
  offset_start_x_m: number;
  offset_start_y_m: number;
  offset_end_min_x_m: number;
  offset_end_min_y_m: number;
  free_axis: 'x' | 'y' | null;
}

/** @deprecated See `CalculationResult`. */
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
  layout_mode?: 'auto' | 'user_grid';
  user_grid?: UserGridMeta;
}

/** @deprecated See `CalculationResult`. */
export interface CeilingHeightBounds {
  exterior_max_m: number;
  interior_max_m: number;
  interior_min_m: number;
}

/** @deprecated See `CalculationResult`. */
export interface RoomReflectancePreset {
  id: string;
  label: string;
}

/** @deprecated See `CalculationResult`. */
export interface UiSettings {
  ceiling_height_bounds: CeilingHeightBounds;
  maintenance_factor: number;
  results_batch_size: number;
  results_initial_count: number;
  room_reflectance_preset: string;
  room_reflectance_presets: RoomReflectancePreset[];
  show_compliance_margin_fields: boolean;
}

/** @deprecated See `CalculationResult`. */
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

export interface AutomateProjectMeta {
  projectName: string;
  companyName: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
}

export interface StoredAutomateStudy {
  request: AutomateRequestDto;
  response: AutomateResponseDto;
  project: AutomateProjectMeta | null;
  standard: StandardResponseDto | null;
  requestId: string | null;
}

const STORAGE_KEY_STUDY = 'luxscale_automate_study';

/** Legacy keys from the pre-automate engine; removed on write. */
const LEGACY_KEYS = [
  'luxscale_calculation_result',
  'luxscale_fixtures_result',
  'luxscale_fallback_fields',
  'luxscale_calculation_request',
];

@Injectable({
  providedIn: 'root',
})
export class ResultStoreService {
  readonly study = signal<StoredAutomateStudy | null>(this.loadStudyFromStorage());
  readonly variantHeaders = signal<Map<string, VariantDetailResponseDto>>(new Map());

  setStudy(study: StoredAutomateStudy) {
    this.study.set(study);
    this.variantHeaders.set(new Map());
    try {
      localStorage.setItem(STORAGE_KEY_STUDY, JSON.stringify(study));
      for (const key of LEGACY_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
  }

  setVariantHeaders(headers: Map<string, VariantDetailResponseDto>) {
    this.variantHeaders.set(headers);
  }

  clearAll() {
    this.study.set(null);
    this.variantHeaders.set(new Map());
    try {
      localStorage.removeItem(STORAGE_KEY_STUDY);
    } catch {
      // ignore
    }
  }

  private loadStudyFromStorage(): StoredAutomateStudy | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STUDY);
      return raw ? (JSON.parse(raw) as StoredAutomateStudy) : null;
    } catch {
      return null;
    }
  }
}
