import { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  bumpElementVersion,
  type Point,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasHistoryStore } from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';
import { screenToWorld, zoomAt } from '@/lib/canvas/coords';
import {
  catmullRomToBezier,
  distance,
  elementBBox,
  elementsBoundingBox,
  findGuides,
  moveElement,
  pointInElement,
  rectFromPoints,
  rectsIntersect,
  resizeElement,
  rotateElement,
  snapToGrid,
} from '@/lib/canvas/geometry';
import { createElement } from '@/lib/canvas/elements';
import { createElementId } from '@/lib/canvas/ids';
import {
  GUIDE_TOLERANCE,
  GRID_SIZE,
  HIT_PADDING,
  MAX_POINTS,
  MIN_ELEMENT_SIZE,
  POINT_SAMPLE_DISTANCE,
  ROTATE_SNAP_STEP,
  ZOOM_STEP,
} from '@/lib/canvas/constants';
import type {
  FreehandToolId,
  GuideLines,
  ResizeHandle,
  ShapeToolId,
  ToolId,
  ViewportTransform,
} from '@/lib/canvas/types';

const DRAG_THRESHOLD = 3;
const FREEHAND_TOOLS: ReadonlySet<FreehandToolId> = new Set<FreehandToolId>([
  'pen',
  'pencil',
  'highlighter',
]);

function isFreehandTool(tool: ToolId): tool is FreehandToolId {
  return FREEHAND_TOOLS.has(tool as FreehandToolId);
}

type DragMode =
  'draw' | 'move' | 'resize' | 'rotate' | 'select' | 'pan' | 'erase' | 'pinch';

interface DragState {
  mode: DragMode;
  pointerId: number;
  startScreen: Point;
  lastScreen: Point;
  startWorld: Point;
  lastWorld: Point;
  moved: boolean;
  before: WhiteboardElement[];
  drawingType?: ToolId;
  drawnPoints?: Point[];
  drawnPressures?: number[];
  elementId?: string;
  handle?: ResizeHandle;
  originElements?: WhiteboardElement[];
  original?: WhiteboardElement;
  center?: Point;
  erased?: boolean;
  shiftKey?: boolean;
}

interface PinchState {
  startDistance: number;
  startMid: Point;
  transform: ViewportTransform;
}

function stagePosition(
  stage: Konva.Stage | null,
  clientX: number,
  clientY: number,
): Point {
  if (stage === null) {
    return { x: clientX, y: clientY };
  }
  const rect = stage.content.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function hitElementId(event: KonvaEventObject<unknown>): string | null {
  const node = event.target;
  if (typeof node.hasName !== 'function' || !node.hasName('element')) {
    return null;
  }
  const id = node.id();
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isTooSmallToDraw(element: WhiteboardElement): boolean {
  return element.width < MIN_ELEMENT_SIZE && element.height < MIN_ELEMENT_SIZE;
}

function buildDrawElement(
  tool: ToolId,
  startWorld: Point,
  points: Point[],
  pressures: number[],
): WhiteboardElement {
  const { style } = useCanvasStore.getState();
  const ownerId = null;
  if (isFreehandTool(tool)) {
    return createElement(
      tool,
      points,
      { id: createElementId(), style, ownerId },
      pressures,
    );
  }
  if (tool === 'bezier') {
    return createElement('bezier', catmullRomToBezier(points), {
      id: createElementId(),
      style,
      ownerId,
    });
  }
  return createElement(
    tool as ShapeToolId,
    [startWorld, points[points.length - 1] ?? startWorld],
    { id: createElementId(), style, ownerId },
  );
}

/**
 * Single-pointer and pinch gesture handling for the Konva stage. The draft,
 * element, selection and camera stores are all mutated immutably; history is
 * recorded with a snapshot taken before each gesture begins.
 */
export function useCanvasInteraction() {
  const stageRef = useRef<Konva.Stage | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());

  const commit = useCallback(
    (
      before: WhiteboardElement[],
      after: WhiteboardElement[],
      selectedIds: string[],
    ) => {
      if (before === after) {
        return;
      }
      const now = Date.now();
      const bumped = after.map((element) =>
        bumpElementVersion(element, null, now),
      );
      useCanvasHistoryStore.getState().push(before);
      useCanvasStore.getState().setElements(bumped);
      useCanvasStore.getState().setSelectedIds(selectedIds);
    },
    [],
  );

  const handleDragMove = useCallback((drag: DragState, pos: Point): void => {
    const world = screenToWorld(useCameraStore.getState(), pos.x, pos.y);
    const deltaX = pos.x - drag.lastScreen.x;
    const deltaY = pos.y - drag.lastScreen.y;
    drag.lastScreen = pos;

    switch (drag.mode) {
      case 'pan':
        useCameraStore.getState().panByScreen(deltaX, deltaY);
        break;
      case 'draw': {
        const points = drag.drawnPoints as Point[];
        const pressures = drag.drawnPressures as number[];
        if (isFreehandTool(drag.drawingType as ToolId)) {
          if (
            distance(world, drag.lastWorld) >= POINT_SAMPLE_DISTANCE &&
            points.length < MAX_POINTS
          ) {
            points.push(world);
            pressures.push(1);
            drag.lastWorld = world;
          }
        } else if (drag.drawingType === 'bezier') {
          if (
            points.length === 0 ||
            distance(world, drag.lastWorld) >= POINT_SAMPLE_DISTANCE * 2
          ) {
            if (points.length < MAX_POINTS / 3) {
              points.push(world);
              drag.lastWorld = world;
            }
          }
        } else {
          drag.lastWorld = world;
        }
        const element = buildDrawElement(
          drag.drawingType as ToolId,
          drag.startWorld,
          points,
          pressures,
        );
        useCanvasStore.getState().setDraft({ kind: 'draw', element });
        break;
      }
      case 'move': {
        if (!drag.moved && distance(drag.startScreen, pos) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        const canvas = useCanvasStore.getState();
        const originals = drag.originElements as WhiteboardElement[];
        let dx = world.x - drag.startWorld.x;
        let dy = world.y - drag.startWorld.y;
        const bbox = elementsBoundingBox(originals);
        if (canvas.snapEnabled && bbox !== null) {
          dx = snapToGrid(bbox.x + dx, GRID_SIZE) - bbox.x;
          dy = snapToGrid(bbox.y + dy, GRID_SIZE) - bbox.y;
        }
        let guides: GuideLines = { dx, dy, linesX: [], linesY: [] };
        if (bbox !== null) {
          const selected = new Set(originals.map((element) => element.id));
          const otherRects = canvas.elements
            .filter((element) => !selected.has(element.id))
            .map((element) => elementBBox(element));
          guides = findGuides(
            originals.map((element) => elementBBox(element)),
            otherRects,
            dx,
            dy,
            GUIDE_TOLERANCE,
          );
        }
        canvas.setGuides(guides);
        const moved = originals.map((element) =>
          moveElement(element, guides.dx, guides.dy),
        );
        canvas.setElements(moved);
        break;
      }
      case 'resize': {
        if (!drag.moved && distance(drag.startScreen, pos) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        const canvas = useCanvasStore.getState();
        const original = drag.original as WhiteboardElement;
        const resized = resizeElement(
          original,
          drag.handle as ResizeHandle,
          world,
          {
            maintainAspect: drag.shiftKey ?? false,
            minSize: MIN_ELEMENT_SIZE,
          },
        );
        canvas.setElements(
          canvas.elements.map((element) =>
            element.id === original.id ? resized : element,
          ),
        );
        break;
      }
      case 'rotate': {
        if (!drag.moved && distance(drag.startScreen, pos) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        const canvas = useCanvasStore.getState();
        const original = drag.original as WhiteboardElement;
        const center = drag.center as Point;
        let angle =
          (Math.atan2(world.y - center.y, world.x - center.x) * 180) / Math.PI +
          90;
        angle = Math.round(angle / ROTATE_SNAP_STEP) * ROTATE_SNAP_STEP;
        const rotated = rotateElement(original, angle);
        canvas.setElements(
          canvas.elements.map((element) =>
            element.id === original.id ? rotated : element,
          ),
        );
        break;
      }
      case 'select': {
        if (!drag.moved && distance(drag.startScreen, pos) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        const canvas = useCanvasStore.getState();
        const rect = rectFromPoints(drag.startWorld, world);
        canvas.setDraft({ kind: 'select', rect });
        const intersecting = canvas.elements.filter((element) =>
          rectsIntersect(rect, elementBBox(element)),
        );
        canvas.setSelectedIds(intersecting.map((element) => element.id));
        break;
      }
      case 'erase': {
        if (!drag.moved && distance(drag.startScreen, pos) < DRAG_THRESHOLD) {
          return;
        }
        drag.moved = true;
        const canvas = useCanvasStore.getState();
        const remaining = canvas.elements.filter(
          (element) => !pointInElement(element, world, HIT_PADDING),
        );
        if (remaining.length !== canvas.elements.length) {
          drag.erased = true;
          canvas.setElements(remaining);
        }
        break;
      }
      case 'pinch': {
        const pinch = pinchRef.current;
        if (pinch === null) {
          return;
        }
        const pointers = [...pointersRef.current.values()];
        const p1 = pointers[0];
        const p2 = pointers[1];
        if (p1 === undefined || p2 === undefined) {
          return;
        }
        const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const zoom =
          (pinch.transform.zoom * currentDistance) / pinch.startDistance;
        const next = zoomAt(pinch.transform, mid.x, mid.y, zoom);
        useCameraStore.getState().setTransform({
          zoom: next.zoom,
          offsetX: next.offsetX + (mid.x - pinch.startMid.x) / next.zoom,
          offsetY: next.offsetY + (mid.y - pinch.startMid.y) / next.zoom,
        });
        break;
      }
    }
  }, []);

  const handleDragEnd = useCallback(
    (drag: DragState): void => {
      const canvas = useCanvasStore.getState();

      switch (drag.mode) {
        case 'draw': {
          const tool = drag.drawingType as ToolId;
          const points = drag.drawnPoints as Point[];
          const pressures = drag.drawnPressures as number[];
          canvas.setDraft(null);
          const validLength = points.length >= 2;
          if (!validLength) {
            return;
          }
          const element = buildDrawElement(
            tool,
            drag.startWorld,
            points,
            pressures,
          );
          const meaningful =
            isFreehandTool(tool) ||
            tool === 'bezier' ||
            !isTooSmallToDraw(element);
          if (!meaningful) {
            return;
          }
          commit(drag.before, [...drag.before, element], [element.id]);
          break;
        }
        case 'move':
        case 'resize':
        case 'rotate':
          canvas.setGuides(null);
          canvas.setDraft(null);
          if (drag.moved) {
            commit(drag.before, canvas.elements, canvas.selectedIds);
          }
          break;
        case 'select':
          canvas.setDraft(null);
          break;
        case 'erase':
          if (drag.erased) {
            useCanvasHistoryStore.getState().push(drag.before);
          }
          break;
        case 'pan':
        case 'pinch':
          break;
      }

      dragRef.current = null;
    },
    [commit],
  );

  const onWindowMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag === null) {
        return;
      }
      const pos = stagePosition(stageRef.current, event.clientX, event.clientY);
      pointersRef.current.set(event.pointerId, pos);
      if (event.pointerId !== drag.pointerId) {
        return;
      }
      drag.shiftKey = event.shiftKey;
      handleDragMove(drag, pos);
    },
    [handleDragMove],
  );

  const onWindowUp = useCallback(
    (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2) {
        pinchRef.current = null;
      }
      const drag = dragRef.current;
      if (drag === null) {
        return;
      }
      if (event.pointerId !== drag.pointerId) {
        return;
      }
      handleDragEnd(drag);
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    },
    [handleDragEnd, onWindowMove],
  );

  function startDrag(drag: DragState): void {
    dragRef.current = drag;
    window.addEventListener('pointermove', onWindowMove, { passive: false });
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
  }

  function handlePointerDown(event: KonvaEventObject<PointerEvent>): void {
    const stage = stageRef.current;
    if (stage === null) {
      return;
    }
    const native = event.evt;
    const pointerId = native.pointerId;
    const pos = stagePosition(stage, native.clientX, native.clientY);
    pointersRef.current.set(pointerId, pos);
    const canvas = useCanvasStore.getState();

    const pointers = [...pointersRef.current.values()];
    if (pointers.length >= 2) {
      const p1 = pointers[0];
      const p2 = pointers[1];
      if (p1 !== undefined && p2 !== undefined) {
        const camera = useCameraStore.getState();
        pinchRef.current = {
          startDistance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
          startMid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
          transform: { ...camera },
        };
        dragRef.current = null;
        window.removeEventListener('pointermove', onWindowMove);
        window.removeEventListener('pointerup', onWindowUp);
        window.removeEventListener('pointercancel', onWindowUp);
        startDrag({
          mode: 'pinch',
          pointerId,
          startScreen: pos,
          lastScreen: pos,
          startWorld: pos,
          lastWorld: pos,
          moved: false,
          before: canvas.elements,
        });
        canvas.setDraft(null);
        canvas.setGuides(null);
        return;
      }
    }

    const camera = useCameraStore.getState();
    const world = screenToWorld(camera, pos.x, pos.y);
    const tool =
      useToolStore.getState().transientTool ??
      useToolStore.getState().activeTool;

    if (native.button === 1 || native.button === 2 || tool === 'hand') {
      startDrag({
        mode: 'pan',
        pointerId,
        startScreen: pos,
        lastScreen: pos,
        startWorld: world,
        lastWorld: world,
        moved: false,
        before: canvas.elements,
      });
      return;
    }

    const targetName =
      typeof event.target.name === 'function' ? event.target.name() : '';

    if (targetName === 'resize-handle' || targetName === 'rotate-handle') {
      const elementId = event.target.getAttr('dataElementId') as string;
      const original = canvas.elements.find(
        (element) => element.id === elementId,
      );
      if (original === undefined) {
        return;
      }
      if (targetName === 'resize-handle') {
        startDrag({
          mode: 'resize',
          pointerId,
          startScreen: pos,
          lastScreen: pos,
          startWorld: world,
          lastWorld: world,
          moved: false,
          before: canvas.elements,
          elementId,
          handle: event.target.getAttr('dataHandle') as ResizeHandle,
          original,
        });
      } else {
        startDrag({
          mode: 'rotate',
          pointerId,
          startScreen: pos,
          lastScreen: pos,
          startWorld: world,
          lastWorld: world,
          moved: false,
          before: canvas.elements,
          elementId,
          original,
          center: {
            x: original.x + original.width / 2,
            y: original.y + original.height / 2,
          },
        });
      }
      return;
    }

    if (tool === 'select') {
      const hitId = hitElementId(event);
      if (hitId !== null) {
        if (native.shiftKey) {
          canvas.toggleSelection(hitId);
          return;
        }
        const alreadySelected = canvas.selectedIds.includes(hitId);
        if (!alreadySelected) {
          canvas.selectOnly(hitId);
        }
        const current = useCanvasStore.getState();
        const originals = current.elements.filter((element) =>
          current.selectedIds.includes(element.id),
        );
        startDrag({
          mode: 'move',
          pointerId,
          startScreen: pos,
          lastScreen: pos,
          startWorld: world,
          lastWorld: world,
          moved: false,
          before: current.elements,
          originElements: originals,
        });
        return;
      }
      canvas.clearSelection();
      startDrag({
        mode: 'select',
        pointerId,
        startScreen: pos,
        lastScreen: pos,
        startWorld: world,
        lastWorld: world,
        moved: false,
        before: canvas.elements,
      });
      return;
    }

    if (tool === 'eraser') {
      startDrag({
        mode: 'erase',
        pointerId,
        startScreen: pos,
        lastScreen: pos,
        startWorld: world,
        lastWorld: world,
        moved: false,
        before: canvas.elements,
      });
      return;
    }

    const drag: DragState = {
      mode: 'draw',
      pointerId,
      startScreen: pos,
      lastScreen: pos,
      startWorld: world,
      lastWorld: world,
      moved: true,
      before: canvas.elements,
      drawingType: tool,
      drawnPoints: [world],
      drawnPressures: [1],
    };
    startDrag(drag);
    handleDragMove(drag, pos);
  }

  const handleWheel = useCallback((event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (stage === null) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (pointer === null) {
      return;
    }
    const camera = useCameraStore.getState();
    if (event.evt.ctrlKey || event.evt.metaKey) {
      const factor = event.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
      camera.zoomTowards(pointer.x, pointer.y, factor);
      return;
    }
    camera.panByScreen(-event.evt.deltaX, -event.evt.deltaY);
  }, []);

  const handleTouchStart = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      event.evt.preventDefault();
    },
    [],
  );

  useEffect(() => {
    const pointers = pointersRef.current;
    return () => {
      dragRef.current = null;
      pinchRef.current = null;
      pointers.clear();
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowUp);
    };
  }, [onWindowMove, onWindowUp]);

  return {
    stageRef,
    onPointerDown: handlePointerDown,
    onWheel: handleWheel,
    onTouchStart: handleTouchStart,
  };
}
