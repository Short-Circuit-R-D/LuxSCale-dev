import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root',
})
export class LuxScaleService {
  private readonly http = inject(HttpClient);
  private readonly standardsUrl =
    'https://web-production-8d09d.up.railway.app/api/standards/cleaned';
  private readonly calculateUrl = 'https://web-production-8d09d.up.railway.app/calculate';

  getStandardCategories(): Observable<string[]> {
    return this.http
      .get<PlacesResponse>('https://web-production-8d09d.up.railway.app/places')
      .pipe(map((res) => res.standard_categories));
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
    return this.http.post<Record<string, unknown>>(this.calculateUrl, payload, {
      responseType: 'json',
    });
  }
}
