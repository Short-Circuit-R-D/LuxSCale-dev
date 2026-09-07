import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Full CAD API prefix including `/api/v1`. Maps from `.env` `CAD_ANALYSIS_BASE_URL`. */
export const CAD_BASE_URL = new InjectionToken<string>('cad_base_url', {
  providedIn: 'root',
  factory: () => environment.cadBaseUrl.replace(/\/$/, ''),
});
