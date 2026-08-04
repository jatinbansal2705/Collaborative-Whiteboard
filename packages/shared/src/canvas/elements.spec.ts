import {
  bumpElementVersion,
  ELEMENT_DEFAULTS,
  ELEMENT_TYPES,
  freehandElementSchema,
  parseWhiteboardElement,
  type BaseElementFields,
  type LinearElement,
  type ShapeElement,
  type WhiteboardElement,
} from './elements';
import {
  BOARD_DOCUMENT_SCHEMA_VERSION,
  createEmptyWhiteboardDocument,
  documentFromElements,
  parseWhiteboardDocument,
} from './board';

function baseOverrides(
  overrides: Partial<BaseElementFields> = {},
): BaseElementFields {
  return {
    id: 'el-1',
    type: ELEMENT_TYPES.RECTANGLE,
    version: 0,
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    angle: 0,
    opacity: 1,
    strokeColor: '#111111',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function shapeElement(
  overrides: Partial<BaseElementFields> = {},
): ShapeElement {
  return baseOverrides(overrides) as ShapeElement;
}

describe('whiteboard element model', () => {
  it('validates a rectangle element', () => {
    const element = shapeElement();
    const parsed = parseWhiteboardElement(element);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe(ELEMENT_TYPES.RECTANGLE);
  });

  it('accepts every element type in the discriminated union', () => {
    const cases: WhiteboardElement[] = [
      baseOverrides({ type: ELEMENT_TYPES.ELLIPSE }) as ShapeElement,
      baseOverrides({ type: ELEMENT_TYPES.TRIANGLE }) as ShapeElement,
      baseOverrides({ type: ELEMENT_TYPES.DIAMOND }) as ShapeElement,
      {
        ...baseOverrides({ width: 50, height: 5 }),
        type: ELEMENT_TYPES.LINE,
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 5 },
        ],
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.ARROW,
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 5 },
        ],
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.PEN,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 2 },
          { x: 20, y: 1 },
        ],
        pressures: [0.5, 1, 0.25],
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.PENCIL,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 2 },
        ],
        pressures: [0.5, 1],
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.HIGHLIGHTER,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 2 },
        ],
        pressures: [0.5, 1],
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.BEZIER,
        points: [
          { x: 0, y: 0 },
          { x: 20, y: -10 },
          { x: 40, y: 20 },
          { x: 60, y: 0 },
        ],
      },
      {
        ...baseOverrides({ width: 80, height: 40 }),
        type: ELEMENT_TYPES.TEXT,
        paragraphs: [
          {
            runs: [
              { text: 'Hello ' },
              { text: 'world', bold: true, link: 'https://example.com' },
            ],
            align: 'center',
            listType: 'bullet',
          },
        ],
        fontFamily: 'Inter',
        fontSize: 16,
        lineHeight: 1.2,
        color: '#111111',
        autoWidth: false,
      },
      {
        ...baseOverrides({ fillColor: '#fef08a' }),
        type: ELEMENT_TYPES.STICKY,
        text: 'Sticky note',
        fontSize: 16,
      },
      {
        ...baseOverrides({ width: 60, height: 40 }),
        type: ELEMENT_TYPES.CONNECTOR,
        start: { x: 0, y: 20 },
        end: { x: 60, y: 20 },
        startElementId: 'el-a',
        startHandle: 'right',
        endElementId: 'el-b',
        endHandle: 'left',
        points: [
          { x: 0, y: 20 },
          { x: 60, y: 20 },
        ],
        arrowEnd: true,
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.IMAGE,
        src: 'https://res.cloudinary.com/x/image.png',
      },
      {
        ...baseOverrides(),
        type: ELEMENT_TYPES.ICON,
        kind: 'emoji',
        value: '🚀',
        size: 48,
      },
    ];

    for (const element of cases) {
      expect(parseWhiteboardElement(element)).toEqual(element);
    }
  });

  it('rejects elements with a non-finite coordinate', () => {
    expect(parseWhiteboardElement(shapeElement({ x: Number.NaN }))).toBeNull();
  });

  it('rejects freehand elements with mismatched pressures', () => {
    const result = freehandElementSchema.safeParse({
      ...baseOverrides(),
      type: ELEMENT_TYPES.PEN,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 2 },
      ],
      pressures: [0.5],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative dimensions and out-of-range opacity', () => {
    expect(parseWhiteboardElement(shapeElement({ width: -1 }))).toBeNull();
    expect(parseWhiteboardElement(shapeElement({ opacity: 1.5 }))).toBeNull();
  });

  it('rejects an unknown element type', () => {
    expect(
      parseWhiteboardElement({ ...shapeElement(), type: 'sticky' }),
    ).toBeNull();
  });

  it('narrows a linear element to its points', () => {
    const element = parseWhiteboardElement({
      ...baseOverrides(),
      type: ELEMENT_TYPES.ARROW,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ],
    }) as LinearElement;
    expect(element.points).toHaveLength(2);
  });

  it('narrows a shape element to its dimensions', () => {
    const element = parseWhiteboardElement(shapeElement()) as ShapeElement;
    expect(element.width).toBe(100);
  });

  it('bumpElementVersion increments version and refreshes timestamps', () => {
    const element = shapeElement();
    const bumped = bumpElementVersion(element, 'user-1', 42);
    expect(bumped.version).toBe(element.version + 1);
    expect(bumped.updatedAt).toBe(42);
    expect(bumped.lastModifiedBy).toBe('user-1');
    expect(bumped).not.toBe(element);
  });

  it('exposes base defaults for element construction', () => {
    expect(ELEMENT_DEFAULTS).toEqual({
      version: 0,
      angle: 0,
      opacity: 1,
      fillColor: null,
      strokeWidth: 2,
      strokeStyle: 'solid',
      shadow: null,
      lastModifiedBy: null,
      name: null,
      groupId: null,
      locked: false,
      hidden: false,
    });
  });
});

describe('whiteboard document', () => {
  it('creates an empty document', () => {
    expect(createEmptyWhiteboardDocument()).toEqual({
      schemaVersion: BOARD_DOCUMENT_SCHEMA_VERSION,
      elements: [],
    });
  });

  it('serializes elements into a document and parses them back', () => {
    const elements = [shapeElement()];
    const doc = documentFromElements(elements);
    expect(parseWhiteboardDocument(JSON.parse(JSON.stringify(doc)))).toEqual(
      doc,
    );
  });

  it('rejects a document with an invalid element', () => {
    expect(
      parseWhiteboardDocument({
        schemaVersion: BOARD_DOCUMENT_SCHEMA_VERSION,
        elements: [shapeElement({ strokeColor: '' })],
      }),
    ).toBeNull();
  });

  it('rejects an unsupported schema version', () => {
    expect(
      parseWhiteboardDocument({ schemaVersion: 99, elements: [] }),
    ).toBeNull();
  });
});
