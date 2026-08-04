import type { WhiteboardElement } from '@whiteboard/shared';
import { elementBBox, elementsBoundingBox } from './geometry';
import type { WorldRect } from './types';

/** Alignment anchors relative to the selection bounding box. */
export type AlignMode =
  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export type DistributeAxis = 'horizontal' | 'vertical';

/**
 * Aligns the selection against its own bounding box. Rotated elements are
 * translated by the delta of their axis-aligned world bounding box so the
 * rotation is preserved while the box aligns to the target edge/axis.
 */
export function alignSelection(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
  mode: AlignMode,
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size === 0) {
    return [...elements];
  }
  const selectedElements = elements.filter((element) =>
    selected.has(element.id),
  );
  const bounds = elementsBoundingBox(selectedElements);
  if (bounds === null) {
    return [...elements];
  }
  return elements.map((element) => {
    if (!selected.has(element.id)) {
      return element;
    }
    const box = elementBBox(element);
    const dx = horizontalDelta(mode, bounds, box);
    const dy = verticalDelta(mode, bounds, box);
    return { ...element, x: element.x + dx, y: element.y + dy };
  });
}

function horizontalDelta(
  mode: AlignMode,
  bounds: WorldRect,
  box: WorldRect,
): number {
  switch (mode) {
    case 'center':
      return bounds.x + bounds.width / 2 - (box.x + box.width / 2);
    case 'right':
      return bounds.x + bounds.width - (box.x + box.width);
    default:
      return bounds.x - box.x;
  }
}

function verticalDelta(
  mode: AlignMode,
  bounds: WorldRect,
  box: WorldRect,
): number {
  switch (mode) {
    case 'middle':
      return bounds.y + bounds.height / 2 - (box.y + box.height / 2);
    case 'bottom':
      return bounds.y + bounds.height - (box.y + box.height);
    default:
      return bounds.y - box.y;
  }
}

/**
 * Distributes the selection evenly along an axis by spacing the leading edges
 * of consecutive elements from the first leading edge to the last.
 */
export function distributeSelection(
  elements: readonly WhiteboardElement[],
  ids: readonly string[],
  axis: DistributeAxis,
): WhiteboardElement[] {
  const selected = new Set(ids);
  if (selected.size < 3) {
    return [...elements];
  }
  const selectedElements = elements.filter((element) =>
    selected.has(element.id),
  );
  const boxes = selectedElements.map((element) => elementBBox(element));
  const order = boxes
    .map((_, index) => index)
    .sort((a, b) =>
      axis === 'horizontal' ? boxes[a].x - boxes[b].x : boxes[a].y - boxes[b].y,
    );

  const first = order[0];
  const last = order[order.length - 1];
  if (first === undefined || last === undefined) {
    return [...elements];
  }
  const start = axis === 'horizontal' ? boxes[first].x : boxes[first].y;
  const span = (axis === 'horizontal' ? boxes[last].x : boxes[last].y) - start;
  const gap = span / (order.length - 1);

  const byId = new Map<string, { delta: number }>();
  order.forEach((elementIndex, position) => {
    const element = selectedElements[elementIndex];
    const box = boxes[elementIndex];
    const leading = axis === 'horizontal' ? box.x : box.y;
    byId.set(element.id, { delta: start + gap * position - leading });
  });

  return elements.map((element) => {
    const move = byId.get(element.id);
    if (move === undefined) {
      return element;
    }
    return {
      ...element,
      x: element.x + (axis === 'horizontal' ? move.delta : 0),
      y: element.y + (axis === 'vertical' ? move.delta : 0),
    };
  });
}
