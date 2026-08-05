import {
  parseWhiteboardElement,
  type DrawPatchEvent,
  type ElementCreateEvent,
  type ElementDeleteEvent,
  type WhiteboardElement,
} from '@whiteboard/shared';

/** Keys owned by the version/serialization layer, never applied from a patch. */
const STRUCTURAL_KEYS = new Set([
  'id',
  'type',
  'version',
  'schemaVersion',
  'updatedAt',
  'lastModifiedBy',
]);

export interface ApplyResult {
  elements: WhiteboardElement[];
  changed: boolean;
}

function noChange(elements: WhiteboardElement[]): ApplyResult {
  return { elements, changed: false };
}

/**
 * Applies a remote `draw:patch` under last-writer-wins semantics (ADR-0004).
 *
 * The patch is accepted only when its version is at least the local version,
 * so older broadcasts from a lagging peer never roll back a newer edit. On
 * acceptance the element adopts the event version, author and timestamp.
 */
export function applyDrawPatch(
  elements: readonly WhiteboardElement[],
  event: DrawPatchEvent,
): ApplyResult {
  const index = elements.findIndex((element) => element.id === event.id);
  if (index === -1) {
    return noChange([...elements]);
  }
  const local = elements[index];
  if (local.version > event.version) {
    return noChange([...elements]);
  }
  const patch = Object.fromEntries(
    Object.entries(event.patch).filter(([key]) => !STRUCTURAL_KEYS.has(key)),
  ) as Partial<Omit<WhiteboardElement, 'type'>>;
  const next = {
    ...local,
    ...patch,
    version: event.version,
    updatedAt: event.timestamp,
    lastModifiedBy: event.userId,
  } as WhiteboardElement;
  const elementsAfter = elements.slice();
  elementsAfter[index] = next;
  return { elements: elementsAfter, changed: true };
}

/**
 * Applies a remote `element:create`. A concurrent local edit with a newer
 * version wins and the incoming (older) element is discarded.
 */
export function applyElementCreate(
  elements: readonly WhiteboardElement[],
  event: ElementCreateEvent,
): ApplyResult {
  const parsed = parseWhiteboardElement(event.element);
  if (parsed === null) {
    return noChange([...elements]);
  }
  const index = elements.findIndex((element) => element.id === parsed.id);
  if (index !== -1 && elements[index].version >= parsed.version) {
    return noChange([...elements]);
  }
  const next = [...elements];
  if (index === -1) {
    next.push(parsed);
  } else {
    next[index] = parsed;
  }
  return { elements: next, changed: true };
}

/**
 * Applies a remote `element:delete`. Deletes only win when the element's local
 * version is not newer than the event, otherwise the delete is ignored.
 */
export function applyElementDelete(
  elements: readonly WhiteboardElement[],
  event: ElementDeleteEvent,
): ApplyResult {
  const local = elements.find((element) => element.id === event.id);
  if (local === undefined || local.version > event.version) {
    return noChange([...elements]);
  }
  return {
    elements: elements.filter((element) => element.id !== event.id),
    changed: true,
  };
}
