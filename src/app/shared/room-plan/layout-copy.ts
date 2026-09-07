export function selectionLabel(selection: unknown): string {
  switch (selection) {
    case 'user_grid':
      return 'User-specified grid';
    case 'user_grid_free_axis':
      return 'User-specified grid (auto spacing for uniformity)';
    case 'least_fixture_count_compliant':
      return 'Least fixture count that meets the standard';
    case 'closest_non_compliant_candidate':
      return 'Closest non-compliant candidate';
    case 'uniformity_fixture_sweep_fallback':
      return 'Uniformity fixture-count fallback';
    default:
      return selection == null ? '' : String(selection);
  }
}

export function layoutModeLabel(mode: string | null | undefined): string {
  if (mode === 'user_grid') return 'User-specified grid';
  if (mode === 'auto') return 'Automatic layout';
  return mode ?? '—';
}

export function freeAxisLabel(axis: string | null | undefined): string {
  if (axis === 'x') return 'Width (X) chosen for uniformity';
  if (axis === 'y') return 'Length (Y) chosen for uniformity';
  return 'None';
}

export function extraClearanceNote(actual: number | undefined, min: number | undefined): string | null {
  if (actual == null || min == null) return null;
  if (actual > min + 1e-6) return 'Extra clearance on far side';
  return null;
}
