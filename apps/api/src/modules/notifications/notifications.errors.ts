import {
  BadRequestException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';

export const NOTIFICATIONS_ERROR_CODES = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

export type NotificationsException = HttpException;

export const notificationNotFound = (): NotFoundException =>
  new NotFoundException({
    code: NOTIFICATIONS_ERROR_CODES.NOTIFICATION_NOT_FOUND,
    message: 'Notification not found',
  });

export const invalidNotificationsCursor = (): BadRequestException =>
  new BadRequestException({
    code: NOTIFICATIONS_ERROR_CODES.INVALID_CURSOR,
    message: 'Invalid pagination cursor',
  });
