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
  Em_r_lx: number;
  Em_u_lx: number;
  Uo: number;
  Ra: number;
  RUGL: number;
  Ez_lx: number;
  Em_wall_lx: number;
  Em_ceiling_lx: number;
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

  calculate(payload: CalculatePayload): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.calculateUrl, payload, {
      responseType: 'json',
    });
  }
}
