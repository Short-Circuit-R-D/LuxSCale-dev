import { ApiErrorDto } from './api-error.dto';

export interface ApiResponseDto<T> {
  success: boolean;
  data: T;
  message: string;
  error?: ApiErrorDto;
}
