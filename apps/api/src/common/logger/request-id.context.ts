import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const requestIdStore = new AsyncLocalStorage<RequestContext>();

/**
 * Runs the handler inside an AsyncLocalStorage context so any log line
 * emitted while a request is in flight can be correlated with its
 * `x-request-id` (ADR-0009, extended for structured logging in Phase 15).
 */
export function runWithRequestId(requestId: string, run: () => void): void {
  requestIdStore.run({ requestId }, run);
}

export function getRequestId(): string | undefined {
  return requestIdStore.getStore()?.requestId;
}
