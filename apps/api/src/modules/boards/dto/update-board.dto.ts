import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BOARD_TITLE_MAX_LENGTH } from '../board.constants';

export class UpdateBoardDto {
  @ApiPropertyOptional({ example: 'Q3 Roadmap v2' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(BOARD_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: 'Public thumbnail URL for the board card',
    example: 'https://res.cloudinary.com/.../thumb.png',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: 'Replace the canvas document payload',
    type: Object,
  })
  @IsOptional()
  @Type(() => Object)
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Admins only; ignored for regular users',
  })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;
}
