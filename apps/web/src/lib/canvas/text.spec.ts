import type { TextParagraph } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import { LINK_COLOR } from '@/lib/canvas/constants';
import {
  computeStickySize,
  computeTextElementSize,
  htmlToRichText,
  layoutRichText,
  normalizeParagraphs,
  richTextToHtml,
  type TextMeasurer,
} from '@/lib/canvas/text';

/** Deterministic measurer: 10px per character. */
const measurer: TextMeasurer = {
  measure: (text: string) => text.length * 10,
};

const paragraph = (
  text: string,
  runs: TextParagraph['runs'] = [{ text }],
): TextParagraph => ({ runs, align: 'left', listType: null });

const layoutOpts = {
  fontFamily: 'Inter',
  fontSize: 10,
  lineHeight: 1.2,
  color: '#1f2937',
  maxWidth: 100,
  wrap: true,
};

describe('rich text layout', () => {
  it('wraps words at the maximum width', () => {
    const layout = layoutRichText(
      [paragraph('aa bb cc')],
      { ...layoutOpts, maxWidth: 45 },
      measurer,
    );
    expect(layout.lines).toHaveLength(3);
    expect(layout.height).toBeCloseTo(36);
  });

  it('lays a single word on one line even when it overflows', () => {
    const layout = layoutRichText([paragraph('toolong')], layoutOpts, measurer);
    expect(layout.lines).toHaveLength(1);
  });

  it('centers lines within the wrap width', () => {
    const layout = layoutRichText(
      [{ runs: [{ text: 'hello' }], align: 'center', listType: null }],
      layoutOpts,
      measurer,
    );
    expect(layout.lines[0]?.segments[0]?.x).toBeCloseTo(25);
  });

  it('right-aligns lines within the wrap width', () => {
    const layout = layoutRichText(
      [{ runs: [{ text: 'hello' }], align: 'right', listType: null }],
      layoutOpts,
      measurer,
    );
    expect(layout.lines[0]?.segments[0]?.x).toBeCloseTo(50);
  });

  it('assigns sequential prefixes to numbered lists', () => {
    const layout = layoutRichText(
      [
        { runs: [{ text: 'a' }], align: 'left', listType: 'numbered' },
        { runs: [{ text: 'b' }], align: 'left', listType: 'numbered' },
      ],
      { ...layoutOpts, maxWidth: 0, wrap: false },
      measurer,
    );
    expect(layout.lines[0]?.segments[0]?.text.startsWith('1.')).toBe(true);
    expect(layout.lines[1]?.segments[0]?.text.startsWith('2.')).toBe(true);
  });

  it('preserves run formatting flags and colors', () => {
    const layout = layoutRichText(
      [
        {
          runs: [
            { text: 'a', bold: true },
            { text: 'b', italic: true },
            { text: 'c', underline: true },
          ],
          align: 'left',
          listType: null,
        },
      ],
      { ...layoutOpts, maxWidth: 0, wrap: false },
      measurer,
    );
    const segments = layout.lines[0]?.segments ?? [];
    expect(segments[0]).toMatchObject({ text: 'a', bold: true });
    expect(segments[1]).toMatchObject({ text: 'b', italic: true });
    expect(segments[2]).toMatchObject({ text: 'c', underline: true });
  });

  it('renders links in the link color', () => {
    const layout = layoutRichText(
      [
        {
          runs: [{ text: 'x', link: 'https://example.com' }],
          align: 'left',
          listType: null,
        },
      ],
      { ...layoutOpts, maxWidth: 0, wrap: false },
      measurer,
    );
    expect(layout.lines[0]?.segments[0]?.color).toBe(LINK_COLOR);
  });

  it('sizes auto-width text to hug its content', () => {
    const size = computeTextElementSize(
      [paragraph('hello')],
      {
        fontFamily: 'Inter',
        fontSize: 10,
        lineHeight: 1.2,
        color: '#1f2937',
        autoWidth: true,
        width: 200,
      },
      measurer,
    );
    expect(size).toEqual({ width: 50, height: 12 });
  });

  it('keeps a fixed width while the height grows to fit wrapping', () => {
    const size = computeTextElementSize(
      [paragraph('hello world')],
      {
        fontFamily: 'Inter',
        fontSize: 10,
        lineHeight: 1.2,
        color: '#1f2937',
        autoWidth: false,
        width: 40,
      },
      measurer,
    );
    expect(size.width).toBe(40);
    expect(size.height).toBe(24);
  });

  it('sticky notes never shrink below the minimum height', () => {
    expect(computeStickySize('hi', 160, 16, measurer)).toEqual({
      width: 160,
      height: 80,
    });
  });

  it('sticky notes grow to fit wrapped text', () => {
    const size = computeStickySize(
      'aaaa bbbb cccc dddd eeee',
      160,
      16,
      measurer,
    );
    expect(size.width).toBe(160);
    expect(size.height).toBeGreaterThan(80);
  });
});

describe('rich text HTML interchange', () => {
  it('serializes plain and formatted runs', () => {
    const html = richTextToHtml([
      {
        runs: [
          { text: 'Hello ' },
          { text: 'world', bold: true },
          { text: '!', italic: true, underline: true },
        ],
        align: 'left',
        listType: null,
      },
    ]);
    expect(html).toBe('<p>Hello <b>world</b><u><i>!</i></u></p>');
  });

  it('serializes links and escapes text', () => {
    const html = richTextToHtml([
      {
        runs: [{ text: 'a & b <c>', link: 'https://a.com/"q"' }],
        align: 'left',
        listType: null,
      },
    ]);
    expect(html).toBe(
      '<p><a href="https://a.com/&quot;q&quot;">a &amp; b &lt;c&gt;</a></p>',
    );
  });

  it('groups consecutive same-type list items', () => {
    const html = richTextToHtml([
      { runs: [{ text: 'a' }], align: 'left', listType: 'bullet' },
      { runs: [{ text: 'b' }], align: 'left', listType: 'bullet' },
    ]);
    expect(html).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('round-trips paragraphs through htmlToRichText', () => {
    const paragraphs: TextParagraph[] = [
      {
        runs: [{ text: 'Hello ' }, { text: 'world', bold: true }],
        align: 'left',
        listType: null,
      },
      {
        runs: [{ text: 'a' }, { text: 'b', link: 'https://x.dev' }],
        align: 'center',
        listType: null,
      },
      { runs: [{ text: 'one' }], align: 'left', listType: 'numbered' },
      { runs: [{ text: 'two' }], align: 'left', listType: 'numbered' },
    ];
    expect(htmlToRichText(richTextToHtml(paragraphs))).toEqual(paragraphs);
  });

  it('preserves line breaks as embedded newlines', () => {
    const parsed = htmlToRichText('<p>a<br>b</p>');
    expect(parsed[0]?.runs.map((run) => run.text).join('')).toBe('a\nb');
  });

  it('falls back to an empty paragraph for empty input', () => {
    expect(htmlToRichText('')).toEqual([
      { runs: [{ text: '' }], align: 'left', listType: null },
    ]);
  });

  it('normalizes trailing whitespace and empty trailing blocks', () => {
    const normalized = normalizeParagraphs([
      { runs: [{ text: 'a   ' }], align: 'left', listType: null },
      { runs: [{ text: ' ' }], align: 'left', listType: null },
    ]);
    expect(normalized).toEqual([
      { runs: [{ text: 'a' }], align: 'left', listType: null },
    ]);
  });

  it('never returns zero paragraphs', () => {
    expect(normalizeParagraphs([])).toEqual([
      { runs: [{ text: '' }], align: 'left', listType: null },
    ]);
  });
});
