export type FeedbackAction =
  | 'accept'
  | 'delete_room'
  | 'restore_face'
  | 'merge_rooms'
  | 'split'
  | 'draw_wall'
  | 'connect_nodes'
  | 'mark_entity'
  | 'rename_room'
  | 'undo';

export interface FeedbackEventRequestDto {
  action: FeedbackAction;
  target_ids?: string[];
  payload?: Record<string, unknown>;
  expected_layout_rev?: number | null;
  actor?: string;
}
