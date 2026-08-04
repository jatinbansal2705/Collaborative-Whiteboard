import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STYLE } from '@/lib/canvas/constants';
import type { WhiteboardElement } from '@whiteboard/shared';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore, selectEffectiveTool } from '@/stores/tool-store';

function element(
  id: string,
  type: WhiteboardElement['type'] = 'rectangle',
): WhiteboardElement {
  return {
    id,
    type,
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
  useToolStore.setState({ activeTool: 'select', transientTool: null });
}

beforeEach(() => {
  resetStores();
});

describe('tool store', () => {
  it('sets the active tool and clears any transient tool', () => {
    useToolStore.getState().setTransientTool('hand');
    useToolStore.getState().setTool('rectangle');
    expect(selectEffectiveTool(useToolStore.getState())).toBe('rectangle');
  });

  it('transient tool wins while held', () => {
    useToolStore.getState().setTool('select');
    useToolStore.getState().setTransientTool('hand');
    expect(selectEffectiveTool(useToolStore.getState())).toBe('hand');
    useToolStore.getState().setTransientTool(null);
    expect(selectEffectiveTool(useToolStore.getState())).toBe('select');
  });
});

describe('canvas store', () => {
  it('adds and replaces elements', () => {
    const store = useCanvasStore.getState();
    store.addElements([element('a')]);
    expect(useCanvasStore.getState().elements).toHaveLength(1);
    useCanvasStore.getState().setElements([element('b')]);
    expect(useCanvasStore.getState().elements.map((entry) => entry.id)).toEqual(
      ['b'],
    );
  });

  it('manages a single selection', () => {
    useCanvasStore.getState().selectOnly('a');
    expect(useCanvasStore.getState().selectedIds).toEqual(['a']);
    useCanvasStore.getState().toggleSelection('b');
    expect(useCanvasStore.getState().selectedIds).toEqual(['a', 'b']);
    useCanvasStore.getState().toggleSelection('a');
    expect(useCanvasStore.getState().selectedIds).toEqual(['b']);
    useCanvasStore.getState().clearSelection();
    expect(useCanvasStore.getState().selectedIds).toEqual([]);
  });

  it('deletes selected elements and clears selection', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a']);
    useCanvasStore.getState().deleteSelected();
    const state = useCanvasStore.getState();
    expect(state.elements.map((entry) => entry.id)).toEqual(['b']);
    expect(state.selectedIds).toEqual([]);
  });

  it('sets a draft and guides for live previews', () => {
    useCanvasStore.getState().setDraft({ kind: 'draw', element: element('x') });
    useCanvasStore
      .getState()
      .setGuides({ dx: 5, dy: 0, linesX: [10], linesY: [] });
    const state = useCanvasStore.getState();
    expect(state.draft?.kind).toBe('draw');
    expect(state.guides?.dx).toBe(5);
  });

  it('applies style to selection and bumps versions', () => {
    useCanvasStore.getState().addElements([element('a'), element('b')]);
    useCanvasStore.getState().setSelectedIds(['a']);
    useCanvasStore
      .getState()
      .applyStyleToSelection({ ...DEFAULT_STYLE, strokeColor: '#ff0000' });

    const state = useCanvasStore.getState();
    const changed = state.elements.find((entry) => entry.id === 'a');
    expect(changed?.strokeColor).toBe('#ff0000');
    expect(changed?.version).toBe(1);
    expect(state.style.strokeColor).toBe('#ff0000');
  });

  it('does not apply fill to non-fillable elements', () => {
    useCanvasStore
      .getState()
      .addElements([element('line', 'line'), element('rect', 'rectangle')]);
    useCanvasStore.getState().setSelectedIds(['line', 'rect']);
    useCanvasStore
      .getState()
      .applyStyleToSelection({ ...DEFAULT_STYLE, fillColor: '#00ff00' });

    const state = useCanvasStore.getState();
    const line = state.elements.find((entry) => entry.id === 'line');
    const rect = state.elements.find((entry) => entry.id === 'rect');
    expect(line?.fillColor).toBeNull();
    expect(rect?.fillColor).toBe('#00ff00');
  });

  it('toggles view flags', () => {
    useCanvasStore.getState().toggleGrid();
    expect(useCanvasStore.getState().gridVisible).toBe(false);
    useCanvasStore.getState().toggleMinimap();
    expect(useCanvasStore.getState().minimapVisible).toBe(false);
    useCanvasStore.getState().setSnapEnabled(false);
    expect(useCanvasStore.getState().snapEnabled).toBe(false);
  });

  it('reset restores defaults', () => {
    useCanvasStore.getState().addElements([element('a')]);
    useCanvasStore.getState().setSelectedIds(['a']);
    useCanvasStore.getState().setStyle({ strokeColor: '#123456' });
    useCanvasStore.getState().reset();
    const state = useCanvasStore.getState();
    expect(state.elements).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.gridVisible).toBe(true);
    expect(state.style.strokeColor).toBe(DEFAULT_STYLE.strokeColor);
  });
});
