import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { BOARD_TITLE_MAX_LENGTH } from '../board.constants';

export class CreateBoardDto {
  @ApiPropertyOptional({ example: 'Q3 Roadmap' })
  @ValidateIf((dto: CreateBoardDto) => dto.templateId === undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(BOARD_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: 'Id of a template board to deep-copy into the new board',
    example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Initial canvas document payload',
    type: Object,
    example: { elements: [], appState: {} },
  })
  @IsOptional()
  @Type(() => Object)
  @IsObject()
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Admins only; ignored for regular users' })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;
}
