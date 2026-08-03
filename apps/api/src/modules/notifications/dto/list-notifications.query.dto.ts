import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  NOTIFICATIONS_LIST_DEFAULT_LIMIT,
  NOTIFICATIONS_LIST_MAX_LIMIT,
} from '../notifications.constants';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Cursor to older notifications' })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({
    default: NOTIFICATIONS_LIST_DEFAULT_LIMIT,
    maximum: NOTIFICATIONS_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_LIST_MAX_LIMIT)
  limit?: number;
}
