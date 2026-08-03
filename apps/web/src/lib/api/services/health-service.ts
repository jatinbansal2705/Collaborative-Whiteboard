import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

export interface HealthStatus {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: {
      status: 'up';
      latencyMs: number;
    };
  };
}

/** Liveness/readiness probe for the API. */
export const healthService = {
  async check(): Promise<HealthStatus> {
    const { data } = await httpClient.get<HealthStatus>(API_ENDPOINTS.health, {
      retries: 1,
    });
    return data;
  },
};
