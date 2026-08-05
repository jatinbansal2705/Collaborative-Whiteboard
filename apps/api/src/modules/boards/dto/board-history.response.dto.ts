import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  BoardActivityType,
  BoardVersionKind,
  Prisma,
} from '../../../generated/prisma/client';
import type { CursorPageInfo } from '../cursor-pagination';
import type {
  ActivityListRow,
  VersionListRow,
} from '../board-history.repository';
import { BoardListMetaDto } from './board-response.dto';

export class BoardAuthorDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiPropertyOptional({ example: 'Ava Chen' })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../avatar.png' })
  avatarUrl!: string | null;
}

export class BoardVersionDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: 12 })
  versionNo!: number;

  @ApiProperty({ enum: ['AUTO', 'MANUAL'], example: 'AUTO' })
  kind!: BoardVersionKind;

  @ApiPropertyOptional({ example: 'Milestone checkpoint' })
  note!: string | null;

  @ApiProperty({ example: 1 })
  schemaVersion!: number;

  @ApiProperty({ example: 42 })
  elementCount!: number;

  @ApiProperty({ type: BoardAuthorDto })
  createdBy!: BoardAuthorDto;

  @ApiProperty()
  createdAt!: Date;
}

export class BoardVersionDetailDto extends BoardVersionDto {
  @ApiProperty({ description: 'Snapshot document payload', type: Object })
  data!: Prisma.JsonValue;
}

export class BoardVersionListResponseDto {
  @ApiProperty({ type: BoardVersionDto, isArray: true })
  data!: BoardVersionDto[];

  @ApiProperty({ type: BoardListMetaDto })
  meta!: BoardListMetaDto;
}

export class BoardActivityDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({
    enum: [
      'CREATE',
      'EDIT',
      'VERSION_RESTORE',
      'MANUAL_VERSION',
      'ARCHIVE',
      'DELETE',
      'RESTORE',
    ],
    example: 'EDIT',
  })
  type!: BoardActivityType;

  @ApiPropertyOptional({ example: 13 })
  versionNo!: number | null;

  @ApiProperty({ type: Object })
  details!: Prisma.JsonValue;

  @ApiProperty({ type: BoardAuthorDto })
  actor!: BoardAuthorDto;

  @ApiProperty()
  createdAt!: Date;
}

export class BoardActivityListResponseDto {
  @ApiProperty({ type: BoardActivityDto, isArray: true })
  data!: BoardActivityDto[];

  @ApiProperty({ type: BoardListMetaDto })
  meta!: BoardListMetaDto;
}

export class SaveBoardDataResponseDto {
  @ApiProperty({ example: 13 })
  revision!: number;
}

export class BoardDataResponseDto {
  @ApiProperty({ example: 13 })
  revision!: number;

  @ApiProperty({ description: 'Current canvas document payload', type: Object })
  data!: Prisma.JsonValue;
}

export function toBoardAuthor(author: {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}): BoardAuthorDto {
  return {
    id: author.id,
    name: author.name,
    avatarUrl: author.avatarUrl,
  };
}

export function toBoardVersion(
  row: VersionListRow,
  options: { includeData: true },
): BoardVersionDetailDto;
export function toBoardVersion(
  row: VersionListRow,
  options?: { includeData?: false },
): BoardVersionDto;
export function toBoardVersion(
  row: VersionListRow,
  options: { includeData?: boolean } = {},
): BoardVersionDto | BoardVersionDetailDto {
  const base = {
    id: row.id,
    versionNo: row.versionNo,
    kind: row.kind,
    note: row.note,
    schemaVersion: row.schemaVersion,
    elementCount: row.elementCount,
    createdBy: toBoardAuthor(row.createdBy),
    createdAt: row.createdAt,
  };
  if (options.includeData === true) {
    return { ...base, data: row.data };
  }
  return base;
}

export function toBoardActivity(row: ActivityListRow): BoardActivityDto {
  return {
    id: row.id,
    type: row.type,
    versionNo: row.versionNo,
    details: row.details,
    actor: toBoardAuthor(row.actor),
    createdAt: row.createdAt,
  };
}

export function toHistoryPageInfo(pageInfo: CursorPageInfo): BoardListMetaDto {
  return {
    hasNextPage: pageInfo.hasNextPage,
    hasPrevPage: pageInfo.hasPrevPage,
    nextCursor: pageInfo.nextCursor,
    prevCursor: pageInfo.prevCursor,
  };
}
