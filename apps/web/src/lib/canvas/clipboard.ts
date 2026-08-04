import type { WhiteboardElement } from '@whiteboard/shared';
import type { WorldRect } from './types';

export function serializeElements(
  elements: readonly WhiteboardElement[],
): string {
  return JSON.stringify({ version: 1, elements });
}

export function deserializeElements(raw: string): WhiteboardElement[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1 &&
      Array.isArray((parsed as { elements?: unknown }).elements)
    ) {
      return (parsed as { elements: WhiteboardElement[] }).elements;
    }
    return null;
  } catch {
    return null;
  }
}

export async function copyElementsToClipboard(
  elements: readonly WhiteboardElement[],
): Promise<boolean> {
  if (elements.length === 0) {
    return false;
  }
  const payload = serializeElements(elements);
  try {
    await navigator.clipboard.writeText(payload);
    return true;
  } catch {
    return false;
  }
}

export async function readElementsFromClipboard(): Promise<
  WhiteboardElement[] | null
> {
  try {
    const text = await navigator.clipboard.readText();
    return deserializeElements(text);
  } catch {
    return null;
  }
}

/** Picks a paste offset so copies land just below/right of the original. */
export function pasteOffset(selectionBounds: WorldRect | null): {
  x: number;
  y: number;
} {
  const base = 24;
  if (!selectionBounds) {
    return { x: base, y: base };
  }
  return { x: selectionBounds.x + base, y: selectionBounds.y + base };
}
