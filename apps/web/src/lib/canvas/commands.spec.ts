import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ELEMENT_TYPES, type WhiteboardElement } from '@whiteboard/shared';
import { DEFAULT_STYLE, ZOOM_STEP } from '@/lib/canvas/constants';
import {
  applyTextStyleCommand,
  beginElementEdit,
  commitElements,
  deleteCommand,
  duplicateCommand,
  groupSelectionCommand,
  insertIconCommand,
  insertImageCommand,
  registerCommand,
  renameLayerCommand,
  runCommand,
  setLayerHiddenCommand,
  setLayerLockedCommand,
  setToolCommand,
  toggleLockCommand,
  toggleSnapCommand,
  ungroupSelectionCommand,
  unregisterCommand,
  updateElementInPlace,
  zoomFitCommand,
  zoomInCommand,
  zoomOutCommand,
  zoomResetCommand,
} from '@/lib/canvas/commands';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasHistoryStore } from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';

function element(
  id: string,
  overrides: Partial<WhiteboardElement> = {},
): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version: 0,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    opacity: 1,
    strokeColor: '#000000',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: 0,
    updatedAt: 0,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    ...overrides,
  } as WhiteboardElement;
}

function resetStores(): void {
  useCanvasStore.setState({
    elements: [],
    selectedIds: [],
    draft: null,
    guides: null,
    gridVisible: true,
    snapEnabled: true,
    minimapVisible: true,
    style: DEFAULT_STYLE,
  });
  useCanvasHistoryStore.setState({ past: [], future: [] });
  useCameraStore.setState({ zoom: 1, offsetX: 0, offsetY: 0 });
  useToolStore.setState({ activeTool: 'select', transientTool: null });
}

beforeEach(() => {
  resetStores();
});

describe('deleteCommand', () => {
  it('removes selected elements and records history', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a']);
    deleteCommand();
    const state = useCanvasStore.getState();
    expect(state.elements.map((entry) => entry.id)).toEqual(['b']);
    expect(state.selectedIds).toEqual([]);
    expect(useCanvasHistoryStore.getState().past).toHaveLength(1);
  });

  it('keeps locked elements when deleting a mixed selection', () => {
    useCanvasStore
      .getState()
      .addElements([element('a'), element('b', { locked: true })]);
    useCanvasStore.getState().setSelectedIds(['a', 'b']);
    deleteCommand();
    const state = useCanvasStore.getState();
    expect(state.elements.map((entry) => entry.id)).toEqual(['b']);
    expect(state.selectedIds).toEqual([]);
  });

  it('is a no-op without a selection', () => {
    useCanvasStore.getState().addElements([element('a')]);
    deleteCommand();
    expect(useCanvasStore.getState().elements).toHaveLength(1);
    expect(useCanvasHistoryStore.getState().past).toHaveLength(0);
  });
});

describe('duplicateCommand', () => {
  it('duplicates selection with an offset and selects the copies', () => {
    useCanvasStore.getState().addElements([element('a', { x: 5, y: 6 })]);
    useCanvasStore.getState().setSelectedIds(['a']);
    duplicateCommand();
    const state = useCanvasStore.getState();
    expect(state.elements).toHaveLength(2);
    const copy = state.elements.find((entry) => entry.id !== 'a');
    expect(copy?.x).toBe(5 + 24);
    expect(copy?.y).toBe(6 + 24);
    expect(copy?.version).toBe(1);
    expect(state.selectedIds).toEqual([copy?.id]);
    expect(useCanvasHistoryStore.getState().past).toHaveLength(1);
  });
});

describe('commitElements', () => {
  it('bumps versions and records the before snapshot', () => {
    const before = [element('a', { version: 1 })];
    const after = [{ ...element('a', { version: 1 }), x: 50 }];
    commitElements(before, after);
    const state = useCanvasStore.getState();
    expect(state.elements[0].x).toBe(50);
    expect(state.elements[0].version).toBe(2);
    expect(useCanvasHistoryStore.getState().past).toEqual([before]);
  });

  it('is a no-op when before and after are the same reference', () => {
    const before = [element('a')];
    commitElements(before, before);
    expect(useCanvasHistoryStore.getState().past).toHaveLength(0);
  });
});

describe('updateElementInPlace / beginElementEdit', () => {
  it('bumps only the targeted element', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    updateElementInPlace('a', (entry) => ({ ...entry, x: 42 }));
    const state = useCanvasStore.getState();
    expect(state.elements[0].x).toBe(42);
    expect(state.elements[0].version).toBe(1);
    expect(state.elements[1].version).toBe(0);
  });

  it('does nothing for a missing element', () => {
    useCanvasStore.getState().addElements([element('a')]);
    updateElementInPlace('missing', (entry) => entry);
    expect(useCanvasStore.getState().elements[0].version).toBe(0);
  });

  it('beginElementEdit pushes the current snapshot for undo', () => {
    useCanvasStore.getState().addElements([element('a')]);
    beginElementEdit();
    expect(useCanvasHistoryStore.getState().past).toHaveLength(1);
  });
});

describe('applyTextStyleCommand', () => {
  it('recomputes sticky height for a font-size change', () => {
    useCanvasStore.getState().addElements([
      element('s1', {
        type: 'sticky',
        text: 'Hello',
        width: 120,
        fontSize: 16,
      }),
    ]);
    applyTextStyleCommand('s1', { fontSize: 24 });
    const state = useCanvasStore.getState();
    const sticky = state.elements[0] as Extract<
      WhiteboardElement,
      { type: 'sticky' }
    >;
    expect(sticky.fontSize).toBe(24);
    expect(sticky.height).toBeGreaterThan(10);
    expect(state.elements[0].version).toBe(1);
  });

  it('applies bold and alignment across all text runs', () => {
    const text = element('t1', {
      type: 'text',
      paragraphs: [{ runs: [{ text: 'Hi' }], align: 'left', listType: null }],
      fontFamily: 'Inter',
      fontSize: 16,
      lineHeight: 1.2,
      color: '#000000',
      autoWidth: false,
      width: 100,
    });
    useCanvasStore.getState().addElements([text]);
    applyTextStyleCommand('t1', { bold: true, align: 'center' });
    const updated = useCanvasStore.getState().elements[0] as Extract<
      WhiteboardElement,
      { type: 'text' }
    >;
    expect(updated.paragraphs[0].runs[0].bold).toBe(true);
    expect(updated.paragraphs[0].align).toBe('center');
    expect(updated.version).toBe(1);
  });

  it('is a no-op for a missing element', () => {
    useCanvasStore.getState().addElements([element('a')]);
    applyTextStyleCommand('missing', { fontSize: 30 });
    expect(useCanvasHistoryStore.getState().past).toHaveLength(0);
  });
});

describe('grouping commands', () => {
  it('groups two unlocked selected elements', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a', 'b']);
    groupSelectionCommand();
    const state = useCanvasStore.getState();
    const [first, second] = state.elements;
    expect(first.groupId).toBeTruthy();
    expect(second.groupId).toBe(first.groupId);
  });

  it('ignores locked members when grouping', () => {
    useCanvasStore
      .getState()
      .addElements([element('a'), element('b', { locked: true })]);
    useCanvasStore.getState().setSelectedIds(['a', 'b']);
    groupSelectionCommand();
    expect(useCanvasStore.getState().elements[0].groupId).toBeNull();
  });

  it('ungroups selected members sharing a group', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a', 'b']);
    groupSelectionCommand();
    ungroupSelectionCommand();
    const state = useCanvasStore.getState();
    expect(state.elements[0].groupId).toBeNull();
    expect(state.elements[1].groupId).toBeNull();
  });
});

describe('lock / layer commands', () => {
  it('toggleLockCommand locks an unlocked selection and unlocks a locked one', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a']);
    toggleLockCommand();
    expect(useCanvasStore.getState().elements[0].locked).toBe(true);
    toggleLockCommand();
    expect(useCanvasStore.getState().elements[0].locked).toBe(false);
  });

  it('setLayerLockedCommand and setLayerHiddenCommand update a single element', () => {
    useCanvasStore.getState().addElements([element('a')]);
    setLayerLockedCommand('a', true);
    setLayerHiddenCommand('a', true);
    const state = useCanvasStore.getState();
    expect(state.elements[0].locked).toBe(true);
    expect(state.elements[0].hidden).toBe(true);
  });

  it('renameLayerCommand sets the name and clears it for empty input', () => {
    useCanvasStore.getState().addElements([element('a')]);
    renameLayerCommand('a', 'My Box');
    expect(useCanvasStore.getState().elements[0].name).toBe('My Box');
    renameLayerCommand('a', '');
    expect(useCanvasStore.getState().elements[0].name).toBeNull();
  });
});

describe('insert commands', () => {
  it('insertImageCommand adds an image element and selects it', () => {
    insertImageCommand(10, 20, 'data:image/png;base64,xyz');
    const state = useCanvasStore.getState();
    const image = state.elements.find(
      (entry) => entry.type === ELEMENT_TYPES.IMAGE,
    );
    expect(image).toBeDefined();
    expect(state.selectedIds).toEqual([image?.id]);
  });

  it('insertIconCommand adds an emoji element at the point', () => {
    insertIconCommand(30, 40, 'emoji', '🎉');
    const state = useCanvasStore.getState();
    const icon = state.elements.find(
      (entry) => entry.type === ELEMENT_TYPES.ICON,
    );
    expect(icon).toMatchObject({ x: 30, y: 40 });
    expect(state.selectedIds).toEqual([icon?.id]);
  });
});

describe('view and tool commands', () => {
  it('zoom in/out/reset adjust the camera', () => {
    zoomInCommand();
    expect(useCameraStore.getState().zoom).toBe(ZOOM_STEP);
    zoomOutCommand();
    expect(useCameraStore.getState().zoom).toBe(1);
    zoomInCommand();
    zoomResetCommand();
    expect(useCameraStore.getState().zoom).toBe(1);
  });

  it('zoomFitCommand resets the view when the canvas is empty', () => {
    useCameraStore
      .getState()
      .setTransform({ zoom: 2, offsetX: 100, offsetY: 100 });
    zoomFitCommand();
    expect(useCameraStore.getState().zoom).toBe(1);
  });

  it('toggleSnapCommand flips the snap flag', () => {
    toggleSnapCommand();
    expect(useCanvasStore.getState().snapEnabled).toBe(false);
    toggleSnapCommand();
    expect(useCanvasStore.getState().snapEnabled).toBe(true);
  });
});

describe('runCommand', () => {
  it('dispatches tool ids to the tool store', () => {
    runCommand('tool:ellipse');
    expect(useToolStore.getState().activeTool).toBe('ellipse');
    setToolCommand('select');
    expect(useToolStore.getState().activeTool).toBe('select');
  });

  it('runs default edit handlers', () => {
    useCanvasStore.getState().addElements([element('a')]);
    runCommand('edit:select-all');
    expect(useCanvasStore.getState().selectedIds).toEqual(['a']);
  });

  it('runs registered custom commands and ignores unknown ids', () => {
    const handler = vi.fn();
    registerCommand('custom:thing', handler);
    runCommand('custom:thing');
    expect(handler).toHaveBeenCalledTimes(1);
    unregisterCommand('custom:thing');
    expect(() => runCommand('custom:thing')).not.toThrow();
  });
});
