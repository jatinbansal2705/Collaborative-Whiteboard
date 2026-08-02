import { SOCKET_ERROR_CODES, type SocketErrorCode } from './events';

export interface SocketAckOk<T> {
  ok: true;
  data: T;
}

export interface SocketAckError {
  ok: false;
  error: {
    code: SocketErrorCode;
    message: string;
  };
}

export type SocketAck<T> = SocketAckOk<T> | SocketAckError;

export interface SocketError {
  code: SocketErrorCode;
  message: string;
}

export const ackOk = <T>(data: T): SocketAckOk<T> => ({ ok: true, data });

export const ackError = (
  code: SocketErrorCode,
  message: string,
): SocketAckError => ({ ok: false, error: { code, message } });

export const socketError = (
  code: SocketErrorCode,
  message: string,
): SocketError => ({ code, message });

export const invalidPayloadError = (message: string): SocketAckError =>
  ackError(SOCKET_ERROR_CODES.INVALID_PAYLOAD, message);

export const internalError = (): SocketAckError =>
  ackError(
    SOCKET_ERROR_CODES.INTERNAL_ERROR,
    'The request could not be processed',
  );
