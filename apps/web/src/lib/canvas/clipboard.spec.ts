import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteboardElement } from '@whiteboard/shared';
import {
  copyElementsToClipboard,
  deserializeElements,
  pasteOffset,
  readElementsFromClipboard,
  serializeElements,
} from '@/lib/canvas/clipboard';

function element(id: string): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version: 1,
    x: 10,
    y: 20,
    width: 100,
    height: 80,
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

const writeText = vi.fn<(payload: string) => Promise<void>>();
const readText = vi.fn<() => Promise<string>>();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  readText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('serializeElements / deserializeElements', () => {
  it('round-trips a list of elements', () => {
    const elements = [element('a'), element('b')];
    const restored = deserializeElements(serializeElements(elements));
    expect(restored).toEqual(elements);
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeElements('{ nope')).toBeNull();
  });

  it('returns null for a payload without a version-1 envelope', () => {
    expect(deserializeElements('{"version": 2, "elements": []}')).toBeNull();
    expect(deserializeElements('{"version": 1}')).toBeNull();
    expect(deserializeElements('[]')).toBeNull();
  });
});

describe('copyElementsToClipboard', () => {
  it('writes the serialized payload and reports success', async () => {
    await expect(copyElementsToClipboard([element('a')])).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    const payload = writeText.mock.calls[0][0] as string;
    expect(payload).toContain('"version":1');
    expect(payload).toContain('"id":"a"');
  });

  it('returns false for an empty selection without touching the clipboard', async () => {
    await expect(copyElementsToClipboard([])).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('returns false when the clipboard write fails', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(copyElementsToClipboard([element('a')])).resolves.toBe(false);
  });
});

describe('readElementsFromClipboard', () => {
  it('reads and deserializes elements', async () => {
    readText.mockResolvedValue(serializeElements([element('a')]));
    const restored = await readElementsFromClipboard();
    expect(restored).toHaveLength(1);
    expect(restored?.[0].id).toBe('a');
  });

  it('returns null for foreign clipboard content', async () => {
    readText.mockResolvedValue('not a whiteboard');
    await expect(readElementsFromClipboard()).resolves.toBeNull();
  });

  it('returns null when clipboard access is denied', async () => {
    readText.mockRejectedValueOnce(new Error('denied'));
    await expect(readElementsFromClipboard()).resolves.toBeNull();
  });
});

describe('pasteOffset', () => {
  it('uses a fixed base offset when nothing is selected', () => {
    expect(pasteOffset(null)).toEqual({ x: 24, y: 24 });
  });

  it('lands copies just below/right of the selection bounds', () => {
    expect(pasteOffset({ x: 50, y: 100, width: 10, height: 10 })).toEqual({
      x: 74,
      y: 124,
    });
  });
});
