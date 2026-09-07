import { Layout } from '../models/layout.model';

export interface CreateJobResponseDto {
  job_id: string;
  layout?: Layout | null;
}
