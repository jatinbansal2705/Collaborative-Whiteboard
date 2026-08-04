import { z } from 'zod';

/**
 * Whiteboard element model (Phase 10, Canvas Engine).
 *
 * Every element is a plain, serializable object validated by a Zod schema and
 * versioned (ADR-0004: LWW per element). Geometry follows the Excalidraw
 * convention: `x`/`y` is the top-left of the element's axis-aligned bounding
 * box (pre-rotation), `width`/`height` its size, `angle` the rotation in
 * degrees around the box centre. Point-based elements (`points`) store their
 * points *relative* to `(x, y)` so moves/resizes are trivial.
 *
 * The discriminated union below is the single source of truth consumed by the
 * renderer, geometry utilities, and (in later phases) realtime + persistence.
 */

export const ELEMENT_TYPES = {
  PEN: 'pen',
  PENCIL: 'pencil',
  HIGHLIGHTER: 'highlighter',
  RECTANGLE: 'rectangle',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'triangle',
  DIAMOND: 'diamond',
  ARROW: 'arrow',
  LINE: 'line',
  BEZIER: 'bezier',
} as const;

export type ElementType = (typeof ELEMENT_TYPES)[keyof typeof ELEMENT_TYPES];

export const SHAPE_TYPES = [
  ELEMENT_TYPES.RECTANGLE,
  ELEMENT_TYPES.ELLIPSE,
  ELEMENT_TYPES.TRIANGLE,
  ELEMENT_TYPES.DIAMOND,
] as const;

export const LINEAR_TYPES = [ELEMENT_TYPES.ARROW, ELEMENT_TYPES.LINE] as const;

export const FREEHAND_TYPES = [
  ELEMENT_TYPES.PEN,
  ELEMENT_TYPES.PENCIL,
  ELEMENT_TYPES.HIGHLIGHTER,
] as const;

/** Version of the element serialization contract. */
export const ELEMENT_SCHEMA_VERSION = 1;

export const elementIdSchema = z.string().min(1).max(128);
export type ElementId = z.infer<typeof elementIdSchema>;

/** A 2D point. For point-based elements, coordinates are relative to (x, y). */
export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type Point = z.infer<typeof pointSchema>;

export const dashStyleSchema = z.enum([
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
]);
export type DashStyle = z.infer<typeof dashStyleSchema>;

export const elementShadowSchema = z.object({
  color: z.string().min(1).max(32),
  blur: z.number().finite().nonnegative(),
  offsetX: z.number().finite(),
  offsetY: z.number().finite(),
});
export type ElementShadow = z.infer<typeof elementShadowSchema>;

const colorSchema = z.string().min(1).max(32);

export const baseElementSchema = z.object({
  id: elementIdSchema,
  type: z.string().min(1).max(64),
  version: z.number().int().nonnegative(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  /** Rotation in degrees around the box centre. */
  angle: z.number().finite(),
  opacity: z.number().min(0).max(1),
  strokeColor: colorSchema,
  fillColor: colorSchema.nullable(),
  strokeWidth: z.number().finite().nonnegative(),
  strokeStyle: dashStyleSchema,
  shadow: elementShadowSchema.nullable(),
  lastModifiedBy: z.string().min(1).max(128).nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type BaseElementFields = z.infer<typeof baseElementSchema>;

const rectangleElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.RECTANGLE),
});
export type RectangleElement = z.infer<typeof rectangleElementSchema>;

const ellipseElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.ELLIPSE),
});
export type EllipseElement = z.infer<typeof ellipseElementSchema>;

const triangleElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.TRIANGLE),
});
export type TriangleElement = z.infer<typeof triangleElementSchema>;

const diamondElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.DIAMOND),
});
export type DiamondElement = z.infer<typeof diamondElementSchema>;

export const shapeElementSchema = z.discriminatedUnion('type', [
  rectangleElementSchema,
  ellipseElementSchema,
  triangleElementSchema,
  diamondElementSchema,
]);
export type ShapeElement = z.infer<typeof shapeElementSchema>;

const arrowElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.ARROW),
  points: z.array(pointSchema).min(2).max(2),
});
export type ArrowElement = z.infer<typeof arrowElementSchema>;

const lineElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.LINE),
  points: z.array(pointSchema).min(2).max(2),
});
export type LineElement = z.infer<typeof lineElementSchema>;

export const linearElementSchema = z.discriminatedUnion('type', [
  arrowElementSchema,
  lineElementSchema,
]);
export type LinearElement = z.infer<typeof linearElementSchema>;

const freehandBaseSchema = baseElementSchema.extend({
  points: z.array(pointSchema).min(2).max(4096),
  pressures: z.array(z.number().min(0).max(1)),
});

const penElementSchema = freehandBaseSchema.extend({
  type: z.literal(ELEMENT_TYPES.PEN),
});
export type PenElement = z.infer<typeof penElementSchema>;

const pencilElementSchema = freehandBaseSchema.extend({
  type: z.literal(ELEMENT_TYPES.PENCIL),
});
export type PencilElement = z.infer<typeof pencilElementSchema>;

const highlighterElementSchema = freehandBaseSchema.extend({
  type: z.literal(ELEMENT_TYPES.HIGHLIGHTER),
});
export type HighlighterElement = z.infer<typeof highlighterElementSchema>;

export const freehandElementSchema = z
  .discriminatedUnion('type', [
    penElementSchema,
    pencilElementSchema,
    highlighterElementSchema,
  ])
  .superRefine((data, ctx) => {
    if (data.points.length !== data.pressures.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pressures must have the same length as points',
        path: ['pressures'],
      });
    }
  });
export type FreehandElement = z.infer<typeof freehandElementSchema>;

/**
 * Cubic Bezier polyline. `points` holds `3n + 1` control points for `n`
 * segments: `[p0, c1, c2, p3, c4, c5, p6, ...]` where each segment reuses the
 * previous segment's end point as its start point.
 */
const bezierElementSchema = baseElementSchema.extend({
  type: z.literal(ELEMENT_TYPES.BEZIER),
  points: z.array(pointSchema).min(4).max(2048),
});
export type BezierElement = z.infer<typeof bezierElementSchema>;

export const whiteboardElementSchema = z.discriminatedUnion('type', [
  ...shapeElementSchema.options,
  ...linearElementSchema.options,
  penElementSchema,
  pencilElementSchema,
  highlighterElementSchema,
  bezierElementSchema,
]);
export type WhiteboardElement = z.infer<typeof whiteboardElementSchema>;

export const isFreehandElement = (
  element: WhiteboardElement,
): element is FreehandElement =>
  FREEHAND_TYPES.includes(element.type as (typeof FREEHAND_TYPES)[number]);

/** Returns the base-field defaults used when constructing new elements. */
export const ELEMENT_DEFAULTS = {
  version: 0,
  angle: 0,
  opacity: 1,
  fillColor: null,
  strokeWidth: 2,
  strokeStyle: 'solid',
  shadow: null,
  lastModifiedBy: null,
} as const;

/** Parses an unknown value into a validated element, or `null` when invalid. */
export function parseWhiteboardElement(
  value: unknown,
): WhiteboardElement | null {
  const result = whiteboardElementSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function isWhiteboardElement(
  value: unknown,
): value is WhiteboardElement {
  return whiteboardElementSchema.safeParse(value).success;
}

/**
 * Returns a new element with an incremented version and refreshed timestamps
 * (ADR-0004). Element objects are immutable: mutations produce new instances.
 */
export function bumpElementVersion(
  element: WhiteboardElement,
  lastModifiedBy: string | null = null,
  now: number = Date.now(),
): WhiteboardElement {
  return {
    ...element,
    version: element.version + 1,
    updatedAt: now,
    lastModifiedBy,
  };
}
