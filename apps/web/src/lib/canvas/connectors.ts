import {
  bumpElementVersion,
  type ConnectorElement,
  type ConnectorHandle,
  type Point,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { CONNECTOR_MIN_BEND } from './constants';
import { elementBBox } from './geometry';
import type { WorldRect } from './types';

/**
 * Connector routing (Phase 11). Connectors store world-space `start`/`end`
 * anchor points (optionally bound to element ids + handles) plus a cached
 * orthogonal polyline (`points`, relative to the connector's `(x, y)` bounding
 * box). `rerouteConnector` re-derives the anchors from bound element boxes, so
 * connectors follow their endpoints when shapes move.
 */

const HANDLE_ANCHOR: Record<ConnectorHandle, { fx: number; fy: number }> = {
  top: { fx: 0.5, fy: 0 },
  right: { fx: 1, fy: 0.5 },
  bottom: { fx: 0.5, fy: 1 },
  left: { fx: 0, fy: 0.5 },
  center: { fx: 0.5, fy: 0.5 },
};

/** World-space attachment point on a bounding box for a handle. */
export function handleAnchor(
  bounds: WorldRect,
  handle: ConnectorHandle,
): Point {
  const anchor = HANDLE_ANCHOR[handle];
  return {
    x: bounds.x + bounds.width * anchor.fx,
    y: bounds.y + bounds.height * anchor.fy,
  };
}

/** Picks the box handle closest to a target point (for drag-to-bind). */
export function nearestHandle(
  bounds: WorldRect,
  target: Point,
): ConnectorHandle {
  let best: ConnectorHandle = 'center';
  let bestDistance = Infinity;
  for (const handle of Object.keys(HANDLE_ANCHOR) as ConnectorHandle[]) {
    const anchor = handleAnchor(bounds, handle);
    const dx = anchor.x - target.x;
    const dy = anchor.y - target.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = handle;
    }
  }
  return best;
}

/** Orthogonal elbow path between two world points (keeps the arrow tip axis-aligned). */
export function orthogonalRoute(a: Point, b: Point): Point[] {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx === 0 && dy === 0) {
    return [a, b];
  }
  if (dx >= dy) {
    const midX = dx < CONNECTOR_MIN_BEND ? a.x : b.x;
    return [a, { x: midX, y: a.y }, b];
  }
  const midY = dy < CONNECTOR_MIN_BEND ? a.y : b.y;
  return [a, { x: a.x, y: midY }, b];
}

/**
 * Rebuilds a connector's geometry from its world-space `start`/`end` anchors:
 * routes the polyline, normalizes it to the bounding box and returns a new
 * connector. The version is bumped by the caller when this is a committed edit.
 */
export function buildConnector(
  connector: ConnectorElement,
  start: Point,
  end: Point,
): ConnectorElement {
  const route = orthogonalRoute(start, end);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of route) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const x = minX;
  const y = minY;
  return {
    ...connector,
    x,
    y,
    width: maxX - minX,
    height: maxY - minY,
    start,
    end,
    points: route.map((point) => ({ x: point.x - x, y: point.y - y })),
  };
}

/** Translates a connector (x/y and both world anchors move together). */
export function moveConnector(
  connector: ConnectorElement,
  dx: number,
  dy: number,
): ConnectorElement {
  return {
    ...connector,
    x: connector.x + dx,
    y: connector.y + dy,
    start: { x: connector.start.x + dx, y: connector.start.y + dy },
    end: { x: connector.end.x + dx, y: connector.end.y + dy },
  };
}

/** Re-anchors a bound connector endpoint to its target element's box. */
export function rerouteConnector(
  connector: ConnectorElement,
  elements: readonly WhiteboardElement[],
): ConnectorElement {
  const startElement =
    connector.startElementId === null
      ? null
      : elements.find((element) => element.id === connector.startElementId);
  const endElement =
    connector.endElementId === null
      ? null
      : elements.find((element) => element.id === connector.endElementId);

  const start =
    startElement === undefined || startElement === null
      ? connector.start
      : handleAnchor(
          elementBBox(startElement),
          connector.startHandle ?? 'center',
        );
  const end =
    endElement === undefined || endElement === null
      ? connector.end
      : handleAnchor(elementBBox(endElement), connector.endHandle ?? 'center');

  if (start === connector.start && end === connector.end) {
    return connector;
  }
  return buildConnector(connector, start, end);
}

/**
 * Binds a connector's start/end to whichever element the anchor lands on
 * (within `tolerance` of its box). Returns a new connector with bindings set.
 */
export function bindConnectorEndpoints(
  connector: ConnectorElement,
  elements: readonly WhiteboardElement[],
  tolerance: number,
): ConnectorElement {
  const bind = (
    anchor: Point,
    selfId: string,
  ): { id: string; handle: ConnectorHandle } | null => {
    for (const element of elements) {
      if (element.id === selfId) {
        continue;
      }
      const box = elementBBox(element);
      const padded: WorldRect = {
        x: box.x - tolerance,
        y: box.y - tolerance,
        width: box.width + tolerance * 2,
        height: box.height + tolerance * 2,
      };
      if (
        anchor.x >= padded.x &&
        anchor.x <= padded.x + padded.width &&
        anchor.y >= padded.y &&
        anchor.y <= padded.y + padded.height
      ) {
        return { id: element.id, handle: nearestHandle(box, anchor) };
      }
    }
    return null;
  };

  const startBinding = bind(connector.start, connector.id);
  const endBinding = bind(connector.end, connector.id);
  return {
    ...connector,
    startElementId: startBinding?.id ?? null,
    startHandle: startBinding?.handle ?? null,
    endElementId: endBinding?.id ?? null,
    endHandle: endBinding?.handle ?? null,
  };
}

/**
 * Applies a reroute pass across the document: every bound connector whose
 * target moved is re-anchored and version-bumped. Returns `elements` itself
 * when nothing changed (so callers can skip committing).
 */
export function rerouteConnectors(
  elements: WhiteboardElement[],
  ownerId: string | null = null,
  now: number = Date.now(),
): WhiteboardElement[] {
  let changed = false;
  const next = elements.map((element) => {
    if (element.type !== 'connector') {
      return element;
    }
    const rerouted = rerouteConnector(element, elements);
    if (rerouted === element) {
      return element;
    }
    changed = true;
    return bumpElementVersion(rerouted, ownerId, now);
  });
  return changed ? next : elements;
}
