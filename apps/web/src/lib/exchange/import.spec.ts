import { describe, expect, it } from 'vitest';
import {
  documentFromElements,
  type WhiteboardElement,
} from '@whiteboard/shared';
import {
  parseDocumentJson,
  parsePath,
  parseSvgImport,
} from '@/lib/exchange/import';

function makeRect(
  overrides: Partial<WhiteboardElement> = {},
): WhiteboardElement {
  const now = Date.now();
  return {
    id: 'r1',
    type: 'rectangle',
    version: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    angle: 0,
    opacity: 1,
    strokeColor: '#0f172a',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    ...overrides,
  } as WhiteboardElement;
}

describe('parseDocumentJson', () => {
  it('accepts an exported board document', () => {
    const document = documentFromElements([makeRect()]);
    const json = JSON.stringify({
      app: 'collaborative-whiteboard',
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      elements: document.elements,
    });
    const result = parseDocumentJson(json);
    expect(result.ok).toBe(true);
    expect(result.document?.elements).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    const result = parseDocumentJson('{ nope');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('not valid JSON');
  });

  it('rejects an unsupported schema version', () => {
    const result = parseDocumentJson('{"schemaVersion": 99, "elements": []}');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Unsupported schema version');
  });

  it('rejects a payload that is not a board document', () => {
    const result = parseDocumentJson('{"elements": [{"id": 1}]}');
    expect(result.ok).toBe(false);
  });
});

describe('parseSvgImport', () => {
  it('converts a rect into a rectangle element', () => {
    const elements = parseSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect x="10" y="20" width="50" height="30" fill="red"/></svg>',
    );
    expect(elements).toHaveLength(1);
    const element = elements[0] as Extract<
      WhiteboardElement,
      { type: 'rectangle' }
    >;
    expect(element.type).toBe('rectangle');
    expect(element.x).toBe(10);
    expect(element.y).toBe(20);
    expect(element.width).toBe(50);
    expect(element.height).toBe(30);
    expect(element.fillColor).toBe('red');
  });

  it('converts a circle into an ellipse element', () => {
    const elements = parseSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="100" cy="100" r="40"/></svg>',
    );
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('ellipse');
    const element = elements[0] as Extract<
      WhiteboardElement,
      { type: 'ellipse' }
    >;
    expect(element.x).toBe(60);
    expect(element.y).toBe(60);
    expect(element.width).toBe(80);
    expect(element.height).toBe(80);
  });

  it('converts a line into a pen element', () => {
    const elements = parseSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="40" y2="60" stroke="black"/></svg>',
    );
    expect(elements).toHaveLength(1);
    const element = elements[0] as Extract<WhiteboardElement, { type: 'pen' }>;
    expect(element.type).toBe('pen');
    expect(element.points).toHaveLength(2);
    expect(element.pressures).toHaveLength(2);
  });

  it('converts text into a text element', () => {
    const elements = parseSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><text x="5" y="20" font-size="18">Hi</text></svg>',
    );
    expect(elements).toHaveLength(1);
    const element = elements[0] as Extract<WhiteboardElement, { type: 'text' }>;
    expect(element.type).toBe('text');
    expect(element.paragraphs[0].runs[0].text).toBe('Hi');
    expect(element.fontSize).toBe(18);
  });

  it('converts a polyline into a pen element', () => {
    const elements = parseSvgImport(
      '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="0,0 10,10 20,5"/></svg>',
    );
    expect(elements).toHaveLength(1);
    const element = elements[0] as Extract<WhiteboardElement, { type: 'pen' }>;
    expect(element.points).toHaveLength(3);
  });

  it('returns no elements for a malformed svg', () => {
    expect(parseSvgImport('<svg><bogus/></svg>')).toEqual([]);
  });
});

describe('parsePath', () => {
  it('parses straight segments', () => {
    const points = parsePath('M 0 0 L 10 0 L 10 10 Z');
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ]);
  });

  it('parses relative moveto lines', () => {
    const points = parsePath('m 5 5 l 10 0 l 0 10');
    expect(points[0]).toEqual({ x: 5, y: 5 });
    expect(points[1]).toEqual({ x: 15, y: 5 });
    expect(points[2]).toEqual({ x: 15, y: 15 });
  });

  it('samples cubic curves', () => {
    const points = parsePath('M 0 0 C 0 100 100 100 100 0');
    expect(points.length).toBeGreaterThan(10);
    expect(points[points.length - 1]).toEqual({ x: 100, y: 0 });
  });

  it('returns an empty array for empty input', () => {
    expect(parsePath(null)).toEqual([]);
    expect(parsePath('')).toEqual([]);
  });
});
