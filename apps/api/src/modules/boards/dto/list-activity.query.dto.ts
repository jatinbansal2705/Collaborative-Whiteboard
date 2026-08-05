import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT } from '../board.constants';

export class ListActivityQueryDto {
  @ApiPropertyOptional({ description: 'Cursor to older activity entries' })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiPropertyOptional({
    default: ACTIVITY_DEFAULT_LIMIT,
    maximum: ACTIVITY_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ACTIVITY_MAX_LIMIT)
  limit?: number;
}
