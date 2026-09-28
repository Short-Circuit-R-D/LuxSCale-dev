import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdvancedStudyStore } from '../../stores/advanced-study.store';
import type { FreeFixtureDto } from '../../../../core/calculate/dtos/calculate-request.dto';
import type { VariantDetailResponseDto } from '../../../../core/variants/dtos/variants.dto';

@Component({
  selector: 'app-fixture-inspector',
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-primary inline-block"></span>
          <h2 class="font-mono text-xs tracking-widest text-white uppercase font-medium">
            {{ selectedFixture() ? 'Luminaire Inspector' : 'Luminaires Overview' }}
          </h2>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-muted" title="Total luminaires placed in the room">
            {{ store.freeFixtures().length }} placed
          </span>
          <button
            type="button"
            class="px-2 py-1 rounded bg-black border border-border font-mono text-[11px] text-white hover:border-primary transition-colors flex items-center gap-1 cursor-pointer"
            (click)="store.addFixtureAt()"
            title="Place a new luminaire into the room (can be freely moved, rotated, and customized)"
          >
            <span class="text-primary font-bold">+</span> ADD FIXTURE
          </button>
        </div>
      </div>

      @if (selectedFixture(); as f) {
        <div class="space-y-4">
          <!-- Fixture Header & Quick Info -->
          <div class="flex items-center justify-between bg-black/60 p-2.5 rounded-lg border border-border/60">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm text-white font-bold">{{ f.id }}</span>
              @if (isCustomIes(f)) {
                <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] uppercase font-semibold">
                  Custom IES
                </span>
              } @else if (getAssignedVariant(f); as v) {
                <span class="font-mono text-xs text-muted truncate max-w-[130px]" [title]="v.name">
                  {{ v.name }}
                </span>
                @if (v.fixture.is_main_solution) {
                  <span
                    class="px-1.5 py-0.5 rounded bg-[#1FA971]/20 text-[#1FA971] border border-[#1FA971]/30 font-mono text-[9px] font-semibold uppercase"
                    title="Can be used as a main solution"
                  >
                    Main
                  </span>
                }
              }
            </div>

            @if (getAssignedVariant(f); as v) {
              <button
                type="button"
                class="px-2 py-1 rounded bg-surface border border-border font-mono text-[10px] text-muted hover:text-white hover:border-primary transition-colors cursor-pointer flex items-center gap-1"
                (click)="store.openFixtureDetails(v)"
                title="Open comprehensive optical, electrical, and dimensional datasheet for this variant"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                DATASHEET
              </button>
            }
          </div>

          <!-- Section 1: Photometry & Variant Selection -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="block font-mono text-[11px] text-muted tracking-widest uppercase" for="fix-photometry" title="Select which optical catalog variant or custom IES file this luminaire uses">
                Photometry / Variant
              </label>
              @if (isCustomIes(f)) {
                <span class="font-mono text-[10px] text-muted truncate max-w-[140px]" [title]="f.iesRef">
                  {{ f.iesRef }}
                </span>
              }
            </div>

            <div class="space-y-2">
              <select
                id="fix-photometry"
                class="w-full px-2.5 py-1.5 bg-black border border-border rounded text-xs text-white font-mono focus:border-primary focus:outline-none cursor-pointer"
                [ngModel]="f.variantId || f.iesRef || store.selectedVariantIds()[0]"
                (ngModelChange)="onVariantChange(f.id!, $event)"
                title="Choose catalog luminaire variant"
              >
                @for (variant of availableVariants(); track variant.id) {
                  <option [value]="variant.id">
                    {{ variant.name }} ({{ variant.power }}W · {{ variant.efficacy }} lm/W){{ variant.fixture.is_main_solution ? ' ★ Main Solution' : '' }}
                  </option>
                }
              </select>

              <!-- Upload Custom IES for this specific fixture -->
              <div class="flex items-center gap-2">
                <input
                  #fixtureFileInput
                  type="file"
                  accept=".ies,.IES"
                  class="hidden"
                  (change)="onFixtureIesSelected($event, f.id!)"
                />
                <button
                  type="button"
                  class="w-full py-1.5 px-2.5 rounded bg-black/50 border border-dashed border-border/80 font-mono text-[11px] text-muted hover:text-white hover:border-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  (click)="fixtureFileInput.click()"
                  title="Upload a specific IES LM-63 file for this fixture (e.g. specialized spot, wall washer, or accent luminaire)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>{{ isCustomIes(f) ? 'REPLACE CUSTOM .IES' : '+ UPLOAD FIXTURE .IES' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Section 2: Elevation & Mounting Height (Z) -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block font-mono text-[11px] text-muted tracking-widest uppercase" for="fix-z" title="Elevation above finished floor in meters (cannot exceed room ceiling height)">
                Mounting Height Z (m)
              </label>
              <span class="font-mono text-[10px] text-muted">
                Ceiling: {{ store.ceilingHeight() }}m
              </span>
            </div>
            <input
              id="fix-z"
              type="number"
              step="0.05"
              min="0.1"
              [max]="store.ceilingHeight()"
              class="w-full px-2.5 py-1.5 bg-black border rounded text-xs text-white font-mono focus:outline-none"
              [class]="isInvalidMountingHeight(f) ? 'border-primary' : 'border-border focus:border-primary'"
              [ngModel]="f.z ?? store.mountingHeight()"
              (ngModelChange)="onZChange(f.id!, $event)"
              title="Per-fixture mounting height override in meters"
            />
            @if (isInvalidMountingHeight(f)) {
              <p class="mt-1 font-mono text-[10px] text-primary">
                Cannot exceed ceiling height ({{ store.ceilingHeight() }}m)
              </p>
            }
          </div>

          <!-- Section 3: Rotation (°) -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block font-mono text-[11px] text-muted tracking-widest uppercase" for="fix-rot" title="Azimuth rotation in plan view (0° = right/east, 90° = up/north)">
                Rotation (°)
              </label>
              <span class="font-mono text-[10px] text-muted">{{ f.rotation ?? 0 }}°</span>
            </div>
            <input
              id="fix-rot"
              type="number"
              min="0"
              max="360"
              step="15"
              class="w-full px-2.5 py-1.5 bg-black border border-border rounded text-xs text-white font-mono focus:border-primary focus:outline-none"
              [ngModel]="f.rotation ?? 0"
              (ngModelChange)="store.updateFixture(f.id!, { rotation: toNum($event) })"
              title="Plan rotation degree (0° to 360°)"
            />
            <div class="flex items-center gap-1 mt-1.5">
              @for (deg of [0, 90, 180, 270]; track deg) {
                <button
                  type="button"
                  class="flex-1 py-1 rounded bg-black/60 border border-border/60 font-mono text-[10px] text-muted hover:text-white transition-colors"
                  [class.border-primary]="f.rotation === deg"
                  (click)="store.updateFixture(f.id!, { rotation: deg })"
                  [title]="'Set rotation to ' + deg + '°'"
                >
                  {{ deg }}°
                </button>
              }
            </div>
          </div>

          <!-- Section 4: Position (X, Y) -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-mono text-[11px] text-muted tracking-widest uppercase mb-1" for="fix-x" title="Distance from room origin along X-axis (m)">
                X Pos (m)
              </label>
              <input
                id="fix-x"
                type="number"
                step="0.05"
                class="w-full px-2.5 py-1.5 bg-black border border-border rounded text-xs text-white font-mono focus:border-primary focus:outline-none"
                [ngModel]="f.x"
                (ngModelChange)="onCoordChange('x', $event)"
                title="Room X position (meters)"
              />
            </div>
            <div>
              <label class="block font-mono text-[11px] text-muted tracking-widest uppercase mb-1" for="fix-y" title="Distance from room origin along Y-axis (m)">
                Y Pos (m)
              </label>
              <input
                id="fix-y"
                type="number"
                step="0.05"
                class="w-full px-2.5 py-1.5 bg-black border border-border rounded text-xs text-white font-mono focus:border-primary focus:outline-none"
                [ngModel]="f.y"
                (ngModelChange)="onCoordChange('y', $event)"
                title="Room Y position (meters)"
              />
            </div>
          </div>

          <!-- Section 5: Duplicate / Delete Actions -->
          <div class="flex items-center gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              class="flex-1 py-1.5 rounded-lg border border-border font-mono text-xs text-muted hover:text-white hover:border-[#3A3A3A] transition-colors cursor-pointer"
              (click)="store.duplicateFixture(f)"
              title="Duplicate this luminaire with a slight offset"
            >
              DUPLICATE
            </button>
            <button
              type="button"
              class="py-1.5 px-3 rounded-lg border border-primary/40 font-mono text-xs text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              (click)="store.deleteFixture(f.id!)"
              title="Remove this luminaire from the room"
            >
              DELETE
            </button>
          </div>
        </div>
      } @else {
        <!-- Empty State -->
        <div class="py-6 px-3 text-center space-y-3">
          <div class="w-10 h-10 rounded-full bg-surface border border-border/80 flex items-center justify-center mx-auto text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div>
            <p class="font-body text-xs text-white font-medium">No Luminaire Selected</p>
            <p class="font-body text-[11px] text-muted mt-1 leading-relaxed">
              Click any luminaire on the plan to adjust its mounting height, rotation, and photometry, or drag it across the canvas.
            </p>
          </div>
          <button
            type="button"
            class="w-full py-2 px-3 rounded-lg bg-primary/20 border border-primary/40 text-primary font-mono text-xs font-semibold hover:bg-primary/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            (click)="store.addFixtureAt()"
            title="Add a new luminaire directly onto the floor plan"
          >
            <span class="text-sm font-bold">+</span> ADD FIXTURE TO PLAN
          </button>
        </div>
      }

      <!-- Bottom Recalculate Trigger Bar -->
      <div class="pt-3 border-t border-border">
        <button
          type="button"
          class="w-full py-2.5 px-4 rounded-xl font-mono text-xs font-semibold tracking-widest uppercase transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          [class]="store.isDirty() ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20 animate-pulse' : 'bg-[#2B2B2B] text-white hover:bg-[#3A3A3A]'"
          [disabled]="store.isCalculating()"
          (click)="recalculate.emit()"
          [title]="store.isDirty() ? 'Floor plan or fixtures have been modified. Click to run radiosity simulation with current positions.' : 'Current photometric matrix is up to date.'"
        >
          @if (store.isCalculating()) {
            CALCULATING RADIOSITY...
          } @else {
            {{ store.isDirty() ? 'RECALCULATE CHANGES' : 'CALCULATION UP TO DATE' }}
          }
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FixtureInspectorComponent {
  protected readonly store = inject(AdvancedStudyStore);
  readonly recalculate = output<void>();

  protected readonly selectedFixture = computed(() => this.store.selectedFixture());

  protected readonly availableVariants = computed(() => {
    const list = this.store.catalogVariants();
    if (list && list.length > 0) return list;
    return Array.from(this.store.selectedVariantsMap().values());
  });

  protected isCustomIes(f: FreeFixtureDto): boolean {
    return !f.variantId && !!f.iesRef && f.iesRef.toLowerCase().endsWith('.ies');
  }

  protected getAssignedVariant(f: FreeFixtureDto): VariantDetailResponseDto | null {
    const vId = f.variantId || (!this.isCustomIes(f) ? f.iesRef : null);
    if (!vId) {
      return this.store.activeVariantDetail();
    }
    const map = this.store.selectedVariantsMap();
    if (map.has(vId)) return map.get(vId)!;
    return this.store.catalogVariants().find((v) => v.id === vId) ?? null;
  }

  protected isInvalidMountingHeight(f: FreeFixtureDto): boolean {
    const z = f.z ?? this.store.mountingHeight();
    return z > this.store.ceilingHeight() || z <= 0;
  }

  protected toNum(val: unknown): number {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  protected onCoordChange(axis: 'x' | 'y', val: unknown) {
    const f = this.selectedFixture();
    if (!f || !f.id) return;
    const n = this.toNum(val);
    this.store.moveFixture(f.id, axis === 'x' ? n : f.x, axis === 'y' ? n : f.y);
  }

  protected onZChange(id: string, val: unknown) {
    const z = this.toNum(val);
    this.store.updateFixture(id, { z });
  }

  protected onVariantChange(fixtureId: string, variantId: string) {
    this.store.setFixtureVariant(fixtureId, variantId);
  }

  protected onFixtureIesSelected(event: Event, fixtureId: string) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.store.setFixtureIesFile(fixtureId, file);
      input.value = '';
    }
  }
}
