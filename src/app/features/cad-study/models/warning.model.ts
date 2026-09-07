export type WarningSeverity = 'info' | 'warning' | 'error';

export interface Warning {
  code: string;
  severity: WarningSeverity;
  message: string;
  target_ids: string[];
}
