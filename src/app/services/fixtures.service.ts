import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ProductSpecs {
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

export interface Product {
  category: string;
  id: string;
  images: string[];
  name: string;
  series: string;
  specs: ProductSpecs;
  title: string;
  type: string;
  url: string;
}

export interface Fixture {
  api_luminaire_name: string;
  ies_available: boolean;
  ies_file: string;
  power_w: number;
  product: Product;
  relative_ies: string;
}

export interface FixturesResponse {
  count: number;
  fixtures: Fixture[];
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class FixturesService {
  private readonly http = inject(HttpClient);
  private readonly fixturesUrl =
    'https://web-production-8d09d.up.railway.app/api/fixtures';

  getFixtures(q: string, minPower: number, maxPower: number): Observable<FixturesResponse> {
    const params = new HttpParams()
      .set('q', q)
      .set('min_power', minPower.toString())
      .set('max_power', maxPower.toString());

    return this.http.get<FixturesResponse>(this.fixturesUrl, { params });
  }
}
