import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BOARD_TITLE_MAX_LENGTH } from '../board.constants';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Team Retro Board' })
  @IsString()
  @MinLength(1)
  @MaxLength(BOARD_TITLE_MAX_LENGTH)
  title!: string;

  @ApiPropertyOptional({
    description: 'Template canvas document payload',
    type: Object,
    example: { elements: [], appState: {} },
  })
  @IsOptional()
  @Type(() => Object)
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../thumb.png' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  thumbnailUrl!: string;
}
