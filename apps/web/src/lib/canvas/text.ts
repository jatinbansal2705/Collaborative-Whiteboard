import {
  LINK_COLOR,
  STICKY_LINE_HEIGHT,
  STICKY_MIN_HEIGHT,
  STICKY_PADDING,
} from './constants';
import type { TextAlign, TextParagraph, TextRun } from '@whiteboard/shared';

/**
 * Text measurement + rich-text layout (Phase 11). All layout functions are
 * pure; they take an optional `TextMeasurer` so unit tests stay deterministic
 * (jsdom has no canvas). The default measurer falls back to a character-width
 * heuristic when a 2D context is unavailable.
 */

export interface TextMeasureStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

export interface TextMeasurer {
  measure(text: string, style: TextMeasureStyle): number;
}

const AVERAGE_CHAR_WIDTH = 0.6;

function heuristicMeasure(text: string, style: TextMeasureStyle): number {
  return text.length * style.fontSize * AVERAGE_CHAR_WIDTH;
}

const defaultMeasurer: TextMeasurer = {
  measure(text: string, style: TextMeasureStyle): number {
    const ctx = measureContext();
    if (ctx === null) {
      return heuristicMeasure(text, style);
    }
    ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${style.fontSize}px ${style.fontFamily}`;
    return ctx.measureText(text).width;
  },
};

let cachedContext: CanvasRenderingContext2D | null | undefined;

function measureContext(): CanvasRenderingContext2D | null {
  if (cachedContext !== undefined) {
    return cachedContext;
  }
  if (typeof document === 'undefined') {
    cachedContext = null;
    return null;
  }
  const canvas = document.createElement('canvas');
  cachedContext = canvas.getContext('2d');
  return cachedContext;
}

export interface TextSegmentStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link?: string;
  color: string;
  fontFamily: string;
  fontSize: number;
}

export interface TextSegment extends TextSegmentStyle {
  text: string;
  x: number;
  y: number;
  width: number;
}

export interface TextLine {
  segments: TextSegment[];
  width: number;
  height: number;
}

export interface TextLayout {
  lines: TextLine[];
  width: number;
  height: number;
}

export interface TextLayoutOptions {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  /** Wrap width; values <= 0 disable wrapping (auto-width). */
  maxWidth: number;
  wrap: boolean;
}

interface Word {
  text: string;
  style: TextSegmentStyle;
  width: number;
}

type Token =
  | { type: 'word'; text: string; style: TextSegmentStyle }
  | { type: 'space' }
  | { type: 'newline' };

function runStyle(run: TextRun, opts: TextLayoutOptions): TextSegmentStyle {
  return {
    bold: run.bold ?? false,
    italic: run.italic ?? false,
    underline: run.underline ?? false,
    link: run.link,
    color: run.link !== undefined ? LINK_COLOR : opts.color,
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize,
  };
}

function tokenizeParagraph(
  paragraph: TextParagraph,
  opts: TextLayoutOptions,
): Token[] {
  const tokens: Token[] = [];
  for (const run of paragraph.runs) {
    const style = runStyle(run, opts);
    const parts = run.text.split('\n');
    for (let i = 0; i < parts.length; i += 1) {
      if (i > 0) {
        tokens.push({ type: 'newline' });
      }
      const tokenized = parts[i].match(/\S+|\s+/g) ?? [];
      for (const token of tokenized) {
        if (/^\s+$/.test(token)) {
          tokens.push({ type: 'space' });
        } else {
          tokens.push({ type: 'word', text: token, style });
        }
      }
    }
  }
  return tokens;
}

/** Lays rich text out into positioned segments consumable by Konva Text nodes. */
export function layoutRichText(
  paragraphs: readonly TextParagraph[],
  opts: TextLayoutOptions,
  measurer: TextMeasurer = defaultMeasurer,
): TextLayout {
  const lines: TextLine[] = [];
  let numbered = 0;
  let y = 0;
  let totalWidth = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.listType === 'numbered') {
      numbered += 1;
    } else if (paragraph.listType === null) {
      numbered = 0;
    }
    const tokens = tokenizeParagraph(paragraph, opts);
    if (paragraph.listType !== null) {
      const prefixStyle = paragraph.runs[0] ?? { text: '' };
      const prefix = runStyle(prefixStyle, opts);
      tokens.unshift({
        type: 'word',
        text: paragraph.listType === 'bullet' ? '\u2022  ' : `${numbered}.  `,
        style: prefix,
      });
    }

    const paragraphLines = wrapTokens(tokens, paragraph, opts, measurer);
    for (let i = 0; i < paragraphLines.length; i += 1) {
      const isLast = i === paragraphLines.length - 1;
      const line = layoutLine(
        paragraphLines[i],
        paragraph,
        opts,
        measurer,
        isLast,
        y,
      );
      totalWidth = Math.max(totalWidth, line.width);
      lines.push(line);
      y += line.height;
    }
  }

  return { lines, width: totalWidth, height: y };
}

function wrapTokens(
  tokens: Token[],
  paragraph: TextParagraph,
  opts: TextLayoutOptions,
  measurer: TextMeasurer,
): Word[][] {
  const wrapped: Word[][] = [];
  let current: Word[] = [];
  let lineWidth = 0;
  let pendingSpace = false;

  const flush = (): void => {
    if (current.length > 0) {
      wrapped.push(current);
      current = [];
      lineWidth = 0;
      pendingSpace = false;
    }
  };

  for (const token of tokens) {
    if (token.type === 'space') {
      pendingSpace = true;
      continue;
    }
    if (token.type === 'newline') {
      flush();
      continue;
    }
    const word: Word = {
      text: token.text,
      style: token.style,
      width: measurer.measure(token.text, token.style),
    };
    const spaceWidth =
      pendingSpace && current.length > 0
        ? measurer.measure(' ', token.style)
        : 0;
    const exceeds =
      opts.wrap &&
      opts.maxWidth > 0 &&
      current.length > 0 &&
      lineWidth + spaceWidth + word.width > opts.maxWidth;
    if (exceeds) {
      flush();
    }
    if (current.length > 0) {
      lineWidth += spaceWidth;
    }
    current.push(word);
    lineWidth += word.width;
    pendingSpace = false;
  }
  flush();
  if (wrapped.length === 0) {
    const fallback = paragraph.runs[0] ?? { text: '' };
    wrapped.push([{ text: '', style: runStyle(fallback, opts), width: 0 }]);
  }
  return wrapped;
}

function layoutLine(
  words: Word[],
  paragraph: TextParagraph,
  opts: TextLayoutOptions,
  measurer: TextMeasurer,
  isLastLine: boolean,
  y: number,
): TextLine {
  const spaceBase =
    words.length > 1 ? measurer.measure(' ', words[0].style) : 0;
  const natural =
    words.reduce((sum, word) => sum + word.width, 0) +
    spaceBase * Math.max(0, words.length - 1);

  const wrapWidth = opts.wrap && opts.maxWidth > 0 ? opts.maxWidth : Infinity;
  const justify =
    paragraph.align === 'justify' &&
    !isLastLine &&
    words.length > 1 &&
    wrapWidth !== Infinity;
  const gap =
    justify && wrapWidth > natural
      ? spaceBase + (wrapWidth - natural) / (words.length - 1)
      : spaceBase;
  const lineWidth = justify && wrapWidth > natural ? wrapWidth : natural;

  const bounded =
    wrapWidth !== Infinity ? Math.min(lineWidth, wrapWidth) : lineWidth;
  let x: number;
  switch (paragraph.align) {
    case 'center':
      x = wrapWidth !== Infinity ? Math.max(0, (wrapWidth - lineWidth) / 2) : 0;
      break;
    case 'right':
      x = wrapWidth !== Infinity ? Math.max(0, wrapWidth - lineWidth) : 0;
      break;
    default:
      x = 0;
      break;
  }

  const segments: TextSegment[] = [];
  for (const word of words) {
    segments.push({
      ...word.style,
      text: word.text,
      x,
      y,
      width: word.width,
    });
    x += word.width + gap;
  }

  return {
    segments,
    width: bounded,
    height: opts.fontSize * opts.lineHeight,
  };
}

export interface ElementSize {
  width: number;
  height: number;
}

/** Sizes a text element from its paragraphs (auto-width hugs content). */
export function computeTextElementSize(
  paragraphs: readonly TextParagraph[],
  opts: Omit<TextLayoutOptions, 'maxWidth' | 'wrap'> & {
    autoWidth: boolean;
    width: number;
  },
  measurer: TextMeasurer = defaultMeasurer,
): ElementSize {
  const layout = layoutRichText(
    paragraphs,
    {
      fontFamily: opts.fontFamily,
      fontSize: opts.fontSize,
      lineHeight: opts.lineHeight,
      color: opts.color,
      maxWidth: opts.autoWidth ? 0 : opts.width,
      wrap: !opts.autoWidth,
    },
    measurer,
  );
  return {
    width: opts.autoWidth ? layout.width : Math.max(opts.width, layout.width),
    height: Math.max(1, layout.height),
  };
}

/** Auto-grows a sticky note's height to fit its wrapped text. */
export function computeStickySize(
  text: string,
  width: number,
  fontSize: number,
  measurer: TextMeasurer = defaultMeasurer,
): ElementSize {
  const innerWidth = Math.max(1, width - STICKY_PADDING * 2);
  const tokens = text.split(/\s+/).filter((token) => token.length > 0);
  const style: TextMeasureStyle = {
    fontFamily: 'Inter',
    fontSize,
    bold: false,
    italic: false,
  };
  let lines = Math.max(1, text.split('\n').length);
  let currentWidth = 0;
  for (const token of tokens) {
    const wordWidth = measurer.measure(token, style);
    const space = currentWidth > 0 ? measurer.measure(' ', style) : 0;
    if (currentWidth + space + wordWidth > innerWidth) {
      lines += 1;
      currentWidth = wordWidth;
    } else {
      currentWidth += space + wordWidth;
    }
  }
  return {
    width,
    height: Math.max(
      STICKY_MIN_HEIGHT,
      lines * fontSize * STICKY_LINE_HEIGHT + STICKY_PADDING * 2,
    ),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function runToHtml(run: TextRun): string {
  let inner = escapeHtml(run.text);
  if (run.link !== undefined) {
    inner = `<a href="${escapeAttr(run.link)}">${inner}</a>`;
  }
  if (run.bold === true) {
    inner = `<b>${inner}</b>`;
  }
  if (run.italic === true) {
    inner = `<i>${inner}</i>`;
  }
  if (run.underline === true) {
    inner = `<u>${inner}</u>`;
  }
  return inner;
}

/** Serializes the structured model to safe, editor-friendly HTML. */
export function richTextToHtml(paragraphs: readonly TextParagraph[]): string {
  let html = '';
  let openList: 'bullet' | 'numbered' | null = null;

  const closeList = (): void => {
    if (openList !== null) {
      html += `</${openList === 'bullet' ? 'ul' : 'ol'}>`;
      openList = null;
    }
  };

  for (const paragraph of paragraphs) {
    const align =
      paragraph.align === 'left' ? '' : ` align="${paragraph.align}"`;
    if (paragraph.listType === null) {
      closeList();
      html += `<p${align}>${paragraph.runs.map(runToHtml).join('')}</p>`;
      continue;
    }
    if (openList !== paragraph.listType) {
      closeList();
      openList = paragraph.listType;
      html += paragraph.listType === 'bullet' ? '<ul>' : '<ol>';
    }
    html += `<li${align}>${paragraph.runs.map(runToHtml).join('')}</li>`;
  }
  closeList();
  return html;
}

const VALID_ALIGNS: readonly TextAlign[] = [
  'left',
  'center',
  'right',
  'justify',
];

function blockAlign(node: Element): TextAlign {
  const raw =
    node.getAttribute('align') ??
    (node as HTMLElement).style?.textAlign ??
    'left';
  return (VALID_ALIGNS as readonly string[]).includes(raw)
    ? (raw as TextAlign)
    : 'left';
}

interface InlineContext {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link?: string;
}

function runFromContext(text: string, context: InlineContext): TextRun {
  const run: TextRun = { text };
  if (context.bold) {
    run.bold = true;
  }
  if (context.italic) {
    run.italic = true;
  }
  if (context.underline) {
    run.underline = true;
  }
  if (context.link !== undefined) {
    run.link = context.link;
  }
  return run;
}

function sameStyle(a: TextRun, b: TextRun): boolean {
  return (
    (a.bold ?? false) === (b.bold ?? false) &&
    (a.italic ?? false) === (b.italic ?? false) &&
    (a.underline ?? false) === (b.underline ?? false) &&
    (a.link ?? undefined) === (b.link ?? undefined)
  );
}

function parseInline(
  node: Node,
  context: InlineContext,
  runs: TextRun[],
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.length === 0) {
      return;
    }
    const run = runFromContext(text, context);
    const last = runs[runs.length - 1];
    if (last !== undefined && sameStyle(last, run)) {
      last.text += run.text;
    } else {
      runs.push(run);
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as Element;
  const next: InlineContext = { ...context };
  const tag = element.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') {
    next.bold = true;
  } else if (tag === 'i' || tag === 'em') {
    next.italic = true;
  } else if (tag === 'u') {
    next.underline = true;
  } else if (tag === 'a') {
    next.link = element.getAttribute('href') ?? undefined;
  } else if (tag === 'br') {
    runs.push(runFromContext('\n', next));
    return;
  }
  for (const child of Array.from(element.childNodes)) {
    parseInline(child, next, runs);
  }
}

/** Parses editor HTML into the structured paragraph model (no HTML is stored). */
export function htmlToRichText(html: string): TextParagraph[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paragraphs: TextParagraph[] = [];
  for (const node of Array.from(doc.body.childNodes)) {
    parseBlock(node, paragraphs);
  }
  if (paragraphs.length === 0) {
    paragraphs.push({ runs: [{ text: '' }], align: 'left', listType: null });
  }
  return paragraphs;
}

function parseBlock(node: Node, paragraphs: TextParagraph[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.length > 0) {
      paragraphs.push({
        runs: [{ text }],
        align: 'left',
        listType: null,
      });
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ul' ? 'bullet' : 'numbered';
    for (const child of Array.from(element.childNodes)) {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName.toLowerCase() === 'li'
      ) {
        const runs: TextRun[] = [];
        for (const inline of Array.from(child.childNodes)) {
          parseInline(
            inline,
            { bold: false, italic: false, underline: false },
            runs,
          );
        }
        paragraphs.push({
          runs: runs.length > 0 ? runs : [{ text: '' }],
          align: blockAlign(element),
          listType,
        });
      }
    }
    return;
  }
  if (
    tag === 'p' ||
    tag === 'div' ||
    /^h[1-6]$/.test(tag) ||
    tag === 'blockquote'
  ) {
    const runs: TextRun[] = [];
    for (const child of Array.from(element.childNodes)) {
      parseInline(
        child,
        { bold: false, italic: false, underline: false },
        runs,
      );
    }
    paragraphs.push({
      runs: runs.length > 0 ? runs : [{ text: '' }],
      align: blockAlign(element),
      listType: null,
    });
    return;
  }
  const runs: TextRun[] = [];
  for (const child of Array.from(node.childNodes)) {
    parseInline(child, { bold: false, italic: false, underline: false }, runs);
  }
  if (runs.length > 0) {
    paragraphs.push({
      runs,
      align: blockAlign(element),
      listType: null,
    });
  }
}

/** Cleans paragraphs after an edit: trims, drops empty trailing blocks. */
export function normalizeParagraphs(
  paragraphs: readonly TextParagraph[],
): TextParagraph[] {
  const result = paragraphs.map((paragraph) => {
    const runs = [...paragraph.runs];
    const last = runs[runs.length - 1];
    if (last !== undefined) {
      last.text = last.text.replace(/[ \t]+$/u, '');
    }
    if (last !== undefined && last.text.length === 0 && runs.length > 1) {
      runs.pop();
    }
    return { ...paragraph, runs };
  });
  while (
    result.length > 1 &&
    result[result.length - 1].runs.every((run) => run.text.trim().length === 0)
  ) {
    result.pop();
  }
  if (result.length === 0) {
    result.push({ runs: [{ text: '' }], align: 'left', listType: null });
  }
  return result;
}
