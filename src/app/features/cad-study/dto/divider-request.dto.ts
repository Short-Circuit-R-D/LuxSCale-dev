export interface DividerRequestDto {
  start_x: number;
  start_y: number;
  end_x: number;
  end_y: number;
  expected_layout_rev?: number | null;
}
