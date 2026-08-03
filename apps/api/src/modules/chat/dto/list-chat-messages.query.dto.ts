import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  CHAT_LIST_DEFAULT_LIMIT,
  CHAT_LIST_MAX_LIMIT,
} from '../chat.constants';

export class ListChatMessagesQueryDto {
  @ApiPropertyOptional({ description: 'Cursor to older messages (keyset)' })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({
    default: CHAT_LIST_DEFAULT_LIMIT,
    maximum: CHAT_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHAT_LIST_MAX_LIMIT)
  limit?: number;
}
