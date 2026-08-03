import {
  BadRequestException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';

export const CHAT_ERROR_CODES = {
  MESSAGE_EMPTY: 'MESSAGE_EMPTY',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

export type ChatException = HttpException;

export const messageEmpty = (): BadRequestException =>
  new BadRequestException({
    code: CHAT_ERROR_CODES.MESSAGE_EMPTY,
    message: 'A message must include text or an attachment',
  });

export const chatMessageNotFound = (): NotFoundException =>
  new NotFoundException({
    code: CHAT_ERROR_CODES.MESSAGE_NOT_FOUND,
    message: 'Chat message not found on this board',
  });

export const invalidChatCursor = (): BadRequestException =>
  new BadRequestException({
    code: CHAT_ERROR_CODES.INVALID_CURSOR,
    message: 'Invalid pagination cursor',
  });
