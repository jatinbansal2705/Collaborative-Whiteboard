import type { ZodError, ZodType } from 'zod';
import { ackError, invalidPayloadError, type SocketAckError } from './acks';
import { SOCKET_ERROR_CODES } from './events';

export interface ValidatedOk<T> {
  ok: true;
  value: T;
}

export interface ValidatedError {
  ok: false;
  error: SocketAckError['error'];
}

export type Validated<T> = ValidatedOk<T> | ValidatedError;

const MAX_ISSUE_PREVIEW = 2;

/**
 * Validates an inbound Socket.IO payload against a shared Zod schema.
 *
 * Returns a discriminated result so the gateway can forward the error
 * verbatim as an ack: `{ ok: false, error: { code, message } }`.
 */
export function validateSocketPayload<T>(
  schema: ZodType<T>,
  payload: unknown,
): Validated<T> {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    error: {
      code: SOCKET_ERROR_CODES.INVALID_PAYLOAD,
      message: describeIssues(result.error),
    },
  };
}

/** Narrow an already-known-invalid payload into a ready-to-ack error. */
export const invalidPayload = (
  message = 'Invalid payload',
): ValidatedError => ({
  ok: false,
  error: invalidPayloadError(message).error,
});

/** Build a `{ ok: false, error }` result from a raw socket error. */
export const validationError = (
  code: SocketAckError['error']['code'],
  message: string,
): ValidatedError => ({
  ok: false,
  error: ackError(code, message).error,
});

function describeIssues(error: ZodError): string {
  const preview = error.issues.slice(0, MAX_ISSUE_PREVIEW);
  const details = preview.map(
    (issue) =>
      `${issue.path.length > 0 ? issue.path.join('.') : 'payload'}: ${issue.message}`,
  );
  return `Invalid payload${details.length > 0 ? ` (${details.join('; ')})` : ''}`;
}
