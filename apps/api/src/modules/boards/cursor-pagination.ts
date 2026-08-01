import type { Prisma } from '../../generated/prisma/client';

export type BoardSortBy = 'updatedAt' | 'createdAt' | 'title' | 'memberCount';
export type BoardSortOrder = 'asc' | 'desc';

export interface DecodedCursor {
  value: string | number;
  id: string;
}

export interface CursorPageInfo {
  nextCursor: string | null;
  prevCursor: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CursorPage<T> {
  items: T[];
  pageInfo: CursorPageInfo;
}

const DATE_FIELDS: readonly BoardSortBy[] = ['updatedAt', 'createdAt'];

export function encodeCursor(value: string | number, id: string): string {
  const serialized = JSON.stringify([value, id]);
  return Buffer.from(serialized, 'utf8').toString('base64url');
}

export function decodeCursor(
  cursor: string | undefined,
  sortBy: BoardSortBy,
): DecodedCursor | null {
  if (cursor === undefined || cursor === '') {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(payload) || payload.length !== 2) {
      return null;
    }
    const rawValue: unknown = payload[0];
    const id: unknown = payload[1];
    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }
    if (sortBy === 'memberCount') {
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        return null;
      }
      return { value: rawValue, id };
    }
    if (sortBy === 'title') {
      if (typeof rawValue !== 'string') {
        return null;
      }
      return { value: rawValue, id };
    }
    if (typeof rawValue !== 'string' || Number.isNaN(Date.parse(rawValue))) {
      return null;
    }
    return { value: rawValue, id };
  } catch {
    return null;
  }
}

export function buildCursorWhere(
  sortBy: BoardSortBy,
  order: BoardSortOrder,
  cursor: DecodedCursor,
): Prisma.BoardWhereInput {
  const comparator: 'gt' | 'lt' = order === 'asc' ? 'gt' : 'lt';
  const value = cursorValue(sortBy, cursor.value);
  return {
    OR: [
      { [sortBy]: { [comparator]: value } },
      { [sortBy]: { equals: value }, id: { [comparator]: cursor.id } },
    ],
  };
}

export function buildBoardOrderBy(
  sortBy: BoardSortBy,
  order: BoardSortOrder,
): Prisma.BoardOrderByWithRelationInput {
  return { [sortBy]: order, id: order };
}

export function sortableCursorValue(
  sortBy: BoardSortBy,
  value: unknown,
): string | number {
  if (DATE_FIELDS.includes(sortBy)) {
    return new Date(value as string).toISOString();
  }
  if (sortBy === 'memberCount') {
    return value as number;
  }
  return value as string;
}

function cursorValue(
  sortBy: BoardSortBy,
  raw: string | number,
): string | number | Date {
  if (DATE_FIELDS.includes(sortBy)) {
    return new Date(raw);
  }
  return raw;
}
