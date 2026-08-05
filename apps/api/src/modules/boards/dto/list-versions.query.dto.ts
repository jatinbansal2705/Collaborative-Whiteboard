import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { VERSIONS_DEFAULT_LIMIT, VERSIONS_MAX_LIMIT } from '../board.constants';

export class ListVersionsQueryDto {
  @ApiPropertyOptional({ description: 'Cursor to older versions' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: VERSIONS_DEFAULT_LIMIT,
    maximum: VERSIONS_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VERSIONS_MAX_LIMIT)
  limit?: number;
}
