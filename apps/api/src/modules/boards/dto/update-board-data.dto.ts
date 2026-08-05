import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { VERSION_NOTE_MAX_LENGTH } from '../board.constants';

export class UpdateBoardDataDto {
  @ApiProperty({
    description:
      'Full whiteboard document payload ({ schemaVersion, elements })',
    type: Object,
  })
  @Type(() => Object)
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'The server revision this document is based on; omitted for blind saves (import/restore)',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseRevision?: number;
}

export class CreateVersionDto {
  @ApiPropertyOptional({
    description: 'Optional note describing this manual version',
    example: 'Milestone checkpoint',
    maxLength: VERSION_NOTE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(VERSION_NOTE_MAX_LENGTH)
  note?: string;
}
