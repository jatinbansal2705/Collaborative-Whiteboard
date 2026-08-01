import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BOARD_LIST_DEFAULT_LIMIT,
  BOARD_LIST_MAX_LIMIT,
  BOARD_SEARCH_MAX_LENGTH,
} from '../board.constants';

export enum BoardTab {
  RECENT = 'recent',
  SHARED = 'shared',
  FAVOURITED = 'favourited',
}

export enum BoardSortByValue {
  UPDATED_AT = 'updatedAt',
  CREATED_AT = 'createdAt',
  TITLE = 'title',
  MEMBER_COUNT = 'memberCount',
}

export enum BoardSortOrderValue {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListBoardsQueryDto {
  @ApiPropertyOptional({ enum: BoardTab, default: BoardTab.RECENT })
  @IsOptional()
  @IsEnum(BoardTab)
  tab?: BoardTab;

  @ApiPropertyOptional({
    example: 'roadmap',
    maxLength: BOARD_SEARCH_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(BOARD_SEARCH_MAX_LENGTH)
  search?: string;

  @ApiPropertyOptional({
    enum: BoardSortByValue,
    default: BoardSortByValue.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(BoardSortByValue)
  sortBy?: BoardSortByValue;

  @ApiPropertyOptional({
    enum: BoardSortOrderValue,
    default: BoardSortOrderValue.DESC,
  })
  @IsOptional()
  @IsEnum(BoardSortOrderValue)
  order?: BoardSortOrderValue;

  @ApiPropertyOptional({ example: 'b3B0aW9u...' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: BOARD_LIST_DEFAULT_LIMIT,
    maximum: BOARD_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BOARD_LIST_MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Restrict to archived boards (omitted default excludes archived)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({ description: 'Restrict to template boards' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  template?: boolean;

  @ApiPropertyOptional({
    description: 'Restrict to boards owned by the caller',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  ownedByMe?: boolean;
}
