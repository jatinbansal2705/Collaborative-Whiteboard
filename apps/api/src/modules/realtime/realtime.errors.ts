import {
  SOCKET_ERROR_CODES,
  socketError,
  type SocketError,
} from '@whiteboard/shared';

export const boardNotFoundError = (): SocketError =>
  socketError(SOCKET_ERROR_CODES.BOARD_NOT_FOUND, 'Board not found');

export const notAMemberError = (): SocketError =>
  socketError(
    SOCKET_ERROR_CODES.NOT_A_MEMBER,
    'You are not a member of this board',
  );

export const notJoinedError = (): SocketError =>
  socketError(
    SOCKET_ERROR_CODES.NOT_JOINED,
    'Join the board before sending events',
  );

export const forbiddenError = (message: string): SocketError =>
  socketError(SOCKET_ERROR_CODES.FORBIDDEN, message);

export const staleVersionError = (id: string, version: number): SocketError =>
  socketError(
    SOCKET_ERROR_CODES.STALE_VERSION,
    `Element ${id} is stale (incoming version ${version})`,
  );

export const chatMessageNotFoundError = (): SocketError =>
  socketError(
    SOCKET_ERROR_CODES.MESSAGE_NOT_FOUND,
    'Chat message not found on this board',
  );
