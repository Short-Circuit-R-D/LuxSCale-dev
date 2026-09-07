import { CadUnit } from '../models/cad-unit.model';

/** Multipart contract: field name is `file`; optional query `unit`. */
export interface AnalyzeUploadRequestDto {
  file: File;
  unit?: CadUnit;
}
