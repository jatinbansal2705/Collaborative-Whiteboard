/**
 * Keyset (cursor) pagination over `createdAt` with the row id as tiebreaker.
 * The cursor serializes `[ISO-string, id]` into base64url, mirroring the
 * board-list cursor (ADR-0014) but without a sort-field dimension: chat and
 * notification feeds always page newest-first on `createdAt desc`.
 */

export interface DecodedDateCursor {
  value: string;
  id: string;
}

export interface DateCursorClause {
  OR: [
    { createdAt: { gt?: Date; lt?: Date } },
    { createdAt: { equals: Date }; id: { gt?: string; lt?: string } },
  ];
}

export function encodeDateCursor(value: Date, id: string): string {
  const serialized = JSON.stringify([value.toISOString(), id]);
  return Buffer.from(serialized, 'utf8').toString('base64url');
}

export function decodeDateCursor(cursor: string): DecodedDateCursor | null {
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
    if (typeof rawValue !== 'string' || Number.isNaN(Date.parse(rawValue))) {
      return null;
    }
    return { value: rawValue, id };
  } catch {
    return null;
  }
}

export function buildDateCursorWhere(
  order: 'asc' | 'desc',
  cursor: DecodedDateCursor,
): DateCursorClause {
  const comparator = order === 'asc' ? 'gt' : 'lt';
  const value = new Date(cursor.value);
  return {
    OR: [
      { createdAt: { [comparator]: value } },
      { createdAt: { equals: value }, id: { [comparator]: cursor.id } },
    ],
  };
}
