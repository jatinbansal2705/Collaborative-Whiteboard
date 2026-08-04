import { ELEMENT_TYPES, type WhiteboardElement } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE,
  IMAGE_SIZE,
  STICKY_COLOR_DEFAULT,
  TEXT_DEFAULT_COLOR,
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_SIZE,
} from '@/lib/canvas/constants';
import {
  applyStyle,
  createConnectorElement,
  createElement,
  createIconElement,
  createImageElement,
  createStickyElement,
  createTextElement,
  dashArray,
  duplicateElement,
} from '@/lib/canvas/elements';
import type { ElementStyle } from '@/lib/canvas/types';

const options = {
  id: 'el-1',
  style: DEFAULT_STYLE,
  ownerId: 'u1' as string | null,
  now: 1000,
};

describe('createElement', () => {
  it('creates a rectangle from two corner points', () => {
    const rect = createElement(
      ELEMENT_TYPES.RECTANGLE,
      [
        { x: 10, y: 20 },
        { x: 60, y: 70 },
      ],
      options,
    );
    expect(rect).toMatchObject({
      id: 'el-1',
      type: 'rectangle',
      x: 10,
      y: 20,
      width: 50,
      height: 50,
      version: 0,
      name: null,
      groupId: null,
      locked: false,
      hidden: false,
      lastModifiedBy: 'u1',
      createdAt: 1000,
    });
    expect(rect.fillColor).toBe(DEFAULT_STYLE.fillColor);
  });

  it('normalizes reversed corners', () => {
    const rect = createElement(
      ELEMENT_TYPES.RECTANGLE,
      [
        { x: 60, y: 70 },
        { x: 10, y: 20 },
      ],
      options,
    );
    expect(rect).toMatchObject({ x: 10, y: 20, width: 50, height: 50 });
  });

  it('strips fill color from non-fillable line elements', () => {
    const line = createElement(
      ELEMENT_TYPES.LINE,
      [
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ],
      options,
    );
    expect(line.type).toBe('line');
    expect(line.fillColor).toBeNull();
  });

  it('normalizes freehand points to the bounding box', () => {
    const pen = createElement(
      ELEMENT_TYPES.PEN,
      [
        { x: 5, y: 9 },
        { x: 3, y: 2 },
        { x: 8, y: 0 },
      ],
      options,
      [0.5, 0.8, 1],
    );
    expect(pen).toMatchObject({ x: 3, y: 0, width: 5, height: 9 });
    expect(pen).toMatchObject({ pressures: [0.5, 0.8, 1] });
  });

  it('rejects unknown element types', () => {
    expect(() =>
      createElement(
        'spline' as WhiteboardElement['type'],
        [{ x: 0, y: 0 }],
        options,
      ),
    ).toThrow();
  });
});

describe('Phase 11 factories', () => {
  it('creates a text element with a default paragraph', () => {
    const text = createTextElement({ x: 10, y: 20 }, options);
    expect(text).toMatchObject({
      type: 'text',
      x: 10,
      y: 20,
      width: TEXT_SIZE.width,
      height: TEXT_SIZE.height,
      fontSize: TEXT_DEFAULT_FONT_SIZE,
      color: TEXT_DEFAULT_COLOR,
      autoWidth: true,
    });
    expect(text.paragraphs[0]?.runs[0]?.text).toBe('Text');
  });

  it('creates a sticky note with a default background', () => {
    const sticky = createStickyElement({ x: 0, y: 0 }, options);
    expect(sticky.type).toBe('sticky');
    expect(sticky.fillColor).toBe(STICKY_COLOR_DEFAULT);
    expect(sticky.text).toBe('');
  });

  it('creates an unbound connector with no cached route', () => {
    const connector = createConnectorElement(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      options,
    );
    expect(connector).toMatchObject({
      type: 'connector',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 50 },
      startElementId: null,
      endElementId: null,
      points: [],
      arrowEnd: true,
    });
  });

  it('creates an image element at the default size', () => {
    const image = createImageElement(
      { x: 5, y: 5 },
      'https://x/i.png',
      options,
    );
    expect(image).toMatchObject({
      type: 'image',
      src: 'https://x/i.png',
      width: IMAGE_SIZE.width,
      height: IMAGE_SIZE.height,
    });
  });

  it('creates an icon element at the default size', () => {
    const icon = createIconElement({ x: 0, y: 0 }, 'icon', 'star', options);
    expect(icon).toMatchObject({
      type: 'icon',
      kind: 'icon',
      value: 'star',
      size: 48,
      width: 48,
      height: 48,
    });
  });

  it('duplicates an element with a fresh id, offset and version', () => {
    const rect = createElement(
      ELEMENT_TYPES.RECTANGLE,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      options,
    );
    const copy = duplicateElement(rect, 'el-2', 20, 30);
    expect(copy.id).toBe('el-2');
    expect(copy.x).toBe(20);
    expect(copy.y).toBe(30);
    expect(copy.version).toBe(1);
    expect(copy.type).toBe('rectangle');
  });
});

describe('style application', () => {
  const style: ElementStyle = {
    strokeColor: '#123456',
    fillColor: '#ff0000',
    strokeWidth: 5,
    strokeStyle: 'dashed',
    opacity: 0.5,
    shadow: null,
  };

  it('applies fill to fillable elements', () => {
    const rect = createElement(
      ELEMENT_TYPES.RECTANGLE,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      options,
    );
    expect(applyStyle(rect, style)).toMatchObject({ fillColor: '#ff0000' });
  });

  it('applies fill to sticky notes', () => {
    const sticky = createStickyElement({ x: 0, y: 0 }, options);
    expect(applyStyle(sticky, style)).toMatchObject({ fillColor: '#ff0000' });
  });

  it('strips fill from non-fillable elements', () => {
    const line = createElement(
      ELEMENT_TYPES.LINE,
      [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      options,
    );
    const applied = applyStyle(line, style) as typeof line;
    expect(applied.fillColor).toBeNull();
    expect(applied.strokeWidth).toBe(5);
  });
});

describe('dashArray', () => {
  it('maps solid to no dash pattern', () => {
    expect(dashArray('solid', 2)).toBeUndefined();
  });

  it('scales dashed patterns with line width', () => {
    expect(dashArray('dashed', 2)).toEqual([12, 8]);
    expect(dashArray('dashed', 4)).toEqual([24, 16]);
  });
});
