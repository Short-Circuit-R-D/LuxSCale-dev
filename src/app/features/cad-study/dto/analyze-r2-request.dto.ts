import { CadUnit } from '../models/cad-unit.model';

export interface AnalyzeR2RequestDto {
  r2_url: string;
  unit?: CadUnit;
}
