import {
  buildBoardOrderBy,
  buildCursorWhere,
  decodeCursor,
  encodeCursor,
  sortableCursorValue,
} from './cursor-pagination';

describe('cursor-pagination', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('round-trips a string cursor', () => {
      const encoded = encodeCursor('Q3 Roadmap', 'board-1');
      expect(decodeCursor(encoded, 'title')).toEqual({
        value: 'Q3 Roadmap',
        id: 'board-1',
      });
    });

    it('round-trips a numeric cursor', () => {
      const encoded = encodeCursor(7, 'board-2');
      expect(decodeCursor(encoded, 'memberCount')).toEqual({
        value: 7,
        id: 'board-2',
      });
    });

    it('round-trips a date cursor for date sort fields', () => {
      const iso = '2026-07-01T00:00:00.000Z';
      const encoded = encodeCursor(iso, 'board-3');
      expect(decodeCursor(encoded, 'updatedAt')).toEqual({
        value: iso,
        id: 'board-3',
      });
    });

    it('rejects malformed cursors', () => {
      expect(decodeCursor('not-base64-json', 'title')).toBeNull();
      expect(decodeCursor('', 'title')).toBeNull();
      expect(decodeCursor(undefined, 'title')).toBeNull();
    });

    it('rejects cursors with a wrong value type for the sort field', () => {
      const numeric = encodeCursor(7, 'board-1');
      expect(decodeCursor(numeric, 'title')).toBeNull();

      const string = encodeCursor('seven', 'board-1');
      expect(decodeCursor(string, 'memberCount')).toBeNull();
    });

    it('rejects date cursors that are not valid dates', () => {
      const encoded = encodeCursor('not-a-date', 'board-1');
      expect(decodeCursor(encoded, 'createdAt')).toBeNull();
    });

    it('rejects payloads that are not length-2 arrays', () => {
      const short = Buffer.from(JSON.stringify(['only-value'])).toString(
        'base64url',
      );
      expect(decodeCursor(short, 'title')).toBeNull();
    });
  });

  describe('buildCursorWhere', () => {
    it('builds a gt query for ascending order', () => {
      const where = buildCursorWhere('title', 'asc', {
        value: 'Q3',
        id: 'board-1',
      });
      expect(where).toEqual({
        OR: [
          { title: { gt: 'Q3' } },
          { title: { equals: 'Q3' }, id: { gt: 'board-1' } },
        ],
      });
    });

    it('builds a lt query for descending order', () => {
      const where = buildCursorWhere('updatedAt', 'desc', {
        value: '2026-07-01T00:00:00.000Z',
        id: 'board-1',
      });
      expect(where).toEqual({
        OR: [
          { updatedAt: { lt: new Date('2026-07-01T00:00:00.000Z') } },
          {
            updatedAt: { equals: new Date('2026-07-01T00:00:00.000Z') },
            id: { lt: 'board-1' },
          },
        ],
      });
    });

    it('keeps numeric cursors numeric for memberCount', () => {
      const where = buildCursorWhere('memberCount', 'asc', {
        value: 5,
        id: 'board-1',
      });
      expect(where).toEqual({
        OR: [
          { memberCount: { gt: 5 } },
          { memberCount: { equals: 5 }, id: { gt: 'board-1' } },
        ],
      });
    });
  });

  describe('buildBoardOrderBy', () => {
    it('orders by the sort field then id', () => {
      expect(buildBoardOrderBy('title', 'desc')).toEqual({
        title: 'desc',
        id: 'desc',
      });
      expect(buildBoardOrderBy('memberCount', 'asc')).toEqual({
        memberCount: 'asc',
        id: 'asc',
      });
    });
  });

  describe('sortableCursorValue', () => {
    it('serializes date fields to ISO strings', () => {
      const date = new Date('2026-07-01T00:00:00.000Z');
      expect(sortableCursorValue('updatedAt', date)).toBe(
        '2026-07-01T00:00:00.000Z',
      );
      expect(sortableCursorValue('createdAt', '2026-07-01T00:00:00.000Z')).toBe(
        '2026-07-01T00:00:00.000Z',
      );
    });

    it('keeps numeric and string fields as-is', () => {
      expect(sortableCursorValue('memberCount', 3)).toBe(3);
      expect(sortableCursorValue('title', 'Board')).toBe('Board');
    });
  });
});
