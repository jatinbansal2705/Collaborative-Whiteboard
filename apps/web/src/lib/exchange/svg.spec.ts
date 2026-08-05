import { describe, expect, it } from 'vitest';
import {
  createEmptyWhiteboardDocument,
  documentFromElements,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { documentToSvg, escapeXml } from '@/lib/exchange/svg';

function makeElement(overrides: Partial<WhiteboardElement>): WhiteboardElement {
  const now = Date.now();
  return {
    id: 'e1',
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

describe('escapeXml', () => {
  it('escapes XML-sensitive characters', () => {
    expect(escapeXml('<a href="x">& \'q\'')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp; &apos;q&apos;',
    );
  });
});

describe('documentToSvg', () => {
  it('emits an svg root with the content bounds', () => {
    const document = documentFromElements([
      makeElement({ x: 10, y: 20, width: 100, height: 80 }),
    ]);
    const svg = documentToSvg(document, { padding: 8 });
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="116"');
    expect(svg).toContain('height="96"');
    expect(svg).toContain('viewBox="2 12 116 96"');
  });

  it('renders each shape type', () => {
    const document = documentFromElements([
      makeElement({ type: 'rectangle' }),
      makeElement({ type: 'ellipse' }),
      makeElement({ type: 'triangle' }),
      makeElement({ type: 'diamond' }),
      makeElement({
        type: 'line',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
        ],
      }),
    ]);
    const svg = documentToSvg(document);
    expect(svg).toContain('<rect');
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<line');
  });

  it('renders text and sticky elements', () => {
    const document = documentFromElements([
      makeElement({
        type: 'text',
        paragraphs: [
          { runs: [{ text: 'Hello' }], align: 'left', listType: null },
        ],
        fontFamily: 'Inter',
        fontSize: 16,
        lineHeight: 1.2,
        color: '#111827',
        autoWidth: false,
      }),
      makeElement({ type: 'sticky', text: 'Note', fontSize: 16 }),
    ]);
    const svg = documentToSvg(document);
    expect(svg).toContain('<text');
    expect(svg).toContain('Hello');
    expect(svg).toContain('Note');
  });

  it('renders emoji icons as text', () => {
    const document = documentFromElements([
      makeElement({ type: 'icon', kind: 'emoji', value: '🎉', size: 48 }),
    ]);
    const svg = documentToSvg(document);
    expect(svg).toContain('🎉');
    expect(svg).toContain('text-anchor="middle"');
  });

  it('renders arrows and connectors with a head polygon', () => {
    const document = documentFromElements([
      makeElement({
        type: 'arrow',
        points: [
          { x: 0, y: 0 },
          { x: 80, y: 0 },
        ],
      }),
      makeElement({
        type: 'connector',
        start: { x: 0, y: 0 },
        end: { x: 80, y: 0 },
        startElementId: null,
        startHandle: null,
        endElementId: null,
        endHandle: null,
        points: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
          { x: 80, y: 0 },
        ],
        arrowEnd: true,
      }),
    ]);
    const svg = documentToSvg(document);
    expect(svg.match(/<polygon/g)?.length).toBe(2);
  });

  it('renders freehand strokes with round caps', () => {
    const document = documentFromElements([
      makeElement({
        type: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        pressures: [0.5, 0.9],
      }),
    ]);
    const svg = documentToSvg(document);
    expect(svg).toContain('stroke-linecap="round"');
  });

  it('renders bezier curves as a path', () => {
    const document = documentFromElements([
      makeElement({
        type: 'bezier',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: -10 },
          { x: 30, y: 0 },
        ],
      }),
    ]);
    const svg = documentToSvg(document);
    expect(svg).toContain('<path d="M 0 0 C 10 10 20 -10 30 0"');
  });

  it('skips hidden elements', () => {
    const document = documentFromElements([makeElement({ hidden: true })]);
    const svg = documentToSvg(document);
    expect(svg).not.toContain('<rect');
  });

  it('paints the background rect when configured', () => {
    const document = createEmptyWhiteboardDocument();
    const svg = documentToSvg(document, { background: '#ffffff', padding: 8 });
    expect(svg).toContain('fill="#ffffff"');
  });

  it('applies rotation transforms', () => {
    const document = documentFromElements([makeElement({ angle: 45 })]);
    const svg = documentToSvg(document);
    expect(svg).toContain('rotate(45)');
  });
});
