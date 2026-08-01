import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  Board,
  BoardMemberRole,
  BoardStatus,
  Prisma,
} from '../../../generated/prisma/client';
import type { CursorPageInfo } from '../cursor-pagination';

export class BoardSummaryDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: 'Q3 Roadmap' })
  title!: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../thumb.png' })
  thumbnailUrl!: string | null;

  @ApiProperty({ example: false })
  isTemplate!: boolean;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty({ example: 'ACTIVE' })
  status!: BoardStatus;

  @ApiProperty({ example: 3 })
  memberCount!: number;

  @ApiProperty({ example: false })
  isFavourite!: boolean;

  @ApiProperty({ example: 'EDITOR' })
  myRole!: BoardMemberRole;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  createdById!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BoardDetailDto extends BoardSummaryDto {
  @ApiProperty({
    description: 'Canvas document payload (JSON)',
    example: { elements: [], appState: {} },
    type: Object,
  })
  data!: Prisma.JsonValue;
}

export class BoardListMetaDto {
  @ApiProperty({ type: 'boolean', example: false })
  hasNextPage!: boolean;

  @ApiProperty({ type: 'boolean', example: false })
  hasPrevPage!: boolean;

  @ApiProperty({ type: 'string', nullable: true, example: 'b3B0aW9u...' })
  nextCursor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  prevCursor!: string | null;
}

export class BoardListResponseDto {
  @ApiProperty({ type: BoardSummaryDto, isArray: true })
  data!: BoardSummaryDto[];

  @ApiProperty({ type: BoardListMetaDto })
  meta!: BoardListMetaDto;
}

export class BoardDeletedDto {
  @ApiProperty({ example: true })
  deleted!: boolean;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;
}

export class FavouriteStatusDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  boardId!: string;

  @ApiProperty({ example: true })
  isFavourite!: boolean;
}

export interface BoardListSourceRow {
  board: Board;
  isFavourite: boolean;
  myRole: BoardMemberRole;
}

export function toBoardSummary(row: BoardListSourceRow): BoardSummaryDto {
  return {
    id: row.board.id,
    title: row.board.title,
    thumbnailUrl: row.board.thumbnailUrl,
    isTemplate: row.board.isTemplate,
    isArchived: row.board.isArchived,
    status: row.board.status,
    memberCount: row.board.memberCount,
    isFavourite: row.isFavourite,
    myRole: row.myRole,
    createdById: row.board.createdById,
    createdAt: row.board.createdAt,
    updatedAt: row.board.updatedAt,
  };
}

export function toBoardDetail(
  board: Board,
  myRole: BoardMemberRole,
  isFavourite = false,
): BoardDetailDto {
  return {
    id: board.id,
    title: board.title,
    thumbnailUrl: board.thumbnailUrl,
    isTemplate: board.isTemplate,
    isArchived: board.isArchived,
    status: board.status,
    memberCount: board.memberCount,
    isFavourite,
    myRole,
    createdById: board.createdById,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    data: board.data,
  };
}

export function toPageInfo(pageInfo: CursorPageInfo): BoardListMetaDto {
  return {
    hasNextPage: pageInfo.hasNextPage,
    hasPrevPage: pageInfo.hasPrevPage,
    nextCursor: pageInfo.nextCursor,
    prevCursor: pageInfo.prevCursor,
  };
}
