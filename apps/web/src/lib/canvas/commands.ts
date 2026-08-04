import {
  bumpElementVersion,
  ELEMENT_TYPES,
  type StickyElement,
  type TextAlign,
  type TextElement,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { ZOOM_STEP } from '@/lib/canvas/constants';
import { elementsBoundingBox } from '@/lib/canvas/geometry';
import { createElementId } from '@/lib/canvas/ids';
import {
  copyElementsToClipboard,
  pasteOffset,
  readElementsFromClipboard,
} from '@/lib/canvas/clipboard';
import {
  duplicateElement,
  createIconElement,
  createImageElement,
} from '@/lib/canvas/elements';
import { alignSelection, distributeSelection } from '@/lib/canvas/alignment';
import { createGroup, ungroupElements } from '@/lib/canvas/grouping';
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
} from '@/lib/canvas/layers';
import { computeStickySize, computeTextElementSize } from '@/lib/canvas/text';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasHistoryStore } from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';
import type { AlignMode, DistributeAxis } from './alignment';
import type { ToolId } from './types';
const DUPLICATE_OFFSET = 24;

/** Replaces the canvas document and syncs history (used by undo/redo). */
function applySnapshot(elements: WhiteboardElement[]): void {
  useCanvasStore.getState().setElements(elements);
  const existing = new Set(useCanvasStore.getState().selectedIds);
  useCanvasStore
    .getState()
    .setSelectedIds(
      elements
        .filter((element) => existing.has(element.id))
        .map((element) => element.id),
    );
  useCanvasStore.getState().setDraft(null);
  useCanvasStore.getState().setGuides(null);
}

export function undoCommand(): void {
  const previous = useCanvasHistoryStore.getState().undo();
  if (previous === null) {
    return;
  }
  applySnapshot(previous);
}

export function redoCommand(): void {
  const next = useCanvasHistoryStore.getState().redo();
  if (next === null) {
    return;
  }
  applySnapshot(next);
}

function selectedElements(): WhiteboardElement[] {
  const { elements, selectedIds } = useCanvasStore.getState();
  const selected = new Set(selectedIds);
  return elements.filter((element) => selected.has(element.id));
}

export async function copyCommand(): Promise<void> {
  const elements = selectedElements();
  if (elements.length === 0) {
    return;
  }
  await copyElementsToClipboard(elements);
}

export async function cutCommand(): Promise<void> {
  const elements = selectedElements();
  if (elements.length === 0) {
    return;
  }
  await copyElementsToClipboard(elements);
  deleteCommand();
}

export function deleteCommand(): void {
  const { elements, selectedIds } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  const locked = new Set(
    elements
      .filter((element) => selectedIds.includes(element.id) && element.locked)
      .map((element) => element.id),
  );
  const deletable = selectedIds.filter((id) => !locked.has(id));
  if (deletable.length === 0) {
    return;
  }
  useCanvasHistoryStore.getState().push(elements);
  useCanvasStore.getState().setSelectedIds(deletable);
  useCanvasStore.getState().deleteSelected();
}

export function duplicateCommand(): void {
  const canvas = useCanvasStore.getState();
  const originals = selectedElements();
  if (originals.length === 0) {
    return;
  }
  useCanvasHistoryStore.getState().push(canvas.elements);
  const duplicated = originals.map((element) =>
    duplicateElement(
      element,
      createElementId(),
      DUPLICATE_OFFSET,
      DUPLICATE_OFFSET,
    ),
  );
  canvas.addElements(duplicated);
  canvas.setSelectedIds(duplicated.map((element) => element.id));
}

export async function pasteCommand(): Promise<void> {
  const canvas = useCanvasStore.getState();
  const raw = await readElementsFromClipboard();
  if (raw === null || raw.length === 0) {
    return;
  }
  useCanvasHistoryStore.getState().push(canvas.elements);
  const offset = pasteOffset(elementsBoundingBox(selectedElements()));
  const pasted = raw.map((element) =>
    duplicateElement(element, createElementId(), offset.x, offset.y),
  );
  canvas.addElements(pasted);
  canvas.setSelectedIds(pasted.map((element) => element.id));
}

export function selectAllCommand(): void {
  const { elements } = useCanvasStore.getState();
  useCanvasStore.getState().selectAll(elements.map((element) => element.id));
}

export function zoomInCommand(): void {
  useCameraStore.getState().zoomTowards(0, 0, ZOOM_STEP);
}

export function zoomOutCommand(): void {
  useCameraStore.getState().zoomTowards(0, 0, 1 / ZOOM_STEP);
}

export function zoomResetCommand(): void {
  useCameraStore.getState().resetView();
}

export function zoomFitCommand(): void {
  const camera = useCameraStore.getState();
  const bounds = elementsBoundingBox(useCanvasStore.getState().elements);
  if (bounds === null) {
    camera.resetView();
    return;
  }
  camera.fitToBounds(bounds);
}

export function toggleGridCommand(): void {
  useCanvasStore.getState().toggleGrid();
}

export function toggleSnapCommand(): void {
  useCanvasStore
    .getState()
    .setSnapEnabled(!useCanvasStore.getState().snapEnabled);
}

export function toggleMinimapCommand(): void {
  useCanvasStore.getState().toggleMinimap();
}

export function setToolCommand(tool: ToolId): void {
  useToolStore.getState().setTool(tool);
}

/** Commits an in-progress change: bumps versions and records history. */
export function commitElements(
  before: WhiteboardElement[],
  after: WhiteboardElement[],
): void {
  if (before === after) {
    return;
  }
  const now = Date.now();
  const bumped = after.map((element) => bumpElementVersion(element, null, now));
  useCanvasHistoryStore.getState().push(before);
  useCanvasStore.getState().setElements(bumped);
}

/** Applies a pure transform over the current selection and records history. */
function arrangeSelection(
  transform: (
    elements: readonly WhiteboardElement[],
    ids: readonly string[],
  ) => WhiteboardElement[],
): void {
  const { elements, selectedIds } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  const next = transform(elements, selectedIds);
  if (next === elements) {
    return;
  }
  commitElements(elements, next);
}

export function groupSelectionCommand(): void {
  const { elements, selectedIds } = useCanvasStore.getState();
  const members = elements.filter(
    (element) => selectedIds.includes(element.id) && !element.locked,
  );
  if (members.length < 2) {
    return;
  }
  const groupId = createElementId();
  commitElements(
    elements,
    createGroup(
      elements,
      members.map((m) => m.id),
      groupId,
    ),
  );
}

export function ungroupSelectionCommand(): void {
  const { elements, selectedIds } = useCanvasStore.getState();
  const groupIdsToUngroup = new Set(
    elements
      .filter(
        (element) =>
          selectedIds.includes(element.id) && element.groupId !== null,
      )
      .map((element) => element.groupId as string),
  );
  if (groupIdsToUngroup.size === 0) {
    return;
  }
  let next = elements;
  for (const groupId of groupIdsToUngroup) {
    next = ungroupElements(next, groupId);
  }
  commitElements(elements, next);
}

export function bringToFrontCommand(): void {
  arrangeSelection(bringToFront);
}

export function sendToBackCommand(): void {
  arrangeSelection(sendToBack);
}

export function bringForwardCommand(): void {
  arrangeSelection(bringForward);
}

export function sendBackwardCommand(): void {
  arrangeSelection(sendBackward);
}

export function alignSelectionCommand(mode: AlignMode): void {
  arrangeSelection((elements, ids) => alignSelection(elements, ids, mode));
}

export function distributeSelectionCommand(axis: DistributeAxis): void {
  arrangeSelection((elements, ids) => distributeSelection(elements, ids, axis));
}

/** Locks (or unlocks when all selected are locked) the selection. */
export function toggleLockCommand(): void {
  const { elements, selectedIds } = useCanvasStore.getState();
  if (selectedIds.length === 0) {
    return;
  }
  const selected = new Set(selectedIds);
  const anyLocked = elements.some(
    (element) => selected.has(element.id) && element.locked,
  );
  commitElements(
    elements,
    elements.map((element) =>
      selected.has(element.id) ? { ...element, locked: !anyLocked } : element,
    ),
  );
}

/** Sets the lock flag of a single element (layers panel). */
export function setLayerLockedCommand(id: string, locked: boolean): void {
  const { elements } = useCanvasStore.getState();
  commitElements(
    elements,
    elements.map((element) =>
      element.id === id ? { ...element, locked } : element,
    ),
  );
}

/** Sets the hidden flag of a single element (layers panel). */
export function setLayerHiddenCommand(id: string, hidden: boolean): void {
  const { elements } = useCanvasStore.getState();
  commitElements(
    elements,
    elements.map((element) =>
      element.id === id ? { ...element, hidden } : element,
    ),
  );
}

/** Renames a single element (layers panel). */
export function renameLayerCommand(id: string, name: string): void {
  const { elements } = useCanvasStore.getState();
  commitElements(
    elements,
    elements.map((element) =>
      element.id === id ? { ...element, name: name || null } : element,
    ),
  );
}

/**
 * In-place edit used by the text/sticky editors: applies `update` to a single
 * element and bumps only its version. The caller pushes a history snapshot
 * when the editing session starts so typing stays undoable as one step.
 */
export function updateElementInPlace(
  id: string,
  update: (element: WhiteboardElement) => WhiteboardElement,
): void {
  const { elements } = useCanvasStore.getState();
  let changed = false;
  const next = elements.map((element) => {
    if (element.id !== id) {
      return element;
    }
    changed = true;
    return bumpElementVersion(update(element), null);
  });
  if (changed) {
    useCanvasStore.getState().setElements(next);
  }
}

/** Starts an editing session; the very first snapshot becomes the undo target. */
export function beginElementEdit(): void {
  useCanvasHistoryStore.getState().push(useCanvasStore.getState().elements);
}

export interface TextStylePatch {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  align?: TextAlign;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Applies a text-style patch to one text/sticky element as a single undoable
 * step. Bold/italic/underline are applied across all runs, alignment to all
 * paragraphs. Sizes are recomputed so auto-width text hugs its content.
 */
export function applyTextStyleCommand(id: string, patch: TextStylePatch): void {
  const { elements } = useCanvasStore.getState();
  const target = elements.find((element) => element.id === id);
  if (target === undefined) {
    return;
  }
  useCanvasHistoryStore.getState().push(elements);
  updateElementInPlace(id, (element) => {
    if (element.type === ELEMENT_TYPES.STICKY) {
      let next: StickyElement = { ...element };
      if (patch.fontSize !== undefined) {
        next = { ...next, fontSize: patch.fontSize };
      }
      const size = computeStickySize(next.text, next.width, next.fontSize);
      next = { ...next, height: size.height };
      return next;
    }
    if (element.type === ELEMENT_TYPES.TEXT) {
      const runs =
        patch.bold !== undefined ||
        patch.italic !== undefined ||
        patch.underline !== undefined
          ? element.paragraphs.map((paragraph) => ({
              ...paragraph,
              runs: paragraph.runs.map((run) => ({
                ...run,
                bold: patch.bold ?? run.bold,
                italic: patch.italic ?? run.italic,
                underline: patch.underline ?? run.underline,
              })),
            }))
          : element.paragraphs;
      const paragraphs =
        patch.align !== undefined
          ? runs.map((paragraph) => ({
              ...paragraph,
              align: patch.align as TextAlign,
            }))
          : runs;
      let next: TextElement = {
        ...element,
        paragraphs,
        fontFamily: (patch.fontFamily ??
          element.fontFamily) as TextElement['fontFamily'],
        fontSize: patch.fontSize ?? element.fontSize,
        color: patch.color ?? element.color,
      };
      const size = computeTextElementSize(next.paragraphs, {
        fontFamily: next.fontFamily,
        fontSize: next.fontSize,
        lineHeight: next.lineHeight,
        color: next.color,
        autoWidth: next.autoWidth,
        width: next.width,
      });
      next = {
        ...next,
        width: Math.max(next.width, size.width),
        height: size.height,
      };
      return next;
    }
    return element;
  });
}

/** Inserts an image element at a world point (from a URL or data URL). */
export function insertImageCommand(x: number, y: number, src: string): void {
  const { elements, style } = useCanvasStore.getState();
  const image = createImageElement({ x, y }, src, {
    id: createElementId(),
    style,
    ownerId: null,
  });
  commitElements(elements, [...elements, image]);
  useCanvasStore.getState().setSelectedIds([image.id]);
}

/** Inserts an icon or emoji element at a world point. */
export function insertIconCommand(
  x: number,
  y: number,
  kind: 'emoji' | 'icon',
  value: string,
): void {
  const { elements, style } = useCanvasStore.getState();
  const icon = createIconElement({ x, y }, kind, value, {
    id: createElementId(),
    style,
    ownerId: null,
  });
  commitElements(elements, [...elements, icon]);
  useCanvasStore.getState().setSelectedIds([icon.id]);
}

const DEFAULT_COMMAND_HANDLERS: Record<string, () => void> = {
  'edit:undo': undoCommand,
  'edit:redo': redoCommand,
  'edit:duplicate': duplicateCommand,
  'edit:delete': deleteCommand,
  'edit:delete-backspace': deleteCommand,
  'edit:select-all': selectAllCommand,
  'edit:group': groupSelectionCommand,
  'edit:ungroup': ungroupSelectionCommand,
  'arrange:front': bringToFrontCommand,
  'arrange:back': sendToBackCommand,
  'arrange:forward': bringForwardCommand,
  'arrange:backward': sendBackwardCommand,
  'arrange:lock': toggleLockCommand,
  'view:zoom-in': zoomInCommand,
  'view:zoom-out': zoomOutCommand,
  'view:zoom-reset': zoomResetCommand,
  'view:fit': zoomFitCommand,
  'view:toggle-grid': toggleGridCommand,
  'view:toggle-snap': toggleSnapCommand,
  'view:toggle-minimap': toggleMinimapCommand,
};

const handlerRegistry = new Map<string, () => void>();
const uiCommandIds = new Set<string>(['help']);

export function registerCommand(id: string, handler: () => void): void {
  handlerRegistry.set(id, handler);
}

export function unregisterCommand(id: string): void {
  handlerRegistry.delete(id);
}

/** Resolves a shortcut id to a synchronous command (async ones fire-and-forget). */
export function runCommand(id: string): void {
  const fallback = DEFAULT_COMMAND_HANDLERS[id];
  if (fallback !== undefined) {
    fallback();
    return;
  }
  if (id === 'edit:copy' || id === 'edit:cut' || id === 'edit:paste') {
    void runAsyncCommand(id);
    return;
  }
  if (id.startsWith('tool:')) {
    setToolCommand(id.slice('tool:'.length) as ToolId);
    return;
  }
  const custom = handlerRegistry.get(id);
  if (custom !== undefined) {
    custom();
    return;
  }
  if (uiCommandIds.has(id)) {
    return;
  }
}

async function runAsyncCommand(id: string): Promise<void> {
  if (id === 'edit:copy') {
    await copyCommand();
  } else if (id === 'edit:cut') {
    await cutCommand();
  } else if (id === 'edit:paste') {
    await pasteCommand();
  }
}
