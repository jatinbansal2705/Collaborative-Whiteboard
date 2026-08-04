import { bumpElementVersion, type WhiteboardElement } from '@whiteboard/shared';
import { ZOOM_STEP } from '@/lib/canvas/constants';
import { elementsBoundingBox } from '@/lib/canvas/geometry';
import { createElementId } from '@/lib/canvas/ids';
import {
  copyElementsToClipboard,
  pasteOffset,
  readElementsFromClipboard,
} from '@/lib/canvas/clipboard';
import { duplicateElement } from '@/lib/canvas/elements';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasHistoryStore } from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';
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
  useCanvasHistoryStore.getState().push(elements);
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

const DEFAULT_COMMAND_HANDLERS: Record<string, () => void> = {
  'edit:undo': undoCommand,
  'edit:redo': redoCommand,
  'edit:duplicate': duplicateCommand,
  'edit:delete': deleteCommand,
  'edit:delete-backspace': deleteCommand,
  'edit:select-all': selectAllCommand,
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
