import type {
  ConnectorElement,
  Point,
  WhiteboardElement,
} from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import {
  bindConnectorEndpoints,
  buildConnector,
  handleAnchor,
  moveConnector,
  nearestHandle,
  orthogonalRoute,
  rerouteConnector,
  rerouteConnectors,
} from '@/lib/canvas/connectors';
import { DEFAULT_STYLE } from '@/lib/canvas/constants';
import { createConnectorElement, createElement } from '@/lib/canvas/elements';

function rectangle(id: string, x: number, y: number): WhiteboardElement {
  return createElement(
    'rectangle',
    [
      { x, y },
      { x: x + 100, y: y + 50 },
    ],
    { id, style: DEFAULT_STYLE, ownerId: 'u1' },
  );
}

function connector(id: string, start: Point, end: Point): ConnectorElement {
  return createConnectorElement(start, end, {
    id,
    style: DEFAULT_STYLE,
    ownerId: 'u1',
  });
}

describe('connector routing', () => {
  it('anchors handles to the expected box positions', () => {
    const bounds = { x: 10, y: 20, width: 100, height: 50 };
    expect(handleAnchor(bounds, 'center')).toEqual({ x: 60, y: 45 });
    expect(handleAnchor(bounds, 'top')).toEqual({ x: 60, y: 20 });
    expect(handleAnchor(bounds, 'right')).toEqual({ x: 110, y: 45 });
    expect(handleAnchor(bounds, 'bottom')).toEqual({ x: 60, y: 70 });
    expect(handleAnchor(bounds, 'left')).toEqual({ x: 10, y: 45 });
  });

  it('picks the nearest handle to a target point', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 };
    expect(nearestHandle(bounds, { x: 110, y: 25 })).toBe('right');
    expect(nearestHandle(bounds, { x: 50, y: -10 })).toBe('top');
    expect(nearestHandle(bounds, { x: 50, y: 25 })).toBe('center');
  });

  it('routes horizontally-dominant spans through an elbow', () => {
    const route = orthogonalRoute({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(route[0]).toEqual({ x: 0, y: 0 });
    expect(route[route.length - 1]).toEqual({ x: 100, y: 0 });
    expect(route).toHaveLength(3);
  });

  it('builds connector geometry relative to its bounding box', () => {
    const c = connector('c1', { x: 20, y: 30 }, { x: 120, y: 30 });
    const built = buildConnector(c, c.start, c.end);
    expect(built.x).toBe(20);
    expect(built.width).toBe(100);
    expect(built.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('translates a connector together with its anchors', () => {
    const c = connector('c1', { x: 0, y: 0 }, { x: 100, y: 0 });
    const moved = moveConnector(c, 10, 5);
    expect(moved.start).toEqual({ x: 10, y: 5 });
    expect(moved.end).toEqual({ x: 110, y: 5 });
  });

  it('reroutes a bound connector when its target moves', () => {
    const a = rectangle('a', 0, 0);
    const movedA = { ...a, x: 20 };
    const c: ConnectorElement = {
      ...connector('c1', { x: 50, y: 25 }, { x: 50, y: 25 }),
      startElementId: 'a',
      endElementId: 'a',
      startHandle: 'center',
      endHandle: 'center',
    };
    const rerouted = rerouteConnector(c, [movedA]);
    expect(rerouted.start).toEqual({ x: 70, y: 25 });
    expect(rerouted.end).toEqual({ x: 70, y: 25 });
  });

  it('leaves unbound endpoints untouched during reroute', () => {
    const c = connector('c1', { x: 0, y: 0 }, { x: 100, y: 50 });
    expect(rerouteConnector(c, [rectangle('a', 0, 0)])).toBe(c);
  });

  it('binds endpoints to elements within tolerance', () => {
    const a = rectangle('a', 0, 0);
    const c = connector('c1', { x: 50, y: 25 }, { x: 50, y: 25 });
    const bound = bindConnectorEndpoints(c, [a], 8);
    expect(bound.startElementId).toBe('a');
    expect(bound.endElementId).toBe('a');
    expect(bound.startHandle).toBe('center');
  });

  it('skips self-binding when the anchor is on the connector itself', () => {
    const a = rectangle('a', 0, 0);
    const c: ConnectorElement = {
      ...connector('c1', { x: 50, y: 25 }, { x: 150, y: 25 }),
      startElementId: 'a',
    };
    const bound = bindConnectorEndpoints(c, [a], 8);
    expect(bound.endElementId).toBeNull();
  });

  it('reroutes the document and bumps versions only when changed', () => {
    const a = rectangle('a', 0, 0);
    const c: ConnectorElement = {
      ...connector('c1', { x: 50, y: 25 }, { x: 50, y: 25 }),
      startElementId: 'a',
      endElementId: 'a',
      startHandle: 'center',
      endHandle: 'center',
    };
    const elements = [a, c];
    const movedA = { ...a, x: 20 };
    const next = rerouteConnectors([movedA, c], 'u1', 1000);
    expect(next).not.toBe(elements);
    const changedConnector = next.find((e) => e.type === 'connector');
    expect(changedConnector?.version).toBe(1);
  });

  it('returns the same array reference when nothing reroutes', () => {
    const a = rectangle('a', 0, 0);
    const c = connector('c1', { x: 0, y: 0 }, { x: 100, y: 50 });
    const elements = [a, c];
    expect(rerouteConnectors(elements, 'u1', 1000)).toBe(elements);
  });
});
