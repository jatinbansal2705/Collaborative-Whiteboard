import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';

export const BOARD_ERROR_CODES = {
  BOARD_NOT_FOUND: 'BOARD_NOT_FOUND',
  BOARD_DELETED: 'BOARD_DELETED',
  BOARD_ALREADY_ARCHIVED: 'BOARD_ALREADY_ARCHIVED',
  BOARD_ALREADY_RESTORED: 'BOARD_ALREADY_RESTORED',
  BOARD_ALREADY_FAVOURITED: 'BOARD_ALREADY_FAVOURITED',
  BOARD_NOT_FAVOURITED: 'BOARD_NOT_FAVOURITED',
  BOARD_ACCESS_DENIED: 'BOARD_ACCESS_DENIED',
  INVALID_BOARD_TEMPLATE: 'INVALID_BOARD_TEMPLATE',
  INVALID_MEMBER_IDENTIFIER: 'INVALID_MEMBER_IDENTIFIER',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  MEMBER_ALREADY_EXISTS: 'MEMBER_ALREADY_EXISTS',
  PENDING_INVITE_EXISTS: 'PENDING_INVITE_EXISTS',
  OWNER_CANNOT_LEAVE: 'OWNER_CANNOT_LEAVE',
  INVALID_ROLE_TRANSFER: 'INVALID_ROLE_TRANSFER',
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

export type BoardException = HttpException;

export const boardNotFound = (): NotFoundException =>
  new NotFoundException({
    code: BOARD_ERROR_CODES.BOARD_NOT_FOUND,
    message: 'Board not found',
  });

export const boardAccessDenied = (): ForbiddenException =>
  new ForbiddenException({
    code: BOARD_ERROR_CODES.BOARD_ACCESS_DENIED,
    message: 'You do not have permission to perform this action on the board',
  });

export const boardAlreadyArchived = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.BOARD_ALREADY_ARCHIVED,
    message: 'Board is already archived',
  });

export const boardAlreadyRestored = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.BOARD_ALREADY_RESTORED,
    message: 'Board is not archived',
  });

export const boardAlreadyFavourited = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.BOARD_ALREADY_FAVOURITED,
    message: 'Board is already favourited',
  });

export const boardNotFavourited = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.BOARD_NOT_FAVOURITED,
    message: 'Board is not favourited',
  });

export const invalidBoardTemplate = (): BadRequestException =>
  new BadRequestException({
    code: BOARD_ERROR_CODES.INVALID_BOARD_TEMPLATE,
    message: 'The referenced board is not a valid template',
  });

export const invalidMemberIdentifier = (): BadRequestException =>
  new BadRequestException({
    code: BOARD_ERROR_CODES.INVALID_MEMBER_IDENTIFIER,
    message: 'Provide either a userId or an email to add a member',
  });

export const userNotFound = (): NotFoundException =>
  new NotFoundException({
    code: BOARD_ERROR_CODES.USER_NOT_FOUND,
    message: 'User not found',
  });

export const memberNotFound = (): NotFoundException =>
  new NotFoundException({
    code: BOARD_ERROR_CODES.MEMBER_NOT_FOUND,
    message: 'Member not found on this board',
  });

export const memberAlreadyExists = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.MEMBER_ALREADY_EXISTS,
    message: 'User is already a member of this board',
  });

export const pendingInviteExists = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.PENDING_INVITE_EXISTS,
    message: 'A pending invite already exists for this email',
  });

export const ownerCannotLeave = (): ConflictException =>
  new ConflictException({
    code: BOARD_ERROR_CODES.OWNER_CANNOT_LEAVE,
    message: 'The owner cannot be removed from the board',
  });

export const invalidRoleTransfer = (): BadRequestException =>
  new BadRequestException({
    code: BOARD_ERROR_CODES.INVALID_ROLE_TRANSFER,
    message: 'Cannot change the role of the board owner',
  });

export const invalidCursor = (): BadRequestException =>
  new BadRequestException({
    code: BOARD_ERROR_CODES.INVALID_CURSOR,
    message: 'Invalid pagination cursor',
  });
