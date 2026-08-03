import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  CalculationResponse,
  CalculationResult,
} from './calculation-result.service';
import { FixturesService, Fixture } from './fixtures.service';

export interface FixtureKey {
  luminaire: string;
  power: number;
}

export interface FixtureResult {
  key: FixtureKey;
  fixtures: Fixture[];
}

const STORAGE_KEY_CALC = 'luxscale_calculation_result';
const STORAGE_KEY_FIXTURES = 'luxscale_fixtures_result';

@Injectable({
  providedIn: 'root',
})
export class ResultStoreService {
  private readonly fixturesService = inject(FixturesService);

  readonly calculationResult = signal<CalculationResponse | null>(
    this.loadCalcFromStorage(),
  );
  readonly fixtureResults = signal<FixtureResult[]>(
    this.loadFixturesFromStorage(),
  );

  setCalculationResult(data: CalculationResponse) {
    this.calculationResult.set(data);
    this.fixtureResults.set([]);
    try {
      localStorage.setItem(STORAGE_KEY_CALC, JSON.stringify(data));
      localStorage.removeItem(STORAGE_KEY_FIXTURES);
    } catch {
      // ignore storage errors
    }
  }

  setFixtureResults(data: FixtureResult[]) {
    this.fixtureResults.set(data);
    try {
      localStorage.setItem(STORAGE_KEY_FIXTURES, JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  }

  clearAll() {
    this.calculationResult.set(null);
    this.fixtureResults.set([]);
    try {
      localStorage.removeItem(STORAGE_KEY_CALC);
      localStorage.removeItem(STORAGE_KEY_FIXTURES);
    } catch {
      // ignore
    }
  }

  loadFixturesIfNeeded() {
    const calc = this.calculationResult();
    if (!calc || calc.results.length === 0) return;

    const existing = this.fixtureResults();
    if (existing.length > 0) return;

    const uniqueKeys = this.getUniqueFixtureKeys(calc.results);
    if (uniqueKeys.length === 0) return;

    const requests = uniqueKeys.map((key) =>
      this.fixturesService.getFixtures(key.luminaire, key.power, key.power),
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const fixtureResults = uniqueKeys.map((key, i) => ({
          key,
          fixtures: responses[i].fixtures,
        }));
        this.setFixtureResults(fixtureResults);
      },
      error: () => {
        this.setFixtureResults([]);
      },
    });
  }

  getUniqueFixtureKeys(
    results: CalculationResult[],
  ): FixtureKey[] {
    const seen = new Set<string>();
    const keys: FixtureKey[] = [];

    for (const r of results) {
      const luminaire = r['Luminaire'] as string;
      const power = r['Power (W)'] as number;
      const key = `${luminaire}|${power}`;

      if (!seen.has(key)) {
        seen.add(key);
        keys.push({ luminaire, power });
      }
    }

    return keys;
  }

  private loadCalcFromStorage(): CalculationResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CALC);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private loadFixturesFromStorage(): FixtureResult[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FIXTURES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
