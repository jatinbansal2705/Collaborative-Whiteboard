import { NotFoundException, type HttpException } from '@nestjs/common';

export const COMMENTS_ERROR_CODES = {
  THREAD_NOT_FOUND: 'THREAD_NOT_FOUND',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  BOARD_NOT_FOUND: 'BOARD_NOT_FOUND',
} as const;

export type CommentsException = HttpException;

export const commentThreadNotFound = (): NotFoundException =>
  new NotFoundException({
    code: COMMENTS_ERROR_CODES.THREAD_NOT_FOUND,
    message: 'Comment thread not found',
  });

export const commentNotFound = (): NotFoundException =>
  new NotFoundException({
    code: COMMENTS_ERROR_CODES.COMMENT_NOT_FOUND,
    message: 'Comment not found',
  });
