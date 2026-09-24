import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { parseFixtureCoordinates, type Point } from '../shared/room-plan/room-polygon';
import { CalculationResponse, CalculationResult } from './calculation-result.service';

interface PlacesResponse {
  standard_categories: string[];
}

export interface StandardEntry {
  category: string;
  task_or_activity: string;
  ref_no: string;
  Em_r_lx: number | null;
  Em_u_lx: number | null;
  Uo: number | null;
  Ra: number | null;
  RUGL: number | null;
  Ez_lx: number | null;
  Em_wall_lx: number | null;
  Em_ceiling_lx: number | null;
  specific_requirements: string;
  category_base: string;
  category_sub: string;
  tasks: string[];
  temperature_k_range: number[];
  [key: string]: unknown;
}

export interface LayoutPayload {
  spacing_x_m?: number;
  spacing_y_m?: number;
  offset_start_x_m?: number;
  offset_start_y_m?: number;
  offset_end_min_x_m?: number;
  offset_end_min_y_m?: number;
}

export interface CalculatePayload {
  sides: number[];
  height: number;
  project_info: {
    project_name: string;
    name: string;
    company: string;
    phone: string;
    email: string;
    notes: string;
    mounting_height: number;
    standard_ref_no: string;
    standard_category: string;
    standard_task_or_activity: string;
    standard_lighting: StandardEntry;
  };
  standard_ref_no: string;
  layout?: LayoutPayload;
}

export interface CadCalcPayload {
  polygon: { vertices: [number, number][] };
  height: number;
  standard_ref_no: string;
}

export interface HeatmapPointOfInterest {
  x: number;
  y: number;
  lux: number;
}

export interface PolygonHeatmap {
  grid_pts: [number, number][];
  grid_values: number[];
  grid_x: number[];
  grid_y: number[];
  lux_matrix: number[][];
  filled_mask: boolean[][];
  orientation_rad: number;
  resolution_x?: number;
  resolution_y?: number;
  E_min: number;
  E_avg: number;
  E_max: number;
  U0: number;
  U1: number;
  points_of_interest: {
    min: HeatmapPointOfInterest;
    max: HeatmapPointOfInterest;
    median: HeatmapPointOfInterest;
  };
  fixture_positions: [number, number][];
}

export interface PolygonHeatmapCalculationMeta {
  geometry_version: number;
  layout_engine: string;
  workplane_grid_n: number;
  effective_sample_count: number;
}

export interface PolygonHeatmapResponse {
  status: string;
  heatmap: PolygonHeatmap;
  calculation_meta: PolygonHeatmapCalculationMeta;
  fixture_meta?: Record<string, unknown>;
}

export interface PolygonHeatmapPayload {
  polygon: { vertices: [number, number][] };
  height: number;
  Luminaire: string;
  'Power (W)': number;
  'Efficacy (lm/W)': number;
  'Average Lux': number;
  layout_nx: number;
  layout_ny: number;
  fixture_coordinates: [number, number][];
  resolution?: number;
  resolution_x?: number;
  resolution_y?: number;
  sample_n?: number;
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text ? text : null;
}

function toTuples(points: readonly Point[]): [number, number][] {
  return points.map((point): [number, number] => [point.x, point.y]);
}

function layoutCounts(result: CalculationResult, fixtureCount: number): { nx: number; ny: number } {
  const nx = finiteNumber(result['layout_nx']);
  const ny = finiteNumber(result['layout_ny']);
  if (nx != null && ny != null && nx > 0 && ny > 0) {
    return { nx, ny };
  }
  const grid = String(result['Layout grid'] ?? '');
  const match = grid.match(/(\d+)\s*[×xX]\s*(\d+)/);
  if (match) {
    const parsedNx = Number(match[1]);
    const parsedNy = Number(match[2]);
    if (parsedNx > 0 && parsedNy > 0) {
      return { nx: parsedNx, ny: parsedNy };
    }
  }
  if (fixtureCount > 0) {
    return { nx: fixtureCount, ny: 1 };
  }
  return { nx: 1, ny: 1 };
}

export function buildPolygonHeatmapPayload(
  vertices: readonly Point[],
  height: unknown,
  result: CalculationResult,
  options?: {
    resolution?: number;
    resolution_x?: number;
    resolution_y?: number;
    sample_n?: number;
  },
): PolygonHeatmapPayload | null {
  const resolvedHeight = finiteNumber(height);
  const ring = parseFixtureCoordinates(vertices);
  if (ring.length < 3 || resolvedHeight == null || resolvedHeight <= 0) {
    return null;
  }
  const luminaire = nonEmptyString(result['Luminaire']);
  const power = finiteNumber(result['Power (W)']);
  const efficacy = finiteNumber(result['Efficacy (lm/W)']);
  const averageLux = finiteNumber(result['Average Lux']) ?? finiteNumber(result['E_avg_grid_lx']);
  const fixtures = parseFixtureCoordinates(
    result['fixture_coordinates'] ?? result['fixture_positions'],
  );
  const layout = layoutCounts(result, fixtures.length);
  if (luminaire == null || power == null) {
    return null;
  }
  const payload: PolygonHeatmapPayload = {
    polygon: { vertices: toTuples(ring) },
    height: resolvedHeight,
    Luminaire: luminaire,
    'Power (W)': power,
    'Efficacy (lm/W)': efficacy ?? 0,
    'Average Lux': averageLux ?? 0,
    layout_nx: layout.nx,
    layout_ny: layout.ny,
    fixture_coordinates: toTuples(fixtures),
  };
  if (options?.resolution != null) {
    payload.resolution = clampResolution(options.resolution);
  }
  if (options?.resolution_x != null) {
    payload.resolution_x = clampResolution(options.resolution_x);
  }
  if (options?.resolution_y != null) {
    payload.resolution_y = clampResolution(options.resolution_y);
  }
  if (options?.sample_n != null) {
    payload.sample_n = clampResolution(options.sample_n);
  }
  return payload;
}

function clampResolution(value: number): number {
  return Math.min(256, Math.max(8, Math.round(value)));
}

@Injectable({
  providedIn: 'root',
})
export class LuxScaleService {
  private readonly http = inject(HttpClient);
  // private readonly standardsUrl =
  //   'https://web-production-8d09d.up.railway.app/api/standards/cleaned';
  private readonly standardsUrl = 'http://localhost:5000/api/standards/cleaned';
  private readonly engineOrigin = 'http://localhost:5000';

  getStandardCategories(): Observable<string[]> {
    return (
      this.http
        // .get<PlacesResponse>('https://web-production-8d09d.up.railway.app/places')
        .get<PlacesResponse>('http://localhost:5000/places')
        .pipe(map((res) => res.standard_categories))
    );
  }

  getStandards(): Observable<StandardEntry[]> {
    return this.http.get<StandardEntry[]>(this.standardsUrl);
  }

  getTasks(category: string): Observable<string[]> {
    let [base, sub] = category.split(' – ');
    return this.getStandards().pipe(
      map((entries) =>
        entries
          .filter((entry) => entry.category_base === base && entry.category_sub === sub)
          .map((entry) => `${entry.task_or_activity} (${entry.ref_no})`),
      ),
    );
  }

  getStandardByCategoryAndTask(
    category: string,
    taskWithRef: string,
  ): Observable<StandardEntry | undefined> {
    const refNo = taskWithRef.match(/\(([^)]+)\)$/)?.[1];
    const [base, sub] = category.split(' – ');
    return this.getStandards().pipe(
      map((entries) =>
        entries.find(
          (e) => e.category_base === base && e.category_sub === sub && e.ref_no === refNo,
        ),
      ),
    );
  }

  getStandardByCategoryAndTaskWithFallback(
    category: string,
    taskWithRef: string,
  ): Observable<StandardEntry | undefined> {
    const refNo = taskWithRef.match(/\(([^)]+)\)$/)?.[1];
    const [base, sub] = category.split(' – ');
    return this.getStandards().pipe(
      map((entries) => {
        const categoryEntries = entries.filter(
          (e) => e.category_base === base && e.category_sub === sub,
        );
        const matched = categoryEntries.find((e) => e.ref_no === refNo);
        if (!matched) return undefined;

        const nullableParams = [
          'Em_r_lx',
          'Em_u_lx',
          'Uo',
          'Ra',
          'RUGL',
          'Ez_lx',
          'Em_wall_lx',
          'Em_ceiling_lx',
        ] as const;

        const result = { ...matched };
        for (const param of nullableParams) {
          if (result[param] == null) {
            const minVal = categoryEntries.reduce<number | null>((min, entry) => {
              const val = entry[param];
              if (val == null) return min;
              return min == null ? val : Math.min(min, val);
            }, null);
            result[param] = minVal;
          }
        }
        return result;
      }),
    );
  }

  calculate(payload: CalculatePayload): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.engineOrigin}/calculate`, payload, {
      responseType: 'json',
    });
  }

  calculateCad(payload: CadCalcPayload): Observable<CalculationResponse> {
    return this.http.post<CalculationResponse>(`${this.engineOrigin}/polygon_calculate`, payload, {
      responseType: 'json',
    });
  }

  polygonHeatmap(payload: PolygonHeatmapPayload): Observable<PolygonHeatmapResponse> {
    return this.http.post<PolygonHeatmapResponse>(`${this.engineOrigin}/polygon_heatmap`, payload, {
      responseType: 'json',
    });
  }
}
